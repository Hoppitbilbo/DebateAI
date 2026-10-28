package app

import (
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// roomService runs the temporary rooms ("aula lampo"): a teacher, with or
// without an account, opens a room; students join with its code, a nickname
// and an avatar; everything is deleted when the room expires or is ended.
// The guests are student accounts bound to the room, so the activities work
// for them as for any student.
type roomService struct {
	rooms       roomStore
	sessions    sessionStore
	assignments assignmentStore
	classSvc    *classService
	accounts    *authService
	usage       usageStore
	settings    func() RoomSettings
	now         func() time.Time
	lastPurge   atomic.Int64 // unix seconds of the last purge
}

var (
	ErrRoomsDisabled     = errors.New("temporary rooms are disabled")
	ErrRoomLoginRequired = errors.New("log in to open a room")
	ErrTooManyRooms      = errors.New("too many open rooms, retry later")
	ErrRoomNotFound      = errors.New("room not found or closed")
	ErrRoomLocked        = errors.New("the teacher closed the entrance of this room")
	ErrRoomFull          = domain.ErrRoomFull
	ErrNicknameTaken     = domain.ErrNicknameTaken
	ErrBadNickname       = errors.New("choose a nickname")
	ErrBadAvatar         = errors.New("choose an avatar")
	ErrBadRejoinPIN      = errors.New("wrong or expired PIN: ask your teacher for a new one")
	ErrGuestNotFound     = errors.New("guest not found")
	ErrGuestLimit        = errors.New("you sent too many requests, wait a few minutes")
	ErrRoomLimit         = errors.New("this room used all its AI requests")
	ErrRoomNotYours      = errors.New("not your room")
)

// avatarSlug is the shape of an avatar name (the files live in the frontend).
var avatarSlug = regexp.MustCompile(`^[a-z0-9-]{1,32}$`)

func (svc *roomService) nowString() string { return svc.now().UTC().Format(time.RFC3339) }

// RoomRequest is what a teacher fills in to open a room.
type RoomRequest struct {
	Title        string `json:"title"`
	Instructions string `json:"instructions"`
	AppType      string `json:"appType"`
	AssignmentID int64  `json:"assignmentId"` // an existing assignment of the teacher's classes
	// Assignment is a new assignment for this room only (characters, topic,
	// goals, turns): it lives and dies with the room. Without it and without
	// AssignmentID the students choose freely.
	Assignment *AssignmentInput `json:"assignment"`
	Minutes    int              `json:"minutes"`
	MaxGuests  int              `json:"maxGuests"`
}

// OpenedRoom is the new room with the secret key that manages it; the key
// is shown once and never stored in clear.
type OpenedRoom struct {
	Room    *domain.Room `json:"room"`
	HostKey string       `json:"hostKey"`
}

// Open creates a room for u (nil when the teacher has no account).
func (svc *roomService) Open(u *domain.User, in RoomRequest) (*OpenedRoom, error) {
	cfg := svc.settings()
	if !cfg.Enabled {
		return nil, ErrRoomsDisabled
	}
	n := svc.newRoom(in, cfg)
	if err := svc.setHost(&n, u, cfg); err != nil {
		return nil, err
	}
	switch {
	case in.AssignmentID > 0:
		if err := svc.setAssignment(&n, u, in.AssignmentID); err != nil {
			return nil, err
		}
	case in.Assignment != nil:
		if err := setOwnAssignment(&n, *in.Assignment); err != nil {
			return nil, err
		}
	}
	if !domain.AppTypes[n.AppType] {
		return nil, ErrInvalidApp
	}
	return svc.create(n)
}

// newRoom reads the request within the limits of the settings.
func (svc *roomService) newRoom(in RoomRequest, cfg RoomSettings) domain.NewRoom {
	minutes := clampInt(in.Minutes, 1, cfg.MaxMinutes, min(defaultRoomMinutes, cfg.MaxMinutes))
	return domain.NewRoom{
		Title:        truncate(strings.TrimSpace(in.Title), maxRoomTitleChars),
		Instructions: truncate(strings.TrimSpace(in.Instructions), maxRoomInstructChars),
		AppType:      in.AppType,
		MaxGuests:    clampInt(in.MaxGuests, 1, cfg.MaxGuests, cfg.MaxGuests),
		ExpiresAt:    svc.now().Add(time.Duration(minutes) * time.Minute).UTC().Format(time.RFC3339),
	}
}

// setHost makes u the room's teacher; without an account the room is
// anonymous, when the admin allows it and not too many are open.
func (svc *roomService) setHost(n *domain.NewRoom, u *domain.User, cfg RoomSettings) error {
	if u != nil && !u.IsGuest() {
		n.TeacherID = &u.ID
		return nil
	}
	if !cfg.AllowAnonymousTeachers {
		return ErrRoomLoginRequired
	}
	if svc.rooms.CountOpenAnonymous(svc.nowString()) >= cfg.MaxOpenAnonymousRooms {
		return ErrTooManyRooms
	}
	return nil
}

// setAssignment opens the room on an assignment u manages: it takes the
// assignment's app, and its title when the room has none.
func (svc *roomService) setAssignment(n *domain.NewRoom, u *domain.User, assignmentID int64) error {
	a, err := svc.assignments.Get(assignmentID)
	if err != nil || n.TeacherID == nil || !svc.classSvc.CanManage(u, a.ClassID) {
		return ErrAssignmentForbidden
	}
	n.AssignmentID, n.AppType = &a.ID, a.AppType
	if n.Title == "" {
		n.Title = a.Title
	}
	return nil
}

// setOwnAssignment gives the room an assignment of its own, read like a
// class assignment: always published, no due date (the room has its end),
// no live voice (guests never get it).
func setOwnAssignment(n *domain.NewRoom, in AssignmentInput) error {
	a, err := in.newAssignment()
	if err != nil {
		return err
	}
	a.Published, a.AllowLive, a.DueAt = true, false, nil
	n.OwnAssignment, n.AppType = &a, a.AppType
	if n.Title == "" {
		n.Title = a.Title
	}
	if n.Instructions == "" {
		n.Instructions = a.Instructions
	}
	return nil
}

// create stores the room with a new secret host key.
func (svc *roomService) create(n domain.NewRoom) (*OpenedRoom, error) {
	key := randomToken(roomHostKeyBytes)
	n.HostTokenHash = hashToken(key)
	id, err := svc.rooms.Create(n)
	if err != nil {
		return nil, err
	}
	room, err := svc.rooms.Get(id)
	if err != nil {
		return nil, err
	}
	return &OpenedRoom{Room: room, HostKey: key}, nil
}

// clampInt returns v inside [lo, hi], or def when v is not set (<= 0).
func clampInt(v, lo, hi, def int) int {
	if v <= 0 {
		v = def
	}
	return max(lo, min(v, hi))
}

// open returns the room when it exists and has not expired.
func (svc *roomService) open(room *domain.Room, err error) (*domain.Room, error) {
	if err != nil || room.Expired(svc.now()) {
		return nil, ErrRoomNotFound
	}
	return room, nil
}

// ForHost returns the open room managed with the secret key.
func (svc *roomService) ForHost(key string) (*domain.Room, error) {
	if key == "" {
		return nil, ErrRoomNotFound
	}
	return svc.open(svc.rooms.FindByHostToken(hashToken(key)))
}

// ForTeacher returns an open room of u (admins may manage any room).
func (svc *roomService) ForTeacher(u *domain.User, id int64) (*domain.Room, error) {
	room, err := svc.open(svc.rooms.Get(id))
	if err != nil {
		return nil, err
	}
	if u.Role != domain.RoleAdmin && (room.TeacherID == nil || *room.TeacherID != u.ID) {
		return nil, ErrRoomNotYours
	}
	return room, nil
}

// ListOpen returns the open rooms of a teacher.
func (svc *roomService) ListOpen(u *domain.User) ([]*domain.Room, error) {
	return svc.rooms.ListOpenForTeacher(u.ID, svc.nowString())
}

// RoomView is what the teacher's screen shows.
type RoomView struct {
	Room   *domain.Room       `json:"room"`
	Guests []domain.RoomGuest `json:"guests"`
	Now    string             `json:"now"` // server time, for the countdown
}

func (svc *roomService) View(room *domain.Room) (*RoomView, error) {
	guests, err := svc.rooms.Guests(room.ID)
	if err != nil {
		return nil, err
	}
	return &RoomView{Room: room, Guests: guests, Now: svc.nowString()}, nil
}

func (svc *roomService) SetLocked(room *domain.Room, locked bool) error {
	return svc.rooms.SetLocked(room.ID, locked)
}

// Remove sends a guest away and deletes their attempts.
func (svc *roomService) Remove(room *domain.Room, userID int64) error {
	if _, err := svc.rooms.Guest(room.ID, userID); err != nil {
		return ErrGuestNotFound
	}
	return svc.rooms.DeleteGuest(room.ID, userID)
}

// End closes the room now and deletes everything in it.
func (svc *roomService) End(room *domain.Room) error { return svc.rooms.Delete(room.ID) }

// Purge deletes the expired rooms. Room requests call it, at most once per
// roomPurgeInterval: an expired room is refused at once anyway, this only
// removes its data.
func (svc *roomService) Purge() {
	now := svc.now().Unix()
	last := svc.lastPurge.Load()
	if now-last < int64(roomPurgeInterval.Seconds()) || !svc.lastPurge.CompareAndSwap(last, now) {
		return
	}
	logIfErr("purge expired rooms", svc.rooms.PurgeExpired(svc.nowString()))
}

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
	if err := svc.rooms.SetRejoinPIN(g.UserID, "", nil); err != nil {
		return nil, err
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
		ExpiresAt: room.ExpiresAt, Nickname: g.Nickname, Avatar: g.Avatar}, nil
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
	if cfg.RequestsPerGuestPerHour > 0 && svc.usage.CountUserRequestsSince(u.ID, hourAgo, TaskJudge) >= cfg.RequestsPerGuestPerHour {
		return ErrGuestLimit
	}
	if cfg.MaxRequestsPerRoom > 0 && svc.usage.CountRoomRequestsSince(room.ID, room.CreatedAt, TaskJudge) >= cfg.MaxRequestsPerRoom {
		return ErrRoomLimit
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
