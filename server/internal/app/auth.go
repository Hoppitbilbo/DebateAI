package app

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const sessionCookie = "debateai_session"
const sessionTTL = 30 * 24 * time.Hour

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

const userCols = `id, email, name, role, locale, active, created_at, last_login_at`

func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	var u User
	var active int
	var last sql.NullString
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Locale, &active, &u.CreatedAt, &last); err != nil {
		return nil, err
	}
	u.Active = active == 1
	if last.Valid {
		u.LastLoginAt = &last.String
	}
	return &u, nil
}

func (s *Server) getUser(id int64) (*User, error) {
	return scanUser(s.db.QueryRow(`SELECT `+userCols+` FROM users WHERE id = ?`, id))
}

func (s *Server) getUserByEmail(email string) (*User, error) {
	return scanUser(s.db.QueryRow(`SELECT `+userCols+` FROM users WHERE email = ?`, strings.TrimSpace(email)))
}

func validEmail(e string) bool {
	a, err := mail.ParseAddress(strings.TrimSpace(e))
	return err == nil && a.Address == strings.TrimSpace(e)
}

func validRole(r string) bool { return r == "admin" || r == "teacher" || r == "student" }

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
	res, err := s.db.Exec(`INSERT INTO users(email, name, password_hash, role, locale, created_at) VALUES(?,?,?,?,?,?)`,
		email, strings.TrimSpace(name), hash, role, normLocale(locale), now())
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return 0, errors.New("email already registered")
		}
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Server) setPassword(userID int64, password string) error {
	if len(password) < 8 {
		return errors.New("password must be at least 8 characters")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, string(h), userID)
	return err
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request, userID int64) error {
	tok := randomToken(32)
	exp := time.Now().Add(sessionTTL)
	if _, err := s.db.Exec(`INSERT INTO auth_sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)`,
		hashToken(tok), userID, now(), exp.UTC().Format(time.RFC3339)); err != nil {
		return err
	}
	execOrLog(s.db, "record last login", `UPDATE users SET last_login_at = ? WHERE id = ?`, now(), userID)
	execOrLog(s.db, "purge expired sessions", `DELETE FROM auth_sessions WHERE expires_at < ?`, now())
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
	var uid int64
	var exp string
	if err := s.db.QueryRow(`SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?`, hashToken(c.Value)).Scan(&uid, &exp); err != nil {
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
	writeJSON(w, 200, map[string]any{
		"siteName":        g.SiteName,
		"defaultLocale":   g.DefaultLocale,
		"guestAccess":     g.GuestAccess,
		"guestLive":       g.GuestLive,
		"allowJoinByCode": g.AllowJoinByCode,
		"liveEnabled":     g.LiveEnabled,
		"setupRequired":   countRows(s.db, `SELECT COUNT(*) FROM users WHERE role = 'admin'`) == 0,
		"mailConfigured":  s.smtp().Host != "",
	})
}

func (s *Server) handleSetup(w http.ResponseWriter, r *http.Request) {
	if countRows(s.db, `SELECT COUNT(*) FROM users WHERE role = 'admin'`) > 0 {
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
		if err := putSetting(s.db, "general", g); err != nil {
			log.Printf("setup: default locale: %v", err)
		}
	}
	_ = s.startSession(w, r, id)
	u, _ := s.getUser(id)
	writeJSON(w, 201, u)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	if !s.limiter.allow("login:"+clientIP(r), 20, 15*time.Minute) {
		writeErr(w, 429, "rate_limited", "too many attempts, retry later")
		return
	}
	var in struct{ Email, Password string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	var id int64
	var hash string
	var active int
	err := s.db.QueryRow(`SELECT id, password_hash, active FROM users WHERE email = ?`, strings.TrimSpace(in.Email)).Scan(&id, &hash, &active)
	if err != nil || hash == "" || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		writeErr(w, 401, "invalid_credentials", "invalid email or password")
		return
	}
	if active != 1 {
		writeErr(w, 403, "disabled", "account disabled")
		return
	}
	if err := s.startSession(w, r, id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	u, _ := s.getUser(id)
	writeJSON(w, 200, u)
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		execOrLog(s.db, "logout", `DELETE FROM auth_sessions WHERE token_hash = ?`, hashToken(c.Value))
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true})
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	if u == nil {
		writeJSON(w, 200, map[string]any{"user": nil})
		return
	}
	writeJSON(w, 200, map[string]any{"user": u})
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
	b := sqlBatch{db: s.db}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		b.exec(`UPDATE users SET name = ? WHERE id = ?`, strings.TrimSpace(*in.Name), u.ID)
	}
	if in.Locale != nil {
		b.exec(`UPDATE users SET locale = ? WHERE id = ?`, normLocale(*in.Locale), u.ID)
	}
	if err := b.err; err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	if in.NewPassword != "" {
		var hash string
		_ = s.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, u.ID).Scan(&hash)
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

type inviteRow struct {
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

func (s *Server) findInvite(token, kind string) (*inviteRow, error) {
	var inv inviteRow
	var classID sql.NullInt64
	var accepted sql.NullString
	var sent int
	err := s.db.QueryRow(`SELECT i.id, i.kind, i.email, i.role, i.class_id, COALESCE(c.name,''), COALESCE(u.name,''), i.locale, i.created_at, i.expires_at, i.accepted_at, i.email_sent
		FROM invites i LEFT JOIN classes c ON c.id = i.class_id LEFT JOIN users u ON u.id = i.invited_by
		WHERE i.token_hash = ? AND i.kind = ?`, hashToken(token), kind).
		Scan(&inv.ID, &inv.Kind, &inv.Email, &inv.Role, &classID, &inv.ClassName, &inv.InvitedBy, &inv.Locale, &inv.CreatedAt, &inv.ExpiresAt, &accepted, &sent)
	if err != nil {
		return nil, err
	}
	if classID.Valid {
		inv.ClassID = &classID.Int64
	}
	if accepted.Valid {
		inv.AcceptedAt = &accepted.String
	}
	inv.EmailSent = sent == 1
	if inv.AcceptedAt != nil || time.Now().After(parseTime(inv.ExpiresAt)) {
		return nil, errors.New("invite expired or already used")
	}
	return &inv, nil
}

func (s *Server) handleInviteInfo(w http.ResponseWriter, r *http.Request) {
	inv, err := s.findInvite(r.PathValue("token"), "invite")
	if err != nil {
		writeErr(w, 404, "invalid_invite", "invite not found, expired or already used")
		return
	}
	_, existsErr := s.getUserByEmail(inv.Email)
	writeJSON(w, 200, map[string]any{
		"email": inv.Email, "role": inv.Role, "className": inv.ClassName, "invitedBy": inv.InvitedBy,
		"locale": inv.Locale, "userExists": existsErr == nil,
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
		var hash string
		_ = s.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, existing.ID).Scan(&hash)
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
	if _, err := s.db.Exec(`UPDATE invites SET accepted_at = ? WHERE id = ?`, now(), inv.ID); err != nil {
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
	if !s.limiter.allow("forgot:"+clientIP(r), 5, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many requests")
		return
	}
	var in struct{ Email string }
	_ = readJSON(r, &in)
	// Always answer OK so the endpoint cannot be used to enumerate accounts.
	if u, err := s.getUserByEmail(in.Email); err == nil && u.Active {
		tok := randomToken(24)
		// The answer stays OK on failure too (no enumeration); only the mail is skipped.
		_, err := s.db.Exec(`INSERT INTO invites(token_hash, kind, email, role, locale, created_at, expires_at) VALUES(?,?,?,?,?,?,?)`,
			hashToken(tok), "reset", u.Email, u.Role, u.Locale, now(), time.Now().Add(2*time.Hour).UTC().Format(time.RFC3339))
		if err != nil {
			log.Printf("password reset for user %d: %v", u.ID, err)
			writeJSON(w, 200, map[string]bool{"ok": true})
			return
		}
		subj, body := renderMail("reset", u.Locale, map[string]string{"site": s.general().SiteName, "name": u.Name, "link": s.baseURL(r) + "/reset-password?token=" + tok})
		s.sendMailAsync(u.Email, subj, body)
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
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
	b := sqlBatch{db: s.db}
	b.exec(`UPDATE invites SET accepted_at = ? WHERE id = ?`, now(), inv.ID)
	b.exec(`DELETE FROM auth_sessions WHERE user_id = ?`, u.ID)
	if err := b.err; err != nil {
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
	exp := time.Now().Add(14 * 24 * time.Hour).UTC().Format(time.RFC3339)
	res, err := s.db.Exec(`INSERT INTO invites(token_hash, kind, email, role, class_id, invited_by, locale, created_at, expires_at) VALUES(?,?,?,?,?,?,?,?,?)`,
		hashToken(tok), "invite", email, role, classID, inviter.ID, normLocale(locale), now(), exp)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
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
		execOrLog(s.db, "mark invite sent", `UPDATE invites SET email_sent = 1 WHERE id = ?`, id)
	}
	return &inviteRow{ID: id, Kind: "invite", Email: email, Role: role, ClassID: classID, ClassName: className, Locale: normLocale(locale), ExpiresAt: exp, EmailSent: sent, Link: link}, nil
}
