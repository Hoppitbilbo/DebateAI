package app

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

const sessionCookie = "debateai_session"
const sessionTTL = 30 * 24 * time.Hour

func (s *Server) getUser(id int64) (*User, error) { return s.users.Get(id) }

func (s *Server) getUserByEmail(email string) (*User, error) { return s.users.GetByEmail(email) }

func validEmail(e string) bool {
	a, err := mail.ParseAddress(strings.TrimSpace(e))
	return err == nil && a.Address == strings.TrimSpace(e)
}

func validRole(r string) bool { return domain.ValidRole(r) }

func (s *Server) createUser(email, name, password, role, locale string) (int64, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !validEmail(email) {
		return 0, errors.New("invalid email")
	}
	if !validRole(role) {
		return 0, errors.New("invalid role")
	}
	hash := ""
	if password != "" {
		if len(password) < 8 {
			return 0, errors.New("password must be at least 8 characters")
		}
		h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return 0, err
		}
		hash = string(h)
	}
	if strings.TrimSpace(name) == "" {
		name = strings.Split(email, "@")[0]
	}
	return s.users.Create(email, strings.TrimSpace(name), hash, role, normLocale(locale))
}

func (s *Server) setPassword(userID int64, password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.users.SetPasswordHash(userID, string(h))
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	tok := randomToken(32)
	exp := time.Now().Add(sessionTTL)
	if err := s.logins.Create(hashToken(tok), userID, exp.UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	logIfErr("record last login", s.users.RecordLogin(userID))
	logIfErr("purge expired sessions", s.logins.PurgeExpired())
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: tok, Path: "/", HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode, Expires: exp,
	})
	return nil
}

func (s *Server) userFromRequest(r *http.Request) *User {
	c, err := r.Cookie(sessionCookie)
	if err != nil || c.Value == "" {
		return nil
	}
	uid, exp, err := s.logins.Lookup(hashToken(c.Value))
	if err != nil {
		return nil
	}
	if time.Now().After(parseTime(exp)) {
		return nil
	}
	u, err := s.getUser(uid)
	if err != nil || !u.Active {
		return nil
	}
	return u
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
	id, err := s.createUser(in.Email, in.Name, in.Password, "admin", in.Locale)
	if err != nil {
		writeErr(w, 400, "invalid", err.Error())
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
	u, err := s.users.GetByEmail(in.Email)
	var hash string
	if err == nil {
		hash, err = s.users.PasswordHash(u.ID)
	}
	if err != nil || hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		writeErr(w, 401, "invalid_credentials", "invalid email or password")
		return
	}
	if !u.Active {
		writeErr(w, 403, "disabled", "account disabled")
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
		logIfErr("logout", s.logins.Delete(hashToken(c.Value)))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeOK(w)
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, meResponse{User: s.userFromRequest(r)})
}

func (s *Server) handleUpdateMe(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
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
	var p domain.UserPatch
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*in.Name))
	}
	if in.Locale != nil {
		p.Locale = ptr(normLocale(*in.Locale))
	}
	if err := s.users.Update(u.ID, p); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	if in.NewPassword != "" {
		hash, _ := s.users.PasswordHash(u.ID)
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.CurrentPassword)) != nil {
			writeErr(w, 400, "wrong_password", "current password is wrong")
			return
		}
		if err := s.setPassword(u.ID, in.NewPassword); err != nil {
			writeErr(w, 400, "invalid", err.Error())
			return
		}
	}
	nu, _ := s.getUser(u.ID)
	writeJSON(w, 200, nu)
}

func (s *Server) findInvite(token, kind string) (*inviteRow, error) {
	inv, err := s.invites.FindByToken(hashToken(token), kind)
	if err != nil {
		return nil, err
	}
	if !inv.Usable(time.Now()) {
		return nil, errors.New("invite expired or already used")
	}
	return inv, nil
}

func (s *Server) handleInviteInfo(w http.ResponseWriter, r *http.Request) {
	inv, err := s.findInvite(r.PathValue("token"), "invite")
	if err != nil {
		writeErr(w, 404, "invalid_invite", "invite not found, expired or already used")
		return
	}
	_, existsErr := s.getUserByEmail(inv.Email)
	writeJSON(w, 200, inviteInfoResponse{
		Email: inv.Email, Role: inv.Role, ClassName: inv.ClassName, InvitedBy: inv.InvitedBy,
		Locale: inv.Locale, UserExists: existsErr == nil,
	})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Name, Password, Locale string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	inv, err := s.findInvite(in.Token, "invite")
	if err != nil {
		writeErr(w, 404, "invalid_invite", "invite not found, expired or already used")
		return
	}
	locale := in.Locale
	if locale == "" {
		locale = inv.Locale
	}
	var uid int64
	if existing, err := s.getUserByEmail(inv.Email); err == nil {
		// Existing account: the invite only adds the class, but the user must
		// prove ownership with the current password.
		hash, _ := s.users.PasswordHash(existing.ID)
		if hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
			writeErr(w, 401, "invalid_credentials", "wrong password for the existing account")
			return
		}
		uid = existing.ID
	} else {
		uid, err = s.createUser(inv.Email, in.Name, in.Password, inv.Role, locale)
		if err != nil {
			writeErr(w, 400, "invalid", err.Error())
			return
		}
		subj, body := renderMail("welcome", locale, map[string]string{"site": s.general().SiteName, "name": in.Name, "link": s.baseURL(r) + "/login"})
		s.sendMailAsync(inv.Email, subj, body)
	}
	if inv.ClassID != nil {
		memberRole := "student"
		if inv.Role == "teacher" {
			memberRole = "teacher"
		}
		if _, err := s.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, *inv.ClassID, uid, memberRole, now()); err != nil {
			writeErr(w, 500, "internal", err.Error())
			return
		}
	}
	if err := s.invites.MarkAccepted(inv.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
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
	// Always answer OK so the endpoint cannot be used to enumerate accounts.
	if u, err := s.getUserByEmail(in.Email); err == nil && u.Active {
		tok := randomToken(24)
		// The answer stays OK on failure too (no enumeration); only the mail is skipped.
		_, err := s.invites.Create(domain.NewInvite{TokenHash: hashToken(tok), Kind: domain.InviteKindReset, Email: u.Email, Role: u.Role,
			Locale: u.Locale, ExpiresAt: time.Now().Add(resetLinkTTL).UTC().Format(time.RFC3339)})
		if err != nil {
			log.Printf("password reset for user %d: %v", u.ID, err)
			writeOK(w)
			return
		}
		subj, body := renderMail("reset", u.Locale, map[string]string{"site": s.general().SiteName, "name": u.Name, "link": s.baseURL(r) + "/reset-password?token=" + tok})
		s.sendMailAsync(u.Email, subj, body)
	}
	writeOK(w)
}

func (s *Server) handleReset(w http.ResponseWriter, r *http.Request) {
	var in struct{ Token, Password string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	inv, err := s.findInvite(in.Token, "reset")
	if err != nil {
		writeErr(w, 404, "invalid_token", "link expired or already used")
		return
	}
	u, err := s.getUserByEmail(inv.Email)
	if err != nil {
		writeErr(w, 404, "invalid_token", "user not found")
		return
	}
	if err := s.setPassword(u.ID, in.Password); err != nil {
		writeErr(w, 400, "invalid", err.Error())
		return
	}
	// The reset link must not stay usable and old sessions must end.
	if err := errors.Join(s.invites.MarkAccepted(inv.ID), s.logins.DeleteForUser(u.ID)); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	_ = s.startSession(w, r, u.ID)
	writeJSON(w, 200, u)
}

// createInvite stores an invite and e-mails it. It returns the registration
// link so the UI can show it when SMTP is not configured.
func (s *Server) createInvite(r *http.Request, inviter *User, email, role string, classID *int64, className, locale string) (*inviteRow, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !validEmail(email) {
		return nil, fmt.Errorf("invalid email: %s", email)
	}
	if !validRole(role) {
		return nil, errors.New("invalid role")
	}
	tok := randomToken(24)
	exp := time.Now().Add(inviteTTL).UTC().Format(time.RFC3339)
	id, err := s.invites.Create(domain.NewInvite{TokenHash: hashToken(tok), Kind: domain.InviteKindInvite, Email: email, Role: role,
		ClassID: classID, InvitedBy: &inviter.ID, Locale: normLocale(locale), ExpiresAt: exp})
	if err != nil {
		return nil, err
	}
	link := s.baseURL(r) + "/register?token=" + tok
	cls := ""
	if className != "" {
		cls = fmt.Sprintf(classPhrase[normLocale(locale)], className)
	}
	subj, body := renderMail("invite", locale, map[string]string{
		"site": s.general().SiteName, "inviter": inviter.Name, "role": roleNames[normLocale(locale)][role], "class": cls, "link": link,
	})
	sent := false
	if err := s.sendMail(email, subj, body); err == nil {
		sent = true
		logIfErr("mark invite sent", s.invites.MarkSent(id))
	}
	return &inviteRow{ID: id, Kind: "invite", Email: email, Role: role, ClassID: classID, ClassName: className, Locale: normLocale(locale), ExpiresAt: exp, EmailSent: sent, Link: link}, nil
}
