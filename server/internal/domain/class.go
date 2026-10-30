package domain

import (
	"crypto/rand"
	"encoding/base32"
	"errors"
	"strings"
)

type Class struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	JoinCode    string `json:"joinCode,omitempty"`
	OwnerID     *int64 `json:"ownerId,omitempty"`
	OwnerName   string `json:"ownerName,omitempty"`
	Archived    bool   `json:"archived"`
	// EnrollmentMode is how students join: EnrollStandard or EnrollUsername.
	EnrollmentMode string `json:"enrollmentMode"`
	CreatedAt      string `json:"createdAt"`
	StudentCount   int    `json:"studentCount"`
	TeacherCount   int    `json:"teacherCount"`
	Assignments    int    `json:"assignmentCount"`
}

// Enrollment modes of a class.
const (
	EnrollStandard = "standard" // e-mail invitations and the short join code
	EnrollUsername = "username" // a link where students choose username and password
)

// ErrEnrollmentClosed means the link does not open an active username class
// (wrong or regenerated code, archived class, or a standard class).
var ErrEnrollmentClosed = errors.New("enrollment link not valid")

func ValidEnrollmentMode(m string) bool { return m == EnrollStandard || m == EnrollUsername }

// ClassPatch lists the class fields to change; nil fields stay as they are.
type ClassPatch struct {
	Name        *string
	Description *string
	Archived    *bool
}

type Member struct {
	UserID      int64   `json:"userId"`
	Name        string  `json:"name"`
	Email       string  `json:"email"`
	Username    string  `json:"username,omitempty"`
	Role        string  `json:"role"` // RoleStudent or RoleTeacher
	JoinedAt    string  `json:"joinedAt"`
	LastLoginAt *string `json:"lastLoginAt,omitempty"`
}

// joinCodeAlphabet avoids ambiguous characters (0/O, 1/I/L).
const joinCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// NewJoinCode returns a random 6-character code students type to join a class.
func NewJoinCode() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = joinCodeAlphabet[int(b[i])%len(joinCodeAlphabet)]
	}
	return string(b)
}

// NewEnrollmentCode returns the code of a username class link: 24 random
// bytes, so the link cannot be guessed like a short code that is typed.
func NewEnrollmentCode() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)
}

// NewClassCode returns a fresh code fitting the enrollment mode.
func NewClassCode(mode string) string {
	if mode == EnrollUsername {
		return NewEnrollmentCode()
	}
	return NewJoinCode()
}

// NormalizeJoinCode makes a typed code comparable with the stored one.
func NormalizeJoinCode(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }
