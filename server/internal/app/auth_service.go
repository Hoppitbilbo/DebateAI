package app

import (
	"errors"
	"fmt"
	"log"
	"net/mail"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// authService owns accounts, logins, invitations and password resets. It
// knows nothing about HTTP: handlers turn its errors into status codes and
// its login tokens into cookies.
type authService struct {
	users    userStore
	logins   authSessionStore
	invites  inviteStore
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
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrWrongPassword      = errors.New("current password is wrong")
	ErrInvalidInvite      = errors.New("invite not found, expired or already used")
	ErrUserNotFound       = errors.New("user not found")
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

const minPasswordLength = 8

// sessionTTL is how long a login lasts.
const sessionTTL = 30 * 24 * time.Hour

// hashPassword checks the password policy and returns the bcrypt hash.
func hashPassword(password string) (string, error) {
	if len(password) < minPasswordLength {
		return "", invalid(fmt.Errorf("password must be at least %d characters", minPasswordLength))
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(h), err
}

func passwordMatches(hash, password string) bool {
	return hash != "" && bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

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

func (a *authService) SetPassword(userID int64, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	return a.users.SetPasswordHash(userID, hash)
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

// Login checks the credentials; it returns ErrInvalidCredentials or ErrAccountDisabled.
func (a *authService) Login(email, password string) (*domain.User, error) {
	u, err := a.users.GetByEmail(email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	if hash, err := a.users.PasswordHash(u.ID); err != nil || !passwordMatches(hash, password) {
		return nil, ErrInvalidCredentials
	}
	if !u.Active {
		return nil, ErrAccountDisabled
	}
	return u, nil
}

// ProfileChange is what a user may change about their own account.
type ProfileChange struct {
	Name            *string
	Locale          *string
	CurrentPassword string
	NewPassword     string // empty keeps the password
}

// UpdateProfile applies a user's changes to their own account; a new
// password requires the current one.
func (a *authService) UpdateProfile(u *domain.User, c ProfileChange) (*domain.User, error) {
	var p domain.UserPatch
	if c.Name != nil && strings.TrimSpace(*c.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*c.Name))
	}
	if c.Locale != nil {
		p.Locale = ptr(NormLocale(*c.Locale))
	}
	if err := a.users.Update(u.ID, p); err != nil {
		return nil, err
	}
	if c.NewPassword != "" {
		hash, _ := a.users.PasswordHash(u.ID)
		if !passwordMatches(hash, c.CurrentPassword) {
			return nil, ErrWrongPassword
		}
		if err := a.SetPassword(u.ID, c.NewPassword); err != nil {
			return nil, err
		}
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
	if existing, err := a.users.GetByEmail(inv.Email); err == nil {
		// The invite only adds the class, but the owner must prove it is them.
		if hash, _ := a.users.PasswordHash(existing.ID); !passwordMatches(hash, in.Password) {
			return 0, ErrInvalidCredentials
		}
		uid = existing.ID
	} else {
		if uid, err = a.CreateUser(inv.Email, in.Name, in.Password, inv.Role, locale); err != nil {
			return 0, err
		}
		subj, body := RenderMail("welcome", locale, map[string]string{"site": a.siteName(), "name": in.Name, "link": baseURL + "/login"})
		a.mail.SendMailAsync(inv.Email, subj, body)
	}
	if inv.ClassID != nil {
		memberRole := domain.RoleStudent
		if inv.Role == domain.RoleTeacher {
			memberRole = domain.RoleTeacher
		}
		if err := a.classes.AddMember(*inv.ClassID, uid, memberRole); err != nil {
			return 0, err
		}
	}
	return uid, a.invites.MarkAccepted(inv.ID)
}

// RequestReset e-mails a password reset link to an active account. It never
// reports whether the address exists, so it cannot be used to find accounts.
func (a *authService) RequestReset(email, baseURL string) {
	u, err := a.users.GetByEmail(email)
	if err != nil || !u.Active {
		return
	}
	tok := randomToken(24)
	_, err = a.invites.Create(domain.NewInvite{TokenHash: hashToken(tok), Kind: domain.InviteKindReset, Email: u.Email, Role: u.Role,
		Locale: u.Locale, ExpiresAt: time.Now().Add(resetLinkTTL).UTC().Format(time.RFC3339)})
	if err != nil {
		log.Printf("password reset for user %d: %v", u.ID, err)
		return
	}
	subj, body := RenderMail("reset", u.Locale, map[string]string{"site": a.siteName(), "name": u.Name, "link": baseURL + "/reset-password?token=" + tok})
	a.mail.SendMailAsync(u.Email, subj, body)
}

// ResetPassword sets a new password from a reset link, then makes the link
// unusable and ends every existing login of the user.
func (a *authService) ResetPassword(token, password string) (*domain.User, error) {
	inv, err := a.FindInvite(token, domain.InviteKindReset)
	if err != nil {
		return nil, err
	}
	u, err := a.users.GetByEmail(inv.Email)
	if err != nil {
		return nil, ErrUserNotFound
	}
	if err := a.SetPassword(u.ID, password); err != nil {
		return nil, err
	}
	if err := errors.Join(a.invites.MarkAccepted(inv.ID), a.logins.DeleteForUser(u.ID)); err != nil {
		return nil, err
	}
	return u, nil
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
