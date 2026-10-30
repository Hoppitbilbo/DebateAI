package httpapi

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

const sessionCookie = "debateai_session"

func (s *Server) getUser(id int64) (*domain.User, error) { return s.Users.Get(id) }

func (s *Server) getUserByEmail(email string) (*domain.User, error) { return s.Users.GetByEmail(email) }

// startSession logs the user in and sets the session cookie.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	tok, exp, err := s.Accounts.StartSession(userID)
	if err != nil {
		return err
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: tok, Path: "/", HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode, Expires: exp,
	})
	return nil
}

// userFromRequest returns the logged-in user of the request, or nil.
func (s *Server) userFromRequest(r *http.Request) *domain.User {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil
	}
	return s.Accounts.UserForToken(c.Value)
}

// writeServiceErr answers with 400 for invalid input and 500 otherwise.
func writeServiceErr(w http.ResponseWriter, err error) {
	if app.IsInvalid(err) {
		writeErr(w, 400, "invalid", err.Error())
		return
	}
	writeErr(w, 500, "internal", err.Error())
}

// ---------- handlers ----------

func (s *Server) handlePublicConfig(w http.ResponseWriter, r *http.Request) {
	g := s.Settings.General()
	rooms := s.Settings.Rooms()
	writeJSON(w, 200, publicConfigResponse{
		RoomsEnabled:    rooms.Enabled,
		AnonymousRooms:  rooms.Enabled && rooms.AllowAnonymousTeachers,
		RoomMaxMinutes:  rooms.MaxMinutes,
		SiteName:        g.SiteName,
		DefaultLocale:   g.DefaultLocale,
		GuestAccess:     g.GuestAccess,
		GuestLive:       g.GuestLive,
		AllowJoinByCode: g.AllowJoinByCode,
		LiveEnabled:     g.LiveEnabled,
		SetupRequired:   s.Users.Count(domain.RoleAdmin) == 0,
		MailConfigured:  s.Settings.MailConfigured(),
	})
}

func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	if s.Users.Count(domain.RoleAdmin) > 0 {
		writeErr(w, 409, "already_setup", "an administrator already exists")
		return
	}
	var in struct{ Name, Email, Password, Locale string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	id, err := s.Accounts.CreateUser(in.Email, in.Name, in.Password, domain.RoleAdmin, in.Locale)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	if in.Locale != "" {
		g := s.Settings.General()
		g.DefaultLocale = app.NormLocale(in.Locale)
		if err := s.Settings.SaveGeneral(g); err != nil {
			log.Printf("setup: default locale: %v", err)
		}
	}
	_ = s.startSession(w, r, id)
	u, _ := s.getUser(id)
	writeJSON(w, 201, u)
}

// loginRequest accepts an identifier (username or e-mail) and, for older
// clients, the e-mail alone.
type loginRequest struct {
	Identifier string `json:"identifier"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

// identifier is the account the request names; ok is false when the two
// fields name different accounts.
func (in loginRequest) identifier() (id string, ok bool) {
	ident, email := strings.TrimSpace(in.Identifier), strings.TrimSpace(in.Email)
	switch {
	case ident == "":
		return email, true
	case email == "" || strings.EqualFold(ident, email):
		return ident, true
	}
	return "", false
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	var in loginRequest
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	identifier, ok := in.identifier()
	if !ok {
		writeErr(w, 400, "ambiguous_identifier", "identifier and email name different accounts")
		return
	}
	if !s.checkLimit(w, s.AuthLimits.Login(s.clientIP(r), identifier)) {
		return
	}
	u, err := s.Accounts.Login(identifier, in.Password)
	switch {
	case errors.Is(err, app.ErrAccountDisabled):
		writeErr(w, 403, "disabled", err.Error())
		return
	case err != nil:
		writeErr(w, 401, "invalid_credentials", app.ErrInvalidCredentials.Error())
		return
	}
	if err := s.startSession(w, r, u.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	u, _ = s.getUser(u.ID) // reload: the login time just changed
	writeJSON(w, 200, u)
}

// checkLimit answers 429 or 503 when an authentication limit refuses the
// request; an unavailable counter never lets the request through.
func (s *Server) checkLimit(w http.ResponseWriter, err error) bool {
	switch {
	case err == nil:
		return true
	case errors.Is(err, app.ErrRateLimited):
		writeErr(w, 429, "rate_limited", "too many attempts, retry later")
	default:
		writeErr(w, 503, "unavailable", "retry in a moment")
	}
	return false
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		s.Accounts.Logout(c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeOK(w)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, meResponse{User: s.userFromRequest(r)})
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	if currentUser(r).IsGuest() {
		writeErr(w, 403, "forbidden", "room guests have no profile to change")
		return
	}
	var in struct {
		Name            *string `json:"name"`
		Locale          *string `json:"locale"`
		CurrentPassword string  `json:"currentPassword"`
		NewPassword     string  `json:"newPassword"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	u, err := s.Accounts.UpdateProfile(currentUser(r), app.ProfileChange(in))
	switch {
	case errors.Is(err, app.ErrWrongPassword):
		writeErr(w, 400, "wrong_password", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	writeJSON(w, 200, u)
}

func (s *Server) handleInviteInfo(w http.ResponseWriter, r *http.Request) {
	inv, err := s.Accounts.FindInvite(r.PathValue("token"), domain.InviteKindInvite)
	if err != nil {
		writeErr(w, 404, "invalid_invite", err.Error())
		return
	}
	_, existsErr := s.getUserByEmail(inv.Email)
	writeJSON(w, 200, inviteInfoResponse{
		Email: inv.Email, Role: inv.Role, ClassName: inv.ClassName, InvitedBy: inv.InvitedBy,
		Locale: inv.Locale, UserExists: existsErr == nil,
	})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in app.Registration
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	uid, err := s.Accounts.Register(in, s.baseURL(r))
	switch {
	case errors.Is(err, app.ErrAccountDisabled):
		writeErr(w, 403, "disabled", err.Error())
		return
	case errors.Is(err, app.ErrInvalidInvite):
		writeErr(w, 404, "invalid_invite", err.Error())
		return
	case errors.Is(err, app.ErrInvalidCredentials):
		writeErr(w, 401, "invalid_credentials", "wrong password for the existing account")
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	if err := s.startSession(w, r, uid); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	u, _ := s.getUser(uid)
	writeJSON(w, 201, u)
}

// handleClassLinkInfo shows the class a username link opens: name and mode
// only, never students, e-mails or the teacher.
func (s *Server) handleClassLinkInfo(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	info, err := s.Accounts.ClassInvite(r.PathValue("code"))
	if err != nil || !s.Settings.General().AllowJoinByCode {
		writeErr(w, 404, "invalid_invite", domain.ErrEnrollmentClosed.Error())
		return
	}
	writeJSON(w, 200, classInviteResponse{ClassName: info.ClassName, EnrollmentMode: info.EnrollmentMode})
}

// handleRegisterClass creates a student account from a username class link
// and logs it in. A room guest cannot use it to keep its temporary account.
func (s *Server) handleRegisterClass(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if u := s.userFromRequest(r); u != nil && u.IsGuest() {
		writeErr(w, 403, "forbidden", "room guests cannot create an account")
		return
	}
	if !s.Settings.General().AllowJoinByCode {
		writeErr(w, 403, "disabled", "joining by code is disabled")
		return
	}
	var in struct{ Code, Username, Password, Locale string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if !s.checkLimit(w, s.AuthLimits.ClassEnrollment(domain.NormalizeJoinCode(in.Code))) {
		return
	}
	u, err := s.Accounts.RegisterClassStudent(app.ClassEnrollment(in))
	switch {
	case errors.Is(err, domain.ErrEnrollmentClosed):
		writeErr(w, 404, "invalid_invite", err.Error())
		return
	case errors.Is(err, domain.ErrUsernameTaken):
		writeErr(w, 409, "username_taken", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	if err := s.startSession(w, r, u.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	u, _ = s.getUser(u.ID)
	writeJSON(w, 201, u)
}

func (s *Server) handleForgot(w http.ResponseWriter, r *http.Request) {
	if !s.limiter.allow("forgot:"+s.clientIP(r), forgotRequestsLimit, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many requests")
		return
	}
	var in struct{ Email string }
	_ = readJSON(r, &in)
	s.Accounts.RequestReset(in.Email, s.baseURL(r))
	writeOK(w) // always OK, so the endpoint cannot be used to find accounts
}

func (s *Server) handleReset(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Password string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	u, err := s.Accounts.ResetPassword(in.Token, in.Password)
	switch {
	case errors.Is(err, app.ErrInvalidInvite):
		writeErr(w, 404, "invalid_token", "link expired or already used")
		return
	case errors.Is(err, app.ErrUserNotFound):
		writeErr(w, 404, "invalid_token", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	_ = s.startSession(w, r, u.ID)
	writeJSON(w, 200, u)
}
