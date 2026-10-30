package app

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// authService owns accounts, logins, invitations and password resets
// (password_reset.go). It
// knows nothing about HTTP: handlers turn its errors into status codes and
// its login tokens into cookies.
type authService struct {
	users    userStore
	logins   authSessionStore
	invites  inviteStore
	resets   resetStore
	classes  classStore
	mail     mailer
	siteName func() string
}

// mailer sends e-mails (implemented by Server with the SMTP settings).
type mailer interface {
	SendMail(to, subject, body string) error
	SendMailAsync(to, subject, body string)
}

// Errors the handlers map to HTTP statuses.
var (
	ErrInvalidCredentials = errors.New("invalid username, e-mail or password")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrWrongPassword      = errors.New("current password is wrong")
	ErrInvalidInvite      = errors.New("invite not found, expired or already used")
	ErrUserNotFound       = errors.New("user not found")
	ErrResetForbidden     = errors.New("only the owner of the student's class or an admin can reset this password")
	ErrNotClassStudent    = errors.New("not a student of this class")
)

// invalidInput wraps an error caused by the request data (HTTP 400).
type invalidInput struct{ error }

func (e invalidInput) Unwrap() error { return e.error }

func invalid(err error) error { return invalidInput{err} }

func IsInvalid(err error) bool {
	var ii invalidInput
	return errors.As(err, &ii)
}

func validEmail(e string) bool {
	a, err := mail.ParseAddress(strings.TrimSpace(e))
	return err == nil && a.Address == strings.TrimSpace(e)
}

func validRole(r string) bool { return domain.ValidRole(r) }

// Password policy: bcrypt reads only the first 72 bytes, so a longer
// password is refused instead of being silently cut.
const (
	minPasswordLength = 8
	maxPasswordBytes  = 72
)

// sessionTTL is how long a login lasts.
const sessionTTL = 30 * 24 * time.Hour

// hashPassword checks the password policy and returns the bcrypt hash.
func hashPassword(password string) (string, error) {
	if err := checkPassword(password); err != nil {
		return "", err
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}

func checkPassword(password string) error {
	if len(password) < minPasswordLength {
		return invalid(fmt.Errorf("password must be at least %d characters", minPasswordLength))
	}
	if len(password) > maxPasswordBytes {
		return invalid(fmt.Errorf("password must be at most %d bytes", maxPasswordBytes))
	}
	return nil
}

func passwordMatches(hash, password string) bool {
	return hash != "" && bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// timingHash is compared when the account is missing, so a login takes the
// same time whether the account exists or not.
var timingHash, _ = bcrypt.GenerateFromPassword([]byte("no account has this password"), bcrypt.DefaultCost)

// CreateUser registers an account; an empty password leaves it without one
// (it will be set through an invite).
func (a *authService) CreateUser(email, name, password, role, locale string) (int64, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !validEmail(email) {
		return 0, invalid(errors.New("invalid email"))
	}
	if !validRole(role) {
		return 0, invalid(errors.New("invalid role"))
	}
	hash := ""
	if password != "" {
		var err error
		if hash, err = hashPassword(password); err != nil {
			return 0, err
		}
	}
	if strings.TrimSpace(name) == "" {
		name = strings.Split(email, "@")[0]
	}
	id, err := a.users.Create(email, strings.TrimSpace(name), hash, role, NormLocale(locale))
	if errors.Is(err, domain.ErrEmailTaken) {
		return 0, invalid(err)
	}
	return id, err
}

// SetPassword replaces the password (admin panel) and invalidates the
// pending reset links of the account.
func (a *authService) SetPassword(userID int64, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	if err := a.users.SetPasswordHash(userID, hash); err != nil {
		return err
	}
	return a.resets.Invalidate(userID)
}

// StartSession logs a user in and returns the secret token for the cookie.
func (a *authService) StartSession(userID int64) (token string, expires time.Time, err error) {
	expires = time.Now().Add(sessionTTL)
	token, err = a.StartSessionUntil(userID, expires)
	return token, expires, err
}

// StartSessionUntil logs a user in until a fixed time (room guests leave
// when their room closes).
func (a *authService) StartSessionUntil(userID int64, expires time.Time) (string, error) {
	token := randomToken(32)
	if err := a.logins.Create(hashToken(token), userID, expires.UTC().Format(time.RFC3339)); err != nil {
		return "", err
	}
	logIfErr("record last login", a.users.RecordLogin(userID))
	logIfErr("purge expired sessions", a.logins.PurgeExpired())
	return token, nil
}

// UserForToken returns the active user of a login token, or nil.
func (a *authService) UserForToken(token string) *domain.User {
	uid, exp, err := a.logins.Lookup(hashToken(token))
	if err != nil || time.Now().After(parseTime(exp)) {
		return nil
	}
	u, err := a.users.Get(uid)
	if err != nil || !u.Active {
		return nil
	}
	return u
}

func (a *authService) Logout(token string) {
	logIfErr("logout", a.logins.Delete(hashToken(token)))
}

// Login checks the credentials. identifier is an e-mail when it holds an
// '@', a username otherwise. It returns ErrInvalidCredentials, without
// telling whether the account exists, or ErrAccountDisabled once the
// password is right. Room guests never log in this way.
func (a *authService) Login(identifier, password string) (*domain.User, error) {
	u, err := a.findByIdentifier(identifier)
	if err != nil {
		_ = bcrypt.CompareHashAndPassword(timingHash, []byte(password))
		return nil, ErrInvalidCredentials
	}
	if hash, err := a.users.PasswordHash(u.ID); err != nil || !passwordMatches(hash, password) || u.IsGuest() {
		return nil, ErrInvalidCredentials
	}
	if !u.Active {
		return nil, ErrAccountDisabled
	}
	return u, nil
}

func (a *authService) findByIdentifier(identifier string) (*domain.User, error) {
	identifier = strings.TrimSpace(identifier)
	if strings.Contains(identifier, "@") {
		return a.users.GetByEmail(strings.ToLower(identifier))
	}
	username, err := domain.NormalizeUsername(identifier)
	if err != nil {
		return nil, err
	}
	return a.users.GetByUsername(username)
}

// ClassInviteInfo is what anyone holding a class link may see.
type ClassInviteInfo struct {
	ClassName      string
	EnrollmentMode string
}

// ClassInvite describes the active username class opened by a link code,
// or returns domain.ErrEnrollmentClosed.
func (a *authService) ClassInvite(code string) (*ClassInviteInfo, error) {
	code = domain.NormalizeJoinCode(code)
	if code == "" {
		return nil, domain.ErrEnrollmentClosed
	}
	c, err := a.classes.FindByJoinCode(code)
	if err != nil || c.EnrollmentMode != domain.EnrollUsername {
		return nil, domain.ErrEnrollmentClosed
	}
	return &ClassInviteInfo{ClassName: c.Name, EnrollmentMode: c.EnrollmentMode}, nil
}

// ClassEnrollment is what a student sends from a class link. There is no
// role, e-mail or name: the account is a student named by its username.
type ClassEnrollment struct {
	Code, Username, Password, Locale string
}

// RegisterClassStudent creates a student account without e-mail and its
// membership of the class of the link, in one transaction that checks the
// link again. The password is hashed before the transaction. It returns
// invalid input, domain.ErrEnrollmentClosed or domain.ErrUsernameTaken.
func (a *authService) RegisterClassStudent(in ClassEnrollment) (*domain.User, error) {
	username, err := domain.NormalizeUsername(in.Username)
	if err != nil {
		return nil, invalid(err)
	}
	if err := checkPassword(in.Password); err != nil {
		return nil, err
	}
	if _, err := a.ClassInvite(in.Code); err != nil {
		return nil, err
	}
	hash, err := hashPassword(in.Password)
	if err != nil {
		return nil, err
	}
	uid, _, err := a.users.CreateStudentInClass(domain.NewClassStudent{Code: domain.NormalizeJoinCode(in.Code), Username: username,
		Name: username, PasswordHash: hash, Locale: NormLocale(in.Locale)})
	if err != nil {
		return nil, err
	}
	return a.users.Get(uid)
}

// ProfileChange is what a user may change about their own account.
type ProfileChange struct {
	Name            *string
	Locale          *string
	CurrentPassword string
	NewPassword     string // empty keeps the password
}

// UpdateProfile applies a user's changes to their own account. A new
// password requires the current one; everything is checked before writing,
// then profile and password are saved in one transaction that also ends
// every login and reset link of the account (the caller gives the current
// browser a new session).
func (a *authService) UpdateProfile(u *domain.User, c ProfileChange) (*domain.User, error) {
	var p domain.UserPatch
	if c.Name != nil && strings.TrimSpace(*c.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*c.Name))
	}
	if c.Locale != nil {
		p.Locale = ptr(NormLocale(*c.Locale))
	}
	if c.NewPassword == "" {
		if err := a.users.Update(u.ID, p); err != nil {
			return nil, err
		}
		return a.users.Get(u.ID)
	}
	current, err := a.users.PasswordHash(u.ID)
	if err != nil {
		return nil, err
	}
	if !passwordMatches(current, c.CurrentPassword) {
		return nil, ErrWrongPassword
	}
	hash, err := hashPassword(c.NewPassword)
	if err != nil {
		return nil, err
	}
	if err := a.users.ChangePassword(u.ID, p, hash); err != nil {
		return nil, err
	}
	return a.users.Get(u.ID)
}

// FindInvite returns a usable (not accepted, not expired) link of a kind.
func (a *authService) FindInvite(token, kind string) (*domain.Invite, error) {
	inv, err := a.invites.FindByToken(hashToken(token), kind)
	if err != nil || !inv.Usable(time.Now()) {
		return nil, ErrInvalidInvite
	}
	return inv, nil
}

// Registration is what a person sends to accept an invitation.
type Registration struct {
	Token, Name, Password, Locale string
}

// Register accepts an invitation: it creates the account (or, for an
// existing one, checks its password), joins the invited class and marks
// the invite used. It returns the user id.
func (a *authService) Register(in Registration, baseURL string) (int64, error) {
	inv, err := a.FindInvite(in.Token, domain.InviteKindInvite)
	if err != nil {
		return 0, err
	}
	locale := in.Locale
	if locale == "" {
		locale = inv.Locale
	}
	var uid int64
	memberRole := inv.Role
	if existing, err := a.users.GetByEmail(inv.Email); err == nil {
		// The invite only adds the class, but the owner must prove it is them.
		if hash, _ := a.users.PasswordHash(existing.ID); !passwordMatches(hash, in.Password) {
			return 0, ErrInvalidCredentials
		}
		if !existing.Active {
			return 0, ErrAccountDisabled
		}
		uid = existing.ID
		if existing.Role == domain.RoleStudent {
			memberRole = domain.RoleStudent
		}
	} else {
		if uid, err = a.CreateUser(inv.Email, in.Name, in.Password, inv.Role, locale); err != nil {
			return 0, err
		}
		subj, body := RenderMail("welcome", locale, map[string]string{"site": a.siteName(), "name": in.Name, "link": baseURL + "/login"})
		a.mail.SendMailAsync(inv.Email, subj, body)
	}
	if inv.ClassID != nil {
		if memberRole != domain.RoleTeacher {
			memberRole = domain.RoleStudent
		}
		if err := a.classes.AddMember(*inv.ClassID, uid, memberRole); err != nil {
			return 0, err
		}
	}
	return uid, a.invites.MarkAccepted(inv.ID)
}

// Invitation is a request to invite someone, optionally into a class.
type Invitation struct {
	Inviter   *domain.User
	Email     string
	Role      string
	ClassID   *int64
	ClassName string
	Locale    string
}

// CreateInvite stores an invitation and e-mails it. The returned invite
// carries the registration link so the UI can show it when mail is off.
func (a *authService) CreateInvite(in Invitation, baseURL string) (*domain.Invite, error) {
	email := strings.TrimSpace(strings.ToLower(in.Email))
	if !validEmail(email) {
		return nil, invalid(fmt.Errorf("invalid email: %s", email))
	}
	if !validRole(in.Role) {
		return nil, invalid(errors.New("invalid role"))
	}
	locale := NormLocale(in.Locale)
	tok := randomToken(24)
	exp := time.Now().Add(inviteTTL).UTC().Format(time.RFC3339)
	id, err := a.invites.Create(domain.NewInvite{TokenHash: hashToken(tok), Kind: domain.InviteKindInvite, Email: email, Role: in.Role,
		ClassID: in.ClassID, InvitedBy: &in.Inviter.ID, Locale: locale, ExpiresAt: exp})
	if err != nil {
		return nil, err
	}
	link := baseURL + "/register?token=" + tok
	cls := ""
	if in.ClassName != "" {
		cls = fmt.Sprintf(classPhrase[locale], in.ClassName)
	}
	subj, body := RenderMail("invite", in.Locale, map[string]string{
		"site": a.siteName(), "inviter": in.Inviter.Name, "role": roleNames[locale][in.Role], "class": cls, "link": link,
	})
	sent := a.mail.SendMail(email, subj, body) == nil
	if sent {
		logIfErr("mark invite sent", a.invites.MarkSent(id))
	}
	return &domain.Invite{ID: id, Kind: domain.InviteKindInvite, Email: email, Role: in.Role, ClassID: in.ClassID, ClassName: in.ClassName,
		Locale: locale, ExpiresAt: exp, EmailSent: sent, Link: link}, nil
}
