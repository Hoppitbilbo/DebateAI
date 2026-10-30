package domain

import (
	"errors"
	"strings"
	"time"
)

// Roles.
const (
	RoleAdmin   = "admin"
	RoleTeacher = "teacher"
	RoleStudent = "student"
)

func ValidRole(r string) bool { return r == RoleAdmin || r == RoleTeacher || r == RoleStudent }

type User struct {
	ID          int64   `json:"id"`
	Email       string  `json:"email"`              // "" for accounts without e-mail
	Username    string  `json:"username,omitempty"` // "" for accounts that sign in by e-mail
	Name        string  `json:"name"`
	Role        string  `json:"role"`
	Locale      string  `json:"locale"`
	Active      bool    `json:"active"`
	CreatedAt   string  `json:"createdAt"`
	LastLoginAt *string `json:"lastLoginAt,omitempty"`
	RoomID      *int64  `json:"roomId,omitempty"` // set for the guests of a room
	// RecoveryClassID is the class whose owner may reset the password of
	// an account without e-mail; never sent to the browser.
	RecoveryClassID *int64 `json:"-"`
}

// IsGuest reports whether the account is a temporary room guest.
func (u *User) IsGuest() bool { return u.RoomID != nil }

// Username rules: 3–30 ASCII letters, digits, '.', '-' or '_', starting with
// a letter or digit. Without '@' a username can never be read as an e-mail.
const (
	UsernameMinLength = 3
	UsernameMaxLength = 30
)

var (
	ErrInvalidUsername = errors.New("username must be 3-30 letters, digits, '.', '-' or '_', starting with a letter or digit")
	ErrUsernameTaken   = errors.New("username already taken")
)

// NormalizeUsername trims and lowercases a username and checks its rules.
func NormalizeUsername(s string) (string, error) {
	u := strings.ToLower(strings.TrimSpace(s))
	if len(u) < UsernameMinLength || len(u) > UsernameMaxLength || !isUsernameStart(u[0]) {
		return "", ErrInvalidUsername
	}
	for i := 1; i < len(u); i++ {
		if !isUsernameStart(u[i]) && u[i] != '.' && u[i] != '-' && u[i] != '_' {
			return "", ErrInvalidUsername
		}
	}
	return u, nil
}

func isUsernameStart(c byte) bool { return c >= 'a' && c <= 'z' || c >= '0' && c <= '9' }

// NewClassStudent is an account without e-mail created from the link of a
// username class; Username is normalized and PasswordHash already computed.
type NewClassStudent struct {
	Code, Username, Name, PasswordHash, Locale string
}

// UserPatch lists the profile fields to change; nil fields stay as they are.
type UserPatch struct {
	Name   *string
	Role   *string
	Active *bool
	Locale *string
}

// Invite kinds.
const (
	InviteKindInvite = "invite" // registration or class invitation
	InviteKindReset  = "reset"  // password reset link
)

// Invite is a one-time link: a registration/class invitation or a password reset.
type Invite struct {
	ID         int64   `json:"id"`
	Kind       string  `json:"kind"`
	Email      string  `json:"email"`
	Role       string  `json:"role"`
	ClassID    *int64  `json:"classId,omitempty"`
	ClassName  string  `json:"className,omitempty"`
	InvitedBy  string  `json:"invitedBy,omitempty"`
	Locale     string  `json:"locale"`
	CreatedAt  string  `json:"createdAt"`
	ExpiresAt  string  `json:"expiresAt"`
	AcceptedAt *string `json:"acceptedAt,omitempty"`
	EmailSent  bool    `json:"emailSent"`
	Link       string  `json:"link,omitempty"`
}

// Usable reports whether the link can still be used at time t.
func (i *Invite) Usable(t time.Time) bool {
	return i.AcceptedAt == nil && !t.After(ParseTime(i.ExpiresAt))
}

// NewInvite is what is needed to store an invite; TokenHash is the hash of
// the secret token sent by e-mail.
type NewInvite struct {
	TokenHash string
	Kind      string
	Email     string
	Role      string
	ClassID   *int64
	InvitedBy *int64
	Locale    string
	ExpiresAt string
}

// NewPasswordReset is a password reset link to store; TokenHash is the hash
// of the secret token. IssuedBy and ClassID are set together for an
// assisted reset (a teacher's link for an account without e-mail) and are
// nil for a reset requested by e-mail.
type NewPasswordReset struct {
	TokenHash string
	UserID    int64
	ExpiresAt string
	IssuedBy  *int64
	ClassID   *int64
}

var (
	// ErrResetLinkInvalid: the reset link is unknown, expired, used, replaced
	// or (assisted) no longer allowed.
	ErrResetLinkInvalid = errors.New("reset link expired, already used or no longer valid")
	// ErrResetNotAllowed: the account may not get an assisted reset link now.
	ErrResetNotAllowed = errors.New("this account cannot get an assisted reset link")
)
