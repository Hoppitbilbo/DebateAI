package app

import (
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// avatarSlug is the shape of an avatar name (the files live in the frontend).
var avatarSlug = regexp.MustCompile(`^[a-z0-9-]{1,32}$`)

// RoomInfo is what a student sees before joining.
type RoomInfo struct {
	Title     string `json:"title"`
	AppType   string `json:"appType"`
	Locked    bool   `json:"locked"`
	Full      bool   `json:"full"`
	ExpiresAt string `json:"expiresAt"`
}

// Lookup returns the public information of an open room.
func (svc *roomService) Lookup(code string) (*RoomInfo, error) {
	room, err := svc.open(svc.rooms.FindByCode(domain.NormalizeJoinCode(code)))
	if err != nil {
		return nil, err
	}
	return &RoomInfo{Title: room.Title, AppType: room.AppType, Locked: room.Locked, Full: room.GuestCount >= room.MaxGuests, ExpiresAt: room.ExpiresAt}, nil
}

// GuestLogin is a guest's login token, valid until the room closes.
type GuestLogin struct {
	UserID  int64
	Token   string
	Expires time.Time
}

// JoinRequest is what a student types to enter a room.
type JoinRequest struct {
	Code     string `json:"code"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Locale   string `json:"locale"`
}

// Join adds a guest to an open room and logs them in.
func (svc *roomService) Join(in JoinRequest) (*GuestLogin, error) {
	room, err := svc.open(svc.rooms.FindByCode(domain.NormalizeJoinCode(in.Code)))
	if err != nil {
		return nil, err
	}
	if room.Locked {
		return nil, ErrRoomLocked
	}
	nick := domain.NormalizeNickname(in.Nickname)
	if nick == "" {
		return nil, ErrBadNickname
	}
	if !avatarSlug.MatchString(in.Avatar) {
		return nil, ErrBadAvatar
	}
	userID, err := svc.rooms.AddGuest(room.ID, nick, in.Avatar, NormLocale(in.Locale))
	if err != nil {
		return nil, err
	}
	return svc.login(room, userID)
}

func (svc *roomService) login(room *domain.Room, userID int64) (*GuestLogin, error) {
	expires := domain.ParseTime(room.ExpiresAt)
	token, err := svc.accounts.StartSessionUntil(userID, expires)
	if err != nil {
		return nil, err
	}
	return &GuestLogin{UserID: userID, Token: token, Expires: expires}, nil
}

// IssueRejoinPIN gives a guest a one-time PIN to enter again from another
// computer; the teacher reads it to the student.
func (svc *roomService) IssueRejoinPIN(room *domain.Room, userID int64) (string, error) {
	if _, err := svc.rooms.Guest(room.ID, userID); err != nil {
		return "", ErrGuestNotFound
	}
	pin := randomDigits(rejoinPINDigits)
	exp := svc.now().Add(rejoinPINTTL)
	if roomEnd := domain.ParseTime(room.ExpiresAt); roomEnd.Before(exp) {
		exp = roomEnd
	}
	if err := svc.rooms.SetRejoinPIN(userID, hashToken(fmt.Sprintf("%d:%s", userID, pin)), ptr(exp.UTC().Format(time.RFC3339))); err != nil {
		return "", err
	}
	return pin, nil
}

func randomDigits(n int) string {
	var b strings.Builder
	for range n {
		d, _ := rand.Int(rand.Reader, big.NewInt(10))
		b.WriteString(d.String())
	}
	return b.String()
}

// RejoinRequest is what a student types to enter again with a PIN.
type RejoinRequest struct {
	Code     string `json:"code"`
	Nickname string `json:"nickname"`
	PIN      string `json:"pin"`
}

// Rejoin logs a guest in again with the PIN the teacher gave; the PIN
// works once.
func (svc *roomService) Rejoin(in RejoinRequest) (*GuestLogin, error) {
	room, err := svc.open(svc.rooms.FindByCode(domain.NormalizeJoinCode(in.Code)))
	if err != nil {
		return nil, err
	}
	g, err := svc.rooms.GuestByNickname(room.ID, domain.NormalizeNickname(in.Nickname))
	if err != nil {
		return nil, ErrBadRejoinPIN
	}
	stored, exp, err := svc.rooms.RejoinPIN(g.UserID)
	want := hashToken(fmt.Sprintf("%d:%s", g.UserID, strings.TrimSpace(in.PIN)))
	if err != nil || stored == "" || svc.now().After(domain.ParseTime(exp)) || subtle.ConstantTimeCompare([]byte(stored), []byte(want)) != 1 {
		return nil, ErrBadRejoinPIN
	}
	consumed, err := svc.rooms.ConsumeRejoinPIN(g.UserID, stored, svc.nowString())
	if err != nil {
		return nil, err
	}
	if !consumed {
		return nil, ErrBadRejoinPIN
	}
	return svc.login(room, g.UserID)
}

// GuestRoom is what a guest sees of their own room.
type GuestRoom struct {
	Title        string `json:"title"`
	Instructions string `json:"instructions"`
	AppType      string `json:"appType"`
	AssignmentID *int64 `json:"assignmentId,omitempty"`
	ExpiresAt    string `json:"expiresAt"`
	Nickname     string `json:"nickname"`
	Avatar       string `json:"avatar"`
	// Activities is the room's path, with the guest's progress on each step.
	Activities []domain.RoomActivity `json:"activities"`
}

// ForGuest returns the room of a guest.
func (svc *roomService) ForGuest(u *domain.User) (*GuestRoom, error) {
	if !u.IsGuest() {
		return nil, ErrRoomNotFound
	}
	room, err := svc.open(svc.rooms.Get(*u.RoomID))
	if err != nil {
		return nil, err
	}
	g, err := svc.rooms.Guest(room.ID, u.ID)
	if err != nil {
		return nil, ErrGuestNotFound
	}
	return &GuestRoom{Title: room.Title, Instructions: room.Instructions, AppType: room.AppType, AssignmentID: room.AssignmentID,
		ExpiresAt: room.ExpiresAt, Nickname: g.Nickname, Avatar: g.Avatar, Activities: svc.activities(room, &u.ID)}, nil
}

// AllowAI applies the room limits to an AI request of guest u: requests per
// guest per hour and per room. The judge does not count, as the student
// does not trigger it.
func (svc *roomService) AllowAI(u *domain.User) error {
	room, err := svc.open(svc.rooms.Get(*u.RoomID))
	if err != nil {
		return err
	}
	cfg := svc.settings()
	hourAgo := svc.now().Add(-time.Hour).UTC().Format(time.RFC3339)
	if cfg.RequestsPerGuestPerHour > 0 {
		n, err := svc.usage.CountUserRequestsSince(u.ID, hourAgo, TaskJudge)
		if err != nil {
			return ErrUsageUnavailable
		}
		if n >= cfg.RequestsPerGuestPerHour {
			return ErrGuestLimit
		}
	}
	if cfg.MaxRequestsPerRoom > 0 {
		n, err := svc.usage.CountRoomRequestsSince(room.ID, room.CreatedAt, TaskJudge)
		if err != nil {
			return ErrUsageUnavailable
		}
		if n >= cfg.MaxRequestsPerRoom {
			return ErrRoomLimit
		}
	}
	return nil
}

// GuestSessions lists the attempts of one of the room's guests.
func (svc *roomService) GuestSessions(room *domain.Room, userID int64) ([]*domain.SessionSummary, error) {
	if _, err := svc.rooms.Guest(room.ID, userID); err != nil {
		return nil, ErrGuestNotFound
	}
	return svc.sessions.ListForUser(userID, roomAttemptsPerGuest)
}

// Session returns an attempt of one of the room's guests.
func (svc *roomService) Session(room *domain.Room, sessionID int64) (*domain.SessionDetail, error) {
	d, err := svc.sessions.Detail(sessionID)
	if err != nil || d.UserID == nil {
		return nil, ErrSessionNotFound
	}
	if _, err := svc.rooms.Guest(room.ID, *d.UserID); err != nil {
		return nil, ErrSessionNotFound
	}
	return d, nil
}

// Remove sends a guest away and deletes their attempts.
func (svc *roomService) Remove(room *domain.Room, userID int64) error {
	if _, err := svc.rooms.Guest(room.ID, userID); err != nil {
		return ErrGuestNotFound
	}
	return svc.rooms.DeleteGuest(room.ID, userID)
}
