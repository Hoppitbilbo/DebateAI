package app

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// classService runs classes: who may manage them, membership and bulk
// invitations. Handlers check the HTTP side (rate limits, settings).
type classService struct {
	classes  classStore
	rooms    roomStore
	resets   resetStore
	accounts *authService
}

var (
	ErrBadMemberRole = errors.New("role must be student or teacher")
	ErrOnlyOwner     = errors.New("only the class owner can add co-teachers")
	ErrInvalidCode   = errors.New("class code not found")
	ErrOwnerOnly     = errors.New("only the class owner can do this")
)

// CanManage: admins, the owner, or co-teachers.
func (c *classService) CanManage(u *domain.User, classID int64) bool {
	return u.Role == domain.RoleAdmin || (u.Role == domain.RoleTeacher && c.classes.Teaches(classID, u.ID))
}

// mayOwn: admins and the owner. Co-teachers manage the students and the
// assignments, but may not delete the class nor remove its teachers.
func (c *classService) mayOwn(u *domain.User, classID int64) bool {
	return u.Role == domain.RoleAdmin || c.classes.IsOwner(classID, u.ID)
}

// Delete removes a class managed by u: only its owner or an admin.
func (c *classService) Delete(u *domain.User, classID int64) error {
	if !c.mayOwn(u, classID) {
		return ErrOwnerOnly
	}
	return c.classes.Delete(classID)
}

// RemoveMember removes a member from a class managed by u; a teacher of the
// class only the owner or an admin may remove.
func (c *classService) RemoveMember(u *domain.User, classID, userID int64) error {
	if c.classes.Teaches(classID, userID) && !c.mayOwn(u, classID) {
		return ErrOwnerOnly
	}
	return c.classes.RemoveMember(classID, userID)
}

// MayAttempt tells whether u may work on assignment a: its teachers, the
// students of its class once it is published, and the guests of a room
// that holds it.
func (c *classService) MayAttempt(u *domain.User, a *domain.Assignment) bool {
	if u.IsGuest() {
		room, err := c.rooms.Get(*u.RoomID)
		return err == nil && room.Holds(a)
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

// NewClass is what a teacher fills in to create a class. OwnerID is only
// honoured for admins; EnrollmentMode defaults to EnrollStandard.
type NewClass struct {
	Name           string `json:"name"`
	Description    string `json:"description"`
	OwnerID        *int64 `json:"ownerId"`
	EnrollmentMode string `json:"enrollmentMode"`
}

// Create makes a class owned by u; an admin may create it for another teacher.
func (c *classService) Create(u *domain.User, in NewClass) (*domain.Class, error) {
	owner := u.ID
	if u.Role == domain.RoleAdmin && in.OwnerID != nil {
		owner = *in.OwnerID
	}
	mode := in.EnrollmentMode
	if mode == "" {
		mode = domain.EnrollStandard
	}
	if !domain.ValidEnrollmentMode(mode) {
		return nil, invalid(errors.New("invalid enrollment mode"))
	}
	id, err := c.classes.Create(strings.TrimSpace(in.Name), strings.TrimSpace(in.Description), owner, mode)
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
	cl, err := c.classes.Get(id)
	if err != nil {
		return "", err
	}
	code := domain.NewClassCode(cl.EnrollmentMode)
	return code, c.classes.SetJoinCode(id, code)
}

// MemberInvitation lists e-mails to bring into a class with one role.
type MemberInvitation struct {
	Emails []string `json:"emails"`
	Role   string   `json:"role"`
	Locale string   `json:"locale"`
}

// Invite sends a proposal to join a class. Existing accounts must accept
// with their password; knowing an email never grants membership or access.
// Only the owner (or an admin) may invite co-teachers.
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
	emails := SplitEmails(in.Emails)
	if len(emails) > maxInvitesPerRequest {
		return nil, invalid(fmt.Errorf("at most %d addresses per invitation", maxInvitesPerRequest))
	}
	className := c.classes.Name(classID)
	results := []InviteResult{}
	for _, email := range emails {
		inv, err := c.accounts.CreateInvite(Invitation{Inviter: u, Email: email, Role: role, ClassID: &classID, ClassName: className, Locale: locale}, baseURL)
		if err != nil {
			results = append(results, InviteResult{Email: email, Status: "error", EmailSent: boolPtr(false), Error: err.Error()})
			continue
		}
		results = append(results, InvitedResult(inv))
	}
	return results, nil
}

// Join adds u as a student of the active class with this code; the code
// is checked in the same statement that adds the member.
func (c *classService) Join(u *domain.User, code string) (*domain.Class, error) {
	id, err := c.classes.JoinByCode(domain.NormalizeJoinCode(code), u.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrInvalidCode
	}
	if err != nil {
		return nil, err
	}
	return c.classes.Get(id)
}

// Members lists the members of a class for u, who manages it. Each tells
// whether u may give it an assisted reset link (canResetPassword); the
// server checks again when the link is asked for and used.
func (c *classService) Members(u *domain.User, cl *domain.Class) ([]domain.Member, error) {
	members := c.classes.Members(cl.ID)
	if !mayIssueAssistedReset(u, cl) {
		return members, nil
	}
	resettable, err := c.resets.Resettable(cl.ID)
	if err != nil {
		return nil, err
	}
	for i := range members {
		members[i].CanResetPassword = resettable[members[i].UserID]
	}
	return members, nil
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
