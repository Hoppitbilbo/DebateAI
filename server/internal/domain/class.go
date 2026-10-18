package domain

import (
	"crypto/rand"
	"strings"
)

type Class struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	JoinCode     string `json:"joinCode,omitempty"`
	OwnerID      *int64 `json:"ownerId,omitempty"`
	OwnerName    string `json:"ownerName,omitempty"`
	Archived     bool   `json:"archived"`
	CreatedAt    string `json:"createdAt"`
	StudentCount int    `json:"studentCount"`
	TeacherCount int    `json:"teacherCount"`
	Assignments  int    `json:"assignmentCount"`
}

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

// NormalizeJoinCode makes a typed code comparable with the stored one.
func NormalizeJoinCode(code string) string { return strings.ToUpper(strings.TrimSpace(code)) }
