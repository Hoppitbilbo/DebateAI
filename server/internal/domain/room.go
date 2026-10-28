package domain

import (
	"strings"
	"time"
	"unicode"
)

// A room ("aula lampo") is a temporary class: students join with a code,
// a nickname and an avatar, without an account. Every guest is a student
// account bound to the room; the room and everything in it is deleted when
// it expires.

// MaxRoomDuration is the longest a room may stay open.
const MaxRoomDuration = 2 * time.Hour

// MaxNicknameChars bounds a guest's nickname.
const MaxNicknameChars = 20

// GuestEmailDomain marks the placeholder e-mails of room guests; the
// .invalid top-level domain can never receive mail.
const GuestEmailDomain = "@aula.invalid"

type Room struct {
	ID           int64  `json:"id"`
	Code         string `json:"code"`
	Title        string `json:"title"`
	Instructions string `json:"instructions"`
	AppType      string `json:"appType"`
	AssignmentID *int64 `json:"assignmentId,omitempty"`
	TeacherID    *int64 `json:"teacherId,omitempty"` // nil when opened without an account
	Locked       bool   `json:"locked"`
	MaxGuests    int    `json:"maxGuests"`
	CreatedAt    string `json:"createdAt"`
	ExpiresAt    string `json:"expiresAt"`
	GuestCount   int    `json:"guestCount"`
}

// Expired reports whether the room is closed at time t.
func (r *Room) Expired(t time.Time) bool { return !t.Before(ParseTime(r.ExpiresAt)) }

// NewRoom is what is needed to store a room.
type NewRoom struct {
	HostTokenHash string
	TeacherID     *int64
	AssignmentID  *int64
	Title         string
	Instructions  string
	AppType       string
	MaxGuests     int
	ExpiresAt     string
}

// RoomGuest is a student inside a room, as the teacher sees it.
type RoomGuest struct {
	UserID        int64   `json:"userId"`
	Nickname      string  `json:"nickname"`
	Avatar        string  `json:"avatar"`
	JoinedAt      string  `json:"joinedAt"`
	RejoinPending bool    `json:"rejoinPending"` // a re-entry PIN is waiting to be used
	Sessions      int     `json:"sessions"`
	Turns         int     `json:"turns"`
	BestProgress  int     `json:"bestProgress"`
	Status        string  `json:"status,omitempty"` // of the latest attempt
	LastActivity  *string `json:"lastActivity,omitempty"`
}

// NormalizeNickname trims a nickname, collapses spaces, drops control
// characters and cuts it to MaxNicknameChars.
func NormalizeNickname(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	s = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, s)
	if r := []rune(s); len(r) > MaxNicknameChars {
		s = strings.TrimSpace(string(r[:MaxNicknameChars]))
	}
	return s
}
