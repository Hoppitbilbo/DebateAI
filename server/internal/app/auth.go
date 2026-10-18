package app

import (
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

const sessionCookie = "debateai_session"
const sessionTTL = 30 * 24 * time.Hour

func (s *Server) getUser(id int64) (*User, error) { return s.users.Get(id) }

func (s *Server) getUserByEmail(email string) (*User, error) { return s.users.GetByEmail(email) }

// startSession logs the user in and sets the session cookie.
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	tok, exp, err := s.accounts.StartSession(userID)
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
func (s *Server) userFromRequest(r *http.Request) *User {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil
	}
	return s.accounts.UserForToken(c.Value)
}

// writeServiceErr answers with 400 for invalid input and 500 otherwise.
func writeServiceErr(w http.ResponseWriter, err error) {
	if isInvalid(err) {
		writeErr(w, 400, "invalid", err.Error())
		return
	}
	writeErr(w, 500, "internal", err.Error())
}

// ---------- handlers ----------

func (s *Server) handlePublicConfig(w http.ResponseWriter, r *http.Request) {
	g := s.general()
	writeJSON(w, 200, publicConfigResponse{
		SiteName:        g.SiteName,
		DefaultLocale:   g.DefaultLocale,
		GuestAccess:     g.GuestAccess,
		GuestLive:       g.GuestLive,
		AllowJoinByCode: g.AllowJoinByCode,
		LiveEnabled:     g.LiveEnabled,
		SetupRequired:   s.users.Count(domain.RoleAdmin) == 0,
		MailConfigured:  s.smtp().Host != "",
	})
}

func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	if s.users.Count(domain.RoleAdmin) > 0 {
		writeErr(w, 409, "already_setup", "an administrator already exists")
		return
	}
	var in struct{ Name, Email, Password, Locale string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	id, err := s.accounts.CreateUser(in.Email, in.Name, in.Password, domain.RoleAdmin, in.Locale)
	if err != nil {
		writeServiceErr(w, err)
		return
	}
	if in.Locale != "" {
		g := s.general()
		g.DefaultLocale = normLocale(in.Locale)
		if err := s.settings.Save("general", g); err != nil {
			log.Printf("setup: default locale: %v", err)
		}
	}
	_ = s.startSession(w, r, id)
	u, _ := s.getUser(id)
	writeJSON(w, 201, u)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.limiter.allow("login:"+clientIP(r), loginAttemptsLimit, loginAttemptsWindow) {
		writeErr(w, 429, "rate_limited", "too many attempts, retry later")
		return
	}
	var in struct{ Email, Password string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	u, err := s.accounts.Login(in.Email, in.Password)
	switch {
	case errors.Is(err, errAccountDisabled):
		writeErr(w, 403, "disabled", err.Error())
		return
	case err != nil:
		writeErr(w, 401, "invalid_credentials", errInvalidCredentials.Error())
		return
	}
	if err := s.startSession(w, r, u.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	u, _ = s.getUser(u.ID) // reload: the login time just changed
	writeJSON(w, 200, u)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		s.accounts.Logout(c.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeOK(w)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, meResponse{User: s.userFromRequest(r)})
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
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
	u, err := s.accounts.UpdateProfile(currentUser(r), ProfileChange(in))
	switch {
	case errors.Is(err, errWrongPassword):
		writeErr(w, 400, "wrong_password", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	writeJSON(w, 200, u)
}

func (s *Server) handleInviteInfo(w http.ResponseWriter, r *http.Request) {
	inv, err := s.accounts.FindInvite(r.PathValue("token"), domain.InviteKindInvite)
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
	var in Registration
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	uid, err := s.accounts.Register(in, s.baseURL(r))
	switch {
	case errors.Is(err, errInvalidInvite):
		writeErr(w, 404, "invalid_invite", err.Error())
		return
	case errors.Is(err, errInvalidCredentials):
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

func (s *Server) handleForgot(w http.ResponseWriter, r *http.Request) {
	if !s.limiter.allow("forgot:"+clientIP(r), forgotRequestsLimit, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many requests")
		return
	}
	var in struct{ Email string }
	_ = readJSON(r, &in)
	s.accounts.RequestReset(in.Email, s.baseURL(r))
	writeOK(w) // always OK, so the endpoint cannot be used to find accounts
}

func (s *Server) handleReset(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Password string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	u, err := s.accounts.ResetPassword(in.Token, in.Password)
	switch {
	case errors.Is(err, errInvalidInvite):
		writeErr(w, 404, "invalid_token", "link expired or already used")
		return
	case errors.Is(err, errUserNotFound):
		writeErr(w, 404, "invalid_token", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	_ = s.startSession(w, r, u.ID)
	writeJSON(w, 200, u)
}
