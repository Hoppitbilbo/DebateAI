package app

import (
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// classService runs classes: who may manage them, membership and bulk
// invitations. Handlers check the HTTP side (rate limits, settings).
type classService struct {
	classes  classStore
	rooms    roomStore
	users    userStore
	accounts *authService
	mail     mailer
	siteName func() string
	mailOn   func() bool // whether SMTP is configured
}

var (
	ErrBadMemberRole = errors.New("role must be student or teacher")
	ErrOnlyOwner     = errors.New("only the class owner can add co-teachers")
	ErrInvalidCode   = errors.New("class code not found")
)

// CanManage: admins, the owner, or co-teachers.
func (c *classService) CanManage(u *domain.User, classID int64) bool {
	return u.Role == domain.RoleAdmin || c.classes.Teaches(classID, u.ID)
}

// MayAttempt tells whether u may work on assignment a: its teachers, the
// students of its class once it is published, and the guests of a room
// opened on it.
func (c *classService) MayAttempt(u *domain.User, a *domain.Assignment) bool {
	if u.IsGuest() {
		room, err := c.rooms.Get(*u.RoomID)
		return err == nil && room.AssignmentID != nil && *room.AssignmentID == a.ID
	}
	return c.CanManage(u, a.ClassID) || (c.classes.IsMember(a.ClassID, u.ID) && a.Published)
}

// List returns the classes u teaches; admins see every class unless onlyMine.
func (c *classService) List(u *domain.User, onlyMine bool) ([]*domain.Class, error) {
	if u.Role == domain.RoleAdmin && !onlyMine {
		return c.classes.ListAll()
	}
	return c.classes.ListTaughtBy(u.ID)
}

// Create makes a class owned by u; an admin may create it for another teacher.
func (c *classService) Create(u *domain.User, name, description string, ownerID *int64) (*domain.Class, error) {
	owner := u.ID
	if u.Role == domain.RoleAdmin && ownerID != nil {
		owner = *ownerID
	}
	id, err := c.classes.Create(strings.TrimSpace(name), strings.TrimSpace(description), owner)
	if err != nil {
		return nil, err
	}
	return c.classes.Get(id)
}

// ClassChange is what a teacher may change about a class.
type ClassChange struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	Archived    *bool   `json:"archived"`
}

func (c *classService) Update(id int64, ch ClassChange) (*domain.Class, error) {
	p := domain.ClassPatch{Archived: ch.Archived}
	if ch.Name != nil && strings.TrimSpace(*ch.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*ch.Name))
	}
	if ch.Description != nil {
		p.Description = ptr(strings.TrimSpace(*ch.Description))
	}
	if err := c.classes.Update(id, p); err != nil {
		return nil, err
	}
	return c.classes.Get(id)
}

// RegenerateCode gives the class a new join code.
func (c *classService) RegenerateCode(id int64) (string, error) {
	code := domain.NewJoinCode()
	return code, c.classes.SetJoinCode(id, code)
}

// MemberInvitation lists e-mails to bring into a class with one role.
type MemberInvitation struct {
	Emails []string `json:"emails"`
	Role   string   `json:"role"`
	Locale string   `json:"locale"`
}

// Invite brings people into a class: existing accounts are added at once
// (and notified), new addresses receive a registration link. Only the owner
// (or an admin) may add co-teachers.
func (c *classService) Invite(u *domain.User, classID int64, in MemberInvitation, baseURL string) ([]InviteResult, error) {
	role := in.Role
	if role == "" {
		role = domain.RoleStudent
	}
	if role != domain.RoleStudent && role != domain.RoleTeacher {
		return nil, ErrBadMemberRole
	}
	if role == domain.RoleTeacher && u.Role != domain.RoleAdmin && !c.classes.IsOwner(classID, u.ID) {
		return nil, ErrOnlyOwner
	}
	locale := in.Locale
	if locale == "" {
		locale = u.Locale
	}
	className := c.classes.Name(classID)
	results := []InviteResult{}
	for _, email := range SplitEmails(in.Emails) {
		if existing, err := c.users.GetByEmail(email); err == nil {
			results = append(results, c.addExisting(u, existing, classID, className, role, baseURL))
			continue
		}
		inv, err := c.accounts.CreateInvite(Invitation{Inviter: u, Email: email, Role: role, ClassID: &classID, ClassName: className, Locale: locale}, baseURL)
		if err != nil {
			results = append(results, InviteResult{Email: email, Status: "error", EmailSent: boolPtr(false), Error: err.Error()})
			continue
		}
		results = append(results, InvitedResult(inv))
	}
	return results, nil
}

// addExisting adds an account to the class; students stay students even
// when invited as teachers.
func (c *classService) addExisting(inviter, existing *domain.User, classID int64, className, role, baseURL string) InviteResult {
	memberRole := domain.RoleStudent
	if existing.Role != domain.RoleStudent && role == domain.RoleTeacher {
		memberRole = domain.RoleTeacher
	}
	if err := c.classes.AddMember(classID, existing.ID, memberRole); err != nil {
		return InviteResult{Email: existing.Email, Status: "error", EmailSent: boolPtr(false), Error: err.Error()}
	}
	subj, body := RenderMail("added", existing.Locale, map[string]string{"site": c.siteName(), "name": existing.Name, "inviter": inviter.Name, "class": className, "link": baseURL + "/dashboard"})
	c.mail.SendMailAsync(existing.Email, subj, body)
	return InviteResult{Email: existing.Email, Status: "added", EmailSent: boolPtr(c.mailOn())}
}

// Join adds u as a student of the active class with this code.
func (c *classService) Join(u *domain.User, code string) (*domain.Class, error) {
	cl, err := c.classes.FindByJoinCode(domain.NormalizeJoinCode(code))
	if err != nil {
		return nil, ErrInvalidCode
	}
	return cl, c.classes.AddMember(cl.ID, u.ID, domain.RoleStudent)
}

// Joined lists the active classes of a student, without their join codes.
func (c *classService) Joined(u *domain.User) ([]*domain.Class, error) {
	out, err := c.classes.ListJoinedBy(u.ID)
	for _, cl := range out {
		cl.JoinCode = "" // students do not need it
	}
	return out, err
}

// SplitEmails reads addresses separated by commas, semicolons, spaces or
// new lines (also "<a@b.it>"), lower-cased and without duplicates.
func SplitEmails(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, chunk := range in {
		for _, e := range strings.FieldsFunc(chunk, func(r rune) bool { return r == ',' || r == ';' || r == '\n' || r == ' ' || r == '\t' }) {
			e = strings.ToLower(strings.Trim(strings.TrimSpace(e), "<>\""))
			if e != "" && !seen[e] {
				seen[e] = true
				out = append(out, e)
			}
		}
	}
	return out
}
