package httpapi

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Temporary rooms ("aula lampo"). A room is managed with its secret host
// key (header X-Room-Key, for teachers without an account) or by the
// teacher who opened it. Guests get the normal session cookie, valid until
// the room closes.
//
// Rate limits never use the IP alone for students: a school lab reaches
// the server from one address. Only wrong codes and wrong PINs are counted.

const roomKeyHeader = "X-Room-Key"

// writeRoomErr answers a room error with its HTTP status.
func writeRoomErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, app.ErrRoomNotFound), errors.Is(err, app.ErrGuestNotFound), errors.Is(err, app.ErrSessionNotFound):
		writeErr(w, 404, "not_found", err.Error())
	case errors.Is(err, app.ErrRoomNotYours), errors.Is(err, app.ErrAssignmentForbidden), errors.Is(err, app.ErrNotYourClass):
		writeErr(w, 403, "forbidden", err.Error())
	case errors.Is(err, app.ErrRoomsDisabled):
		writeErr(w, 403, "rooms_disabled", err.Error())
	case errors.Is(err, app.ErrRoomLoginRequired):
		writeErr(w, 401, "login_required", err.Error())
	case errors.Is(err, app.ErrRoomLocked):
		writeErr(w, 403, "room_locked", err.Error())
	case errors.Is(err, app.ErrRoomFull):
		writeErr(w, 409, "room_full", err.Error())
	case errors.Is(err, app.ErrNicknameTaken):
		writeErr(w, 409, "nickname_taken", err.Error())
	case errors.Is(err, app.ErrBadNickname), errors.Is(err, app.ErrBadAvatar), errors.Is(err, app.ErrInvalidApp), errors.Is(err, app.ErrAssignmentInvalid),
		errors.Is(err, app.ErrBadImportMapping), errors.Is(err, app.ErrBadExportFile):
		writeErr(w, 400, "bad_request", err.Error())
	case errors.Is(err, app.ErrBadRejoinPIN):
		writeErr(w, 403, "bad_pin", err.Error())
	case errors.Is(err, app.ErrTooManyRooms):
		writeErr(w, 429, "rate_limited", err.Error())
	default:
		writeErr(w, 500, "internal", err.Error())
	}
}

// setGuestCookie logs a guest in until their room closes.
func setGuestCookie(w http.ResponseWriter, r *http.Request, login *app.GuestLogin) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: login.Token, Path: "/", HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode, Expires: login.Expires,
	})
}

// codeGuard refuses the requests of a network that typed too many wrong
// room codes or PINs; failed() counts one more.
type codeGuard struct {
	s   *Server
	key string
}

func (s *Server) codeGuard(r *http.Request, scope string) codeGuard {
	return codeGuard{s: s, key: "roomcode:" + scope + ":" + clientIP(r)}
}

func (g codeGuard) blocked() bool {
	return g.s.limiter.exhausted(g.key, wrongRoomCodesLimit)
}

func (g codeGuard) failed() { g.s.limiter.allow(g.key, wrongRoomCodesLimit, wrongRoomCodesWindow) }

// ---------- students ----------

func (s *Server) handleRoomLookup(w http.ResponseWriter, r *http.Request) {
	s.RoomSvc.Purge()
	guard := s.codeGuard(r, "code")
	if guard.blocked() {
		writeErr(w, 429, "rate_limited", "too many wrong codes, wait a few minutes")
		return
	}
	info, err := s.RoomSvc.Lookup(r.PathValue("code"))
	if err != nil {
		guard.failed()
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, info)
}

func (s *Server) handleRoomJoin(w http.ResponseWriter, r *http.Request) {
	s.RoomSvc.Purge()
	var in app.JoinRequest
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	guard := s.codeGuard(r, "code")
	if guard.blocked() {
		writeErr(w, 429, "rate_limited", "too many wrong codes, wait a few minutes")
		return
	}
	login, err := s.RoomSvc.Join(in)
	if errors.Is(err, app.ErrRoomNotFound) {
		guard.failed()
	}
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	s.answerGuestLogin(w, r, login)
}

func (s *Server) handleRoomRejoin(w http.ResponseWriter, r *http.Request) {
	var in app.RejoinRequest
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	// PINs have 4 digits: few tries per room and nickname, whatever the network.
	pinKey := "roompin:" + domain.NormalizeJoinCode(in.Code) + ":" + domain.NormalizeNickname(in.Nickname)
	if s.limiter.exhausted(pinKey, wrongPINsLimit) {
		writeErr(w, 429, "rate_limited", "too many wrong PINs, ask your teacher for a new one later")
		return
	}
	login, err := s.RoomSvc.Rejoin(in)
	if err != nil {
		if errors.Is(err, app.ErrBadRejoinPIN) {
			s.limiter.allow(pinKey, wrongPINsLimit, wrongPINsWindow)
		}
		writeRoomErr(w, err)
		return
	}
	s.answerGuestLogin(w, r, login)
}

func (s *Server) answerGuestLogin(w http.ResponseWriter, r *http.Request, login *app.GuestLogin) {
	setGuestCookie(w, r, login)
	u, err := s.Users.Get(login.UserID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, u)
}

// handleGuestRoom tells a guest about their room.
func (s *Server) handleGuestRoom(w http.ResponseWriter, r *http.Request) {
	gr, err := s.RoomSvc.ForGuest(currentUser(r))
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, gr)
}

// ---------- teachers ----------

// handleOpenRoom opens a room for the logged-in teacher, or for a teacher
// without an account when the admin allows it.
func (s *Server) handleOpenRoom(w http.ResponseWriter, r *http.Request) {
	s.RoomSvc.Purge()
	var in app.RoomRequest
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	u := s.userFromRequest(r)
	if u != nil && u.Role == domain.RoleStudent {
		writeErr(w, 403, "forbidden", "students cannot open rooms")
		return
	}
	if u == nil && !s.limiter.allow("roomopen:"+clientIP(r), anonymousRoomsPerIPDay, 24*time.Hour) {
		writeErr(w, 429, "rate_limited", "too many rooms opened from this network today, log in to open more")
		return
	}
	opened, err := s.RoomSvc.Open(u, in)
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 201, opened)
}

func (s *Server) handleListRooms(w http.ResponseWriter, r *http.Request) {
	s.RoomSvc.Purge()
	out, err := s.RoomSvc.ListOpen(currentUser(r))
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}

// hostedRoom returns the {id} room when the request may manage it: with
// its host key, or as the teacher who opened it.
func (s *Server) hostedRoom(w http.ResponseWriter, r *http.Request) (*domain.Room, bool) {
	s.RoomSvc.Purge()
	id := pathID(r, "id")
	var room *domain.Room
	var err error
	if key := r.Header.Get(roomKeyHeader); key != "" {
		room, err = s.RoomSvc.ForHost(key)
		if err == nil && room.ID != id {
			err = app.ErrRoomNotFound
		}
	} else if u := s.userFromRequest(r); u != nil {
		room, err = s.RoomSvc.ForTeacher(u, id)
	} else {
		err = app.ErrRoomNotFound
	}
	if err != nil {
		writeRoomErr(w, err)
		return nil, false
	}
	return room, true
}

func (s *Server) handleGetRoom(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	view, err := s.RoomSvc.View(room)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, view)
}

func (s *Server) handleUpdateRoom(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	var in struct {
		Locked *bool `json:"locked"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if in.Locked != nil {
		if err := s.RoomSvc.SetLocked(room, *in.Locked); err != nil {
			writeErr(w, 500, "internal", err.Error())
			return
		}
	}
	s.handleGetRoom(w, r)
}

func (s *Server) handleEndRoom(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	if err := s.RoomSvc.End(room); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleRoomGuestPIN(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	pin, err := s.RoomSvc.IssueRejoinPIN(room, pathID(r, "userId"))
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, rejoinPINResponse{PIN: pin})
}

func (s *Server) handleRemoveRoomGuest(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	if err := s.RoomSvc.Remove(room, pathID(r, "userId")); err != nil {
		writeRoomErr(w, err)
		return
	}
	writeOK(w)
}

func (s *Server) handleRoomGuestSessions(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	out, err := s.RoomSvc.GuestSessions(room, pathID(r, "userId"))
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleRoomSession(w http.ResponseWriter, r *http.Request) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return
	}
	d, err := s.RoomSvc.Session(room, pathID(r, "sessionId"))
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, d)
}

// exportedRoom returns the {id} room the request manages, with its export.
func (s *Server) exportedRoom(w http.ResponseWriter, r *http.Request) (*domain.Room, *app.RoomExport, bool) {
	room, ok := s.hostedRoom(w, r)
	if !ok {
		return nil, nil, false
	}
	e, err := s.RoomTransfer.Export(room)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return nil, nil, false
	}
	return room, e, true
}

// handleRoomExportXLSX sends the results of the room as an Excel sheet.
func (s *Server) handleRoomExportXLSX(w http.ResponseWriter, r *http.Request) {
	if _, e, ok := s.exportedRoom(w, r); ok {
		writeRoomXLSX(w, e, r.URL.Query().Get("lang"))
	}
}

// handleRoomExportFile sends the encrypted file that can be imported into a class.
func (s *Server) handleRoomExportFile(w http.ResponseWriter, r *http.Request) {
	room, e, ok := s.exportedRoom(w, r)
	if !ok {
		return
	}
	file, err := s.RoomTransfer.SealExport(e)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	name := safeFileName(fmt.Sprintf("aula-%s-%s", room.Title, fileDay(room.CreatedAt))) + ".aula"
	sendDownload(w, "application/json", "room.aula", name)
	_, _ = w.Write(file)
}

// fileDay is the date of a stored timestamp (YYYY-MM-DD), for file names.
func fileDay(ts string) string { return domain.ParseTime(ts).Format(time.DateOnly) }

// roomImportIn imports either an open room (its id, or its host key) or an
// exported file into a class.
type roomImportIn struct {
	RoomID  int64             `json:"roomId"`
	HostKey string            `json:"hostKey"`
	File    string            `json:"file"`
	Matches []app.ImportMatch `json:"matches"`
}

// importedRoom is the open room an import names, by host key or as its teacher.
func (s *Server) importedRoom(u *domain.User, in roomImportIn) (*domain.Room, error) {
	if in.HostKey != "" {
		return s.RoomSvc.ForHost(in.HostKey)
	}
	return s.RoomSvc.ForTeacher(u, in.RoomID)
}

func (s *Server) handleRoomImport(w http.ResponseWriter, r *http.Request) {
	u, classID, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	var in roomImportIn
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	var res *app.ImportResult
	room, err := s.importedRoom(u, in)
	switch {
	case in.File != "":
		res, err = s.RoomTransfer.ImportFile(u, classID, in.File, in.Matches)
	case err == nil:
		res, err = s.RoomTransfer.ImportRoom(u, classID, room, in.Matches)
	}
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, res)
}

// handleRoomImportPreview lists the guests of an exported file.
func (s *Server) handleRoomImportPreview(w http.ResponseWriter, r *http.Request) {
	if _, _, ok := s.managedClass(w, r); !ok {
		return
	}
	var in roomImportIn
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	p, err := s.RoomTransfer.PreviewFile(in.File)
	if err != nil {
		writeRoomErr(w, err)
		return
	}
	writeJSON(w, 200, p)
}

// handleCronPurgeRooms is called by Vercel Cron with the CRON_SECRET; the
// rooms are also purged on every room request, this is the safety net.
func (s *Server) handleCronPurgeRooms(w http.ResponseWriter, r *http.Request) {
	want := "Bearer " + s.cfg.CronSecret
	if s.cfg.CronSecret == "" || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte(want)) != 1 {
		writeErr(w, 401, "unauthorized", "cron secret required")
		return
	}
	s.RoomSvc.Purge()
	writeOK(w)
}
