package app

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"
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

type Member struct {
	UserID      int64   `json:"userId"`
	Name        string  `json:"name"`
	Email       string  `json:"email"`
	Role        string  `json:"role"`
	JoinedAt    string  `json:"joinedAt"`
	LastLoginAt *string `json:"lastLoginAt,omitempty"`
}

const classSelect = `SELECT c.id, c.name, c.description, c.join_code, c.owner_id, COALESCE(u.name,''), c.archived, c.created_at,
	(SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id AND m.role = 'student'),
	(SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id AND m.role = 'teacher'),
	(SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id)
	FROM classes c LEFT JOIN users u ON u.id = c.owner_id`

func scanClass(row interface{ Scan(...any) error }) (*Class, error) {
	var c Class
	var owner sql.NullInt64
	var archived int
	if err := row.Scan(&c.ID, &c.Name, &c.Description, &c.JoinCode, &owner, &c.OwnerName, &archived, &c.CreatedAt, &c.StudentCount, &c.TeacherCount, &c.Assignments); err != nil {
		return nil, err
	}
	if owner.Valid {
		c.OwnerID = &owner.Int64
	}
	c.Archived = archived == 1
	return &c, nil
}

// joinCode avoids ambiguous characters (0/O, 1/I/L).
func newJoinCode() string {
	const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
	b := []byte(randomToken(16))
	out := make([]byte, 6)
	for i := range out {
		out[i] = alphabet[int(b[i])%len(alphabet)]
	}
	return string(out)
}

// canManageClass: admins, the owner, or co-teachers.
func (s *Server) canManageClass(u *User, classID int64) bool {
	if u.Role == "admin" {
		return true
	}
	return countRows(s.db, `SELECT COUNT(*) FROM classes WHERE id = ? AND owner_id = ?`, classID, u.ID) > 0 ||
		countRows(s.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND user_id = ? AND role = 'teacher'`, classID, u.ID) > 0
}

func (s *Server) isClassMember(u *User, classID int64) bool {
	return countRows(s.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND user_id = ?`, classID, u.ID) > 0
}

func (s *Server) handleListClasses(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var rows *sql.Rows
	var err error
	if u.Role == "admin" && r.URL.Query().Get("mine") != "1" {
		rows, err = s.db.Query(classSelect + ` ORDER BY c.archived, c.created_at DESC`)
	} else {
		rows, err = s.db.Query(classSelect+` WHERE c.owner_id = ? OR c.id IN (SELECT class_id FROM class_members WHERE user_id = ? AND role = 'teacher') ORDER BY c.archived, c.created_at DESC`, u.ID, u.ID)
	}
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []*Class{}
	for rows.Next() {
		if c, err := scanClass(rows); err == nil {
			out = append(out, c)
		}
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleCreateClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		Name, Description string
		OwnerID           *int64 `json:"ownerId"`
	}
	if err := readJSON(r, &in); err != nil || strings.TrimSpace(in.Name) == "" {
		writeErr(w, 400, "bad_request", "name required")
		return
	}
	owner := u.ID
	if u.Role == "admin" && in.OwnerID != nil {
		owner = *in.OwnerID
	}
	var id int64
	for i := 0; i < 5; i++ {
		res, err := s.db.Exec(`INSERT INTO classes(name, description, join_code, owner_id, created_at) VALUES(?,?,?,?,?)`,
			strings.TrimSpace(in.Name), strings.TrimSpace(in.Description), newJoinCode(), owner, now())
		if err == nil {
			id, _ = res.LastInsertId()
			break
		}
	}
	if id == 0 {
		writeErr(w, 500, "internal", "could not create class")
		return
	}
	_, _ = s.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, id, owner, "teacher", now())
	c, _ := scanClass(s.db.QueryRow(classSelect+` WHERE c.id = ?`, id))
	writeJSON(w, 201, c)
}

func (s *Server) handleGetClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	c, err := scanClass(s.db.QueryRow(classSelect+` WHERE c.id = ?`, id))
	if err != nil {
		writeErr(w, 404, "not_found", "class not found")
		return
	}
	rows, err := s.db.Query(`SELECT u.id, u.name, u.email, m.role, m.joined_at, u.last_login_at FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? ORDER BY m.role DESC, u.name`, id)
	members := []Member{}
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var m Member
			var last sql.NullString
			if rows.Scan(&m.UserID, &m.Name, &m.Email, &m.Role, &m.JoinedAt, &last) == nil {
				if last.Valid {
					m.LastLoginAt = &last.String
				}
				members = append(members, m)
			}
		}
	}
	invites := s.listInvites(`WHERE i.kind = 'invite' AND i.class_id = ? AND i.accepted_at IS NULL`, id)
	writeJSON(w, 200, map[string]any{"class": c, "members": members, "invites": invites})
}

func (s *Server) handleUpdateClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	var in struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		Archived    *bool   `json:"archived"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		_, _ = s.db.Exec(`UPDATE classes SET name = ? WHERE id = ?`, strings.TrimSpace(*in.Name), id)
	}
	if in.Description != nil {
		_, _ = s.db.Exec(`UPDATE classes SET description = ? WHERE id = ?`, strings.TrimSpace(*in.Description), id)
	}
	if in.Archived != nil {
		_, _ = s.db.Exec(`UPDATE classes SET archived = ? WHERE id = ?`, boolInt(*in.Archived), id)
	}
	c, _ := scanClass(s.db.QueryRow(classSelect+` WHERE c.id = ?`, id))
	writeJSON(w, 200, c)
}

func (s *Server) handleDeleteClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	_, _ = s.db.Exec(`DELETE FROM classes WHERE id = ?`, id)
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleRegenerateCode(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	code := newJoinCode()
	if _, err := s.db.Exec(`UPDATE classes SET join_code = ? WHERE id = ?`, code, id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"joinCode": code})
}

// handleClassInvite invites a list of e-mails. Existing users are added to the
// class immediately (and notified); new addresses receive a registration link.
func (s *Server) handleClassInvite(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	var in struct {
		Emails []string `json:"emails"`
		Role   string   `json:"role"`
		Locale string   `json:"locale"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if in.Role == "" {
		in.Role = "student"
	}
	if in.Role != "student" && in.Role != "teacher" {
		writeErr(w, 400, "bad_role", "role must be student or teacher")
		return
	}
	if in.Role == "teacher" && u.Role != "admin" && countRows(s.db, `SELECT COUNT(*) FROM classes WHERE id = ? AND owner_id = ?`, id, u.ID) == 0 {
		writeErr(w, 403, "forbidden", "only the class owner can add co-teachers")
		return
	}
	locale := in.Locale
	if locale == "" {
		locale = u.Locale
	}
	var className string
	_ = s.db.QueryRow(`SELECT name FROM classes WHERE id = ?`, id).Scan(&className)

	type result struct {
		Email     string `json:"email"`
		Status    string `json:"status"` // added | invited | error
		EmailSent bool   `json:"emailSent"`
		Link      string `json:"link,omitempty"`
		Error     string `json:"error,omitempty"`
	}
	results := []result{}
	for _, raw := range splitEmails(in.Emails) {
		if existing, err := s.getUserByEmail(raw); err == nil {
			memberRole := "student"
			if existing.Role != "student" && in.Role == "teacher" {
				memberRole = "teacher"
			}
			_, _ = s.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, id, existing.ID, memberRole, now())
			subj, body := renderMail("added", existing.Locale, map[string]string{"site": s.general().SiteName, "name": existing.Name, "inviter": u.Name, "class": className, "link": s.baseURL(r) + "/dashboard"})
			s.sendMailAsync(existing.Email, subj, body)
			results = append(results, result{Email: existing.Email, Status: "added", EmailSent: s.smtp().Host != ""})
			continue
		}
		inv, err := s.createInvite(r, u, raw, in.Role, &id, className, locale)
		if err != nil {
			results = append(results, result{Email: raw, Status: "error", Error: err.Error()})
			continue
		}
		results = append(results, result{Email: inv.Email, Status: "invited", EmailSent: inv.EmailSent, Link: inv.Link})
	}
	writeJSON(w, 200, map[string]any{"results": results})
}

func splitEmails(in []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, chunk := range in {
		for _, e := range strings.FieldsFunc(chunk, func(r rune) bool { return r == ',' || r == ';' || r == '\n' || r == ' ' || r == '\t' }) {
			e = strings.ToLower(strings.Trim(strings.TrimSpace(e), "<>\""))
			if e != "" && !seen[e] {
				seen[e] = true
				out = append(out, e)
			}
		}
	}
	return out
}

func (s *Server) handleRemoveMember(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	_, _ = s.db.Exec(`DELETE FROM class_members WHERE class_id = ? AND user_id = ?`, id, pathID(r, "userId"))
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleTeacherInvites(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	writeJSON(w, 200, s.listInvites(`WHERE i.kind = 'invite' AND i.invited_by = ? ORDER BY i.created_at DESC LIMIT 200`, u.ID))
}

// ---------- student side ----------

func (s *Server) handleJoinClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.general().AllowJoinByCode {
		writeErr(w, 403, "disabled", "joining by code is disabled")
		return
	}
	if !s.limiter.allow(fmt.Sprintf("join:%d", u.ID), 20, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many attempts")
		return
	}
	var in struct{ Code string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	var id int64
	var name string
	if err := s.db.QueryRow(`SELECT id, name FROM classes WHERE join_code = ? AND archived = 0`, strings.ToUpper(strings.TrimSpace(in.Code))).Scan(&id, &name); err != nil {
		writeErr(w, 404, "invalid_code", "class code not found")
		return
	}
	_, _ = s.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, id, u.ID, "student", now())
	writeJSON(w, 200, map[string]any{"classId": id, "name": name})
}

func (s *Server) handleMyClasses(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.db.Query(classSelect+` WHERE c.id IN (SELECT class_id FROM class_members WHERE user_id = ?) AND c.archived = 0 ORDER BY c.name`, u.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []*Class{}
	for rows.Next() {
		if c, err := scanClass(rows); err == nil {
			c.JoinCode = "" // students do not need it
			out = append(out, c)
		}
	}
	writeJSON(w, 200, out)
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
