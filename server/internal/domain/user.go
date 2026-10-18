package domain

import "time"

// Roles.
const (
	RoleAdmin   = "admin"
	RoleTeacher = "teacher"
	RoleStudent = "student"
)

func ValidRole(r string) bool { return r == RoleAdmin || r == RoleTeacher || r == RoleStudent }

type User struct {
	ID          int64   `json:"id"`
	Email       string  `json:"email"`
	Name        string  `json:"name"`
	Role        string  `json:"role"`
	Locale      string  `json:"locale"`
	Active      bool    `json:"active"`
	CreatedAt   string  `json:"createdAt"`
	LastLoginAt *string `json:"lastLoginAt,omitempty"`
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
