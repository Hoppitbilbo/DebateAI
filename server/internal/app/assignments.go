package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var appTypes = map[string]bool{
	"convinci-tu": true, "doppia-intervista": true, "wiki-chatbot": true,
	"personaggio-misterioso": true, "impersona-tu": true, "you-moderate": true,
}

type Assignment struct {
	ID                int64           `json:"id"`
	ClassID           int64           `json:"classId"`
	ClassName         string          `json:"className"`
	Title             string          `json:"title"`
	Instructions      string          `json:"instructions"`
	AppType           string          `json:"appType"`
	Config            json.RawMessage `json:"config"`
	Goals             []string        `json:"goals"`
	MinTurns          int             `json:"minTurns"`
	MaxTurns          int             `json:"maxTurns"`
	AutoEnd           bool            `json:"autoEnd"`
	RequireReflection bool            `json:"requireReflection"`
	AllowLive         bool            `json:"allowLive"`
	Published         bool            `json:"published"`
	DueAt             *string         `json:"dueAt,omitempty"`
	CreatedAt         string          `json:"createdAt"`
	UpdatedAt         string          `json:"updatedAt"`
	MySession         *SessionSummary `json:"mySession,omitempty"`
	Stats             *AssignStats    `json:"stats,omitempty"`
}

type AssignStats struct {
	Students  int `json:"students"`
	Started   int `json:"started"`
	Completed int `json:"completed"`
}

const assignSelect = `SELECT a.id, a.class_id, c.name, a.title, a.instructions, a.app_type, a.config_json, a.goals_json,
	a.min_turns, a.max_turns, a.auto_end, a.require_reflection, a.allow_live, a.published, a.due_at, a.created_at, a.updated_at
	FROM assignments a JOIN classes c ON c.id = a.class_id`

func scanAssignment(row interface{ Scan(...any) error }) (*Assignment, error) {
	var a Assignment
	var cfg, goals string
	var autoEnd, reqRefl, allowLive, pub int
	var due sql.NullString
	if err := row.Scan(&a.ID, &a.ClassID, &a.ClassName, &a.Title, &a.Instructions, &a.AppType, &cfg, &goals,
		&a.MinTurns, &a.MaxTurns, &autoEnd, &reqRefl, &allowLive, &pub, &due, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil, err
	}
	a.Config = json.RawMessage(cfg)
	_ = json.Unmarshal([]byte(goals), &a.Goals)
	if a.Goals == nil {
		a.Goals = []string{}
	}
	a.AutoEnd, a.RequireReflection, a.AllowLive, a.Published = autoEnd == 1, reqRefl == 1, allowLive == 1, pub == 1
	if due.Valid && due.String != "" {
		a.DueAt = &due.String
	}
	return &a, nil
}

func (s *Server) getAssignment(id int64) (*Assignment, error) {
	return scanAssignment(s.db.QueryRow(assignSelect+` WHERE a.id = ?`, id))
}

type assignmentIn struct {
	Title             *string          `json:"title"`
	Instructions      *string          `json:"instructions"`
	AppType           *string          `json:"appType"`
	Config            *json.RawMessage `json:"config"`
	Goals             *[]string        `json:"goals"`
	MinTurns          *int             `json:"minTurns"`
	MaxTurns          *int             `json:"maxTurns"`
	AutoEnd           *bool            `json:"autoEnd"`
	RequireReflection *bool            `json:"requireReflection"`
	AllowLive         *bool            `json:"allowLive"`
	Published         *bool            `json:"published"`
	DueAt             *string          `json:"dueAt"`
	Notify            bool             `json:"notify"`
}

func cleanGoals(g []string) []string {
	out := []string{}
	for _, s := range g {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	if len(out) > 12 {
		out = out[:12]
	}
	return out
}

func (s *Server) handleListAssignments(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	classID := pathID(r, "id")
	if !s.canManageClass(u, classID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	rows, err := s.db.Query(assignSelect+` WHERE a.class_id = ? ORDER BY a.created_at DESC`, classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []*Assignment{}
	for rows.Next() {
		if a, err := scanAssignment(rows); err == nil {
			out = append(out, a)
		}
	}
	rows.Close()
	students := countRows(s.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND role = 'student'`, classID)
	for _, a := range out {
		a.Stats = &AssignStats{
			Students:  students,
			Started:   countRows(s.db, `SELECT COUNT(DISTINCT user_id) FROM activity_sessions WHERE assignment_id = ?`, a.ID),
			Completed: countRows(s.db, `SELECT COUNT(DISTINCT user_id) FROM activity_sessions WHERE assignment_id = ? AND status IN ('completed','goal_reached')`, a.ID),
		}
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleCreateAssignment(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	classID := pathID(r, "id")
	if !s.canManageClass(u, classID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	var in assignmentIn
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if in.Title == nil || strings.TrimSpace(*in.Title) == "" || in.AppType == nil || !appTypes[*in.AppType] {
		writeErr(w, 400, "bad_request", "title and a valid appType are required")
		return
	}
	cfg := "{}"
	if in.Config != nil && len(*in.Config) > 0 {
		cfg = string(*in.Config)
	}
	goals := []string{}
	if in.Goals != nil {
		goals = cleanGoals(*in.Goals)
	}
	get := func(p *int, d int) int {
		if p == nil {
			return d
		}
		return *p
	}
	getb := func(p *bool, d bool) int {
		if p == nil {
			return boolInt(d)
		}
		return boolInt(*p)
	}
	instr := ""
	if in.Instructions != nil {
		instr = strings.TrimSpace(*in.Instructions)
	}
	var due any
	if in.DueAt != nil && *in.DueAt != "" {
		due = *in.DueAt
	}
	res, err := s.db.Exec(`INSERT INTO assignments(class_id, title, instructions, app_type, config_json, goals_json, min_turns, max_turns, auto_end, require_reflection, allow_live, published, due_at, created_by, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		classID, strings.TrimSpace(*in.Title), instr, *in.AppType, cfg, mustJSON(goals), get(in.MinTurns, 0), get(in.MaxTurns, 0),
		getb(in.AutoEnd, true), getb(in.RequireReflection, true), getb(in.AllowLive, true), getb(in.Published, true), due, u.ID, now(), now())
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	id, _ := res.LastInsertId()
	a, _ := s.getAssignment(id)
	if in.Notify && a.Published {
		s.notifyAssignment(r, a)
	}
	writeJSON(w, 201, a)
}

func (s *Server) notifyAssignment(r *http.Request, a *Assignment) {
	rows, err := s.db.Query(`SELECT u.email, u.name, u.locale FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student' AND u.active = 1`, a.ClassID)
	if err != nil {
		return
	}
	defer rows.Close()
	link := s.baseURL(r) + "/dashboard"
	for rows.Next() {
		var email, name, locale string
		if rows.Scan(&email, &name, &locale) != nil {
			continue
		}
		due := ""
		if a.DueAt != nil {
			if t, err := time.Parse(time.RFC3339, *a.DueAt); err == nil {
				due = fmt.Sprintf(duePhrase[normLocale(locale)], t.Format("02/01/2006 15:04"))
			} else {
				due = fmt.Sprintf(duePhrase[normLocale(locale)], *a.DueAt)
			}
		}
		subj, body := renderMail("assignment", locale, map[string]string{"site": s.general().SiteName, "name": name, "class": a.ClassName, "title": a.Title, "due": due, "link": link})
		s.sendMailAsync(email, subj, body)
	}
}

func (s *Server) handleUpdateAssignment(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	a, err := s.getAssignment(pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", "assignment not found")
		return
	}
	if !s.canManageClass(u, a.ClassID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	var in assignmentIn
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	wasPublished := a.Published
	b := sqlBatch{db: s.db}
	set := func(col string, v any) {
		b.exec(`UPDATE assignments SET `+col+` = ?, updated_at = ? WHERE id = ?`, v, now(), a.ID)
	}
	if in.Title != nil && strings.TrimSpace(*in.Title) != "" {
		set("title", strings.TrimSpace(*in.Title))
	}
	if in.Instructions != nil {
		set("instructions", strings.TrimSpace(*in.Instructions))
	}
	if in.AppType != nil && appTypes[*in.AppType] {
		set("app_type", *in.AppType)
	}
	if in.Config != nil {
		set("config_json", string(*in.Config))
	}
	if in.Goals != nil {
		set("goals_json", mustJSON(cleanGoals(*in.Goals)))
	}
	if in.MinTurns != nil {
		set("min_turns", *in.MinTurns)
	}
	if in.MaxTurns != nil {
		set("max_turns", *in.MaxTurns)
	}
	if in.AutoEnd != nil {
		set("auto_end", boolInt(*in.AutoEnd))
	}
	if in.RequireReflection != nil {
		set("require_reflection", boolInt(*in.RequireReflection))
	}
	if in.AllowLive != nil {
		set("allow_live", boolInt(*in.AllowLive))
	}
	if in.Published != nil {
		set("published", boolInt(*in.Published))
	}
	if in.DueAt != nil {
		if *in.DueAt == "" {
			set("due_at", nil)
		} else {
			set("due_at", *in.DueAt)
		}
	}
	if err := b.err; err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	a, _ = s.getAssignment(a.ID)
	if in.Notify && a.Published && !wasPublished {
		s.notifyAssignment(r, a)
	}
	writeJSON(w, 200, a)
}

func (s *Server) handleDeleteAssignment(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	a, err := s.getAssignment(pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", "assignment not found")
		return
	}
	if !s.canManageClass(u, a.ClassID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	if _, err := s.db.Exec(`DELETE FROM assignments WHERE id = ?`, a.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

func (s *Server) handleGetAssignment(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	a, err := s.getAssignment(pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", "assignment not found")
		return
	}
	manage := s.canManageClass(u, a.ClassID)
	if !manage && (!s.isClassMember(u, a.ClassID) || !a.Published) {
		writeErr(w, 403, "forbidden", "not assigned to you")
		return
	}
	a.MySession = s.latestSession(u.ID, a.ID)
	writeJSON(w, 200, a)
}

func (s *Server) handleMyAssignments(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.db.Query(assignSelect+` WHERE a.published = 1 AND c.archived = 0 AND a.class_id IN (SELECT class_id FROM class_members WHERE user_id = ? AND role = 'student')
		ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END, a.due_at, a.created_at DESC`, u.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []*Assignment{}
	for rows.Next() {
		if a, err := scanAssignment(rows); err == nil {
			out = append(out, a)
		}
	}
	rows.Close()
	for _, a := range out {
		a.MySession = s.latestSession(u.ID, a.ID)
	}
	writeJSON(w, 200, out)
}

// ---------- progress for teachers ----------

type StudentProgress struct {
	UserID       int64           `json:"userId"`
	Name         string          `json:"name"`
	Email        string          `json:"email"`
	Session      *SessionSummary `json:"session,omitempty"`
	AttemptCount int             `json:"attemptCount"`
}

func (s *Server) handleAssignmentProgress(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	a, err := s.getAssignment(pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", "assignment not found")
		return
	}
	if !s.canManageClass(u, a.ClassID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	rows, err := s.db.Query(`SELECT u.id, u.name, u.email FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student' ORDER BY u.name`, a.ClassID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	var out []StudentProgress
	for rows.Next() {
		var p StudentProgress
		if rows.Scan(&p.UserID, &p.Name, &p.Email) == nil {
			out = append(out, p)
		}
	}
	rows.Close()
	for i := range out {
		out[i].Session = s.bestSession(out[i].UserID, a.ID)
		out[i].AttemptCount = countRows(s.db, `SELECT COUNT(*) FROM activity_sessions WHERE user_id = ? AND assignment_id = ?`, out[i].UserID, a.ID)
	}
	if out == nil {
		out = []StudentProgress{}
	}
	writeJSON(w, 200, map[string]any{"assignment": a, "students": out})
}

// handleClassProgress returns a students × assignments matrix.
func (s *Server) handleClassProgress(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	classID := pathID(r, "id")
	if !s.canManageClass(u, classID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	type cell struct {
		AssignmentID int64   `json:"assignmentId"`
		UserID       int64   `json:"userId"`
		Status       string  `json:"status"`
		Progress     int     `json:"progress"`
		SessionID    int64   `json:"sessionId"`
		Score        *int    `json:"score,omitempty"`
		CostUSD      float64 `json:"costUsd"`
	}
	// best session per (user, assignment): completed first, then highest progress
	rows, err := s.db.Query(`SELECT s.assignment_id, s.user_id, s.status, s.progress, s.id, s.score_conversation, s.cost_usd FROM activity_sessions s
		JOIN assignments a ON a.id = s.assignment_id WHERE a.class_id = ?
		ORDER BY CASE s.status WHEN 'completed' THEN 0 WHEN 'goal_reached' THEN 1 ELSE 2 END, s.progress DESC, s.updated_at DESC`, classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	seen := map[string]bool{}
	cells := []cell{}
	for rows.Next() {
		var c cell
		var score sql.NullInt64
		if rows.Scan(&c.AssignmentID, &c.UserID, &c.Status, &c.Progress, &c.SessionID, &score, &c.CostUSD) != nil {
			continue
		}
		k := fmt.Sprintf("%d:%d", c.AssignmentID, c.UserID)
		if seen[k] {
			continue
		}
		seen[k] = true
		if score.Valid {
			v := int(score.Int64)
			c.Score = &v
		}
		cells = append(cells, c)
	}
	writeJSON(w, 200, map[string]any{"cells": cells})
}

// ---------- sessions ----------

type SessionSummary struct {
	ID                int64   `json:"id"`
	UserID            *int64  `json:"userId,omitempty"`
	UserName          string  `json:"userName,omitempty"`
	AssignmentID      *int64  `json:"assignmentId,omitempty"`
	AssignmentTitle   string  `json:"assignmentTitle,omitempty"`
	AppType           string  `json:"appType"`
	Title             string  `json:"title"`
	Status            string  `json:"status"`
	Turns             int     `json:"turns"`
	Progress          int     `json:"progress"`
	ScoreConversation *int    `json:"scoreConversation,omitempty"`
	ScoreReflection   *int    `json:"scoreReflection,omitempty"`
	CostUSD           float64 `json:"costUsd"`
	StartedAt         string  `json:"startedAt"`
	UpdatedAt         string  `json:"updatedAt"`
	CompletedAt       *string `json:"completedAt,omitempty"`
}

type SessionDetail struct {
	SessionSummary
	Context    json.RawMessage `json:"context"`
	Transcript json.RawMessage `json:"transcript"`
	Jev        json.RawMessage `json:"jev"`
	Reflection string          `json:"reflection"`
	Evaluation string          `json:"evaluation"`
}

const sessionSummaryCols = `s.id, s.user_id, COALESCE(u.name,''), s.assignment_id, COALESCE(a.title,''), s.app_type, s.title, s.status, s.turns, s.progress,
	s.score_conversation, s.score_reflection, s.cost_usd, s.started_at, s.updated_at, s.completed_at`
const sessionFrom = ` FROM activity_sessions s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN assignments a ON a.id = s.assignment_id`

func scanSummary(row interface{ Scan(...any) error }, extra ...any) (*SessionSummary, error) {
	var ss SessionSummary
	var uid, aid, sc, sr sql.NullInt64
	var comp sql.NullString
	dest := []any{&ss.ID, &uid, &ss.UserName, &aid, &ss.AssignmentTitle, &ss.AppType, &ss.Title, &ss.Status, &ss.Turns, &ss.Progress, &sc, &sr, &ss.CostUSD, &ss.StartedAt, &ss.UpdatedAt, &comp}
	if err := row.Scan(append(dest, extra...)...); err != nil {
		return nil, err
	}
	if uid.Valid {
		ss.UserID = &uid.Int64
	}
	if aid.Valid {
		ss.AssignmentID = &aid.Int64
	}
	if sc.Valid {
		v := int(sc.Int64)
		ss.ScoreConversation = &v
	}
	if sr.Valid {
		v := int(sr.Int64)
		ss.ScoreReflection = &v
	}
	if comp.Valid {
		ss.CompletedAt = &comp.String
	}
	return &ss, nil
}

func (s *Server) latestSession(userID, assignmentID int64) *SessionSummary {
	ss, err := scanSummary(s.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ? ORDER BY s.started_at DESC LIMIT 1`, userID, assignmentID))
	if err != nil {
		return nil
	}
	return ss
}

func (s *Server) bestSession(userID, assignmentID int64) *SessionSummary {
	ss, err := scanSummary(s.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ?
		ORDER BY CASE s.status WHEN 'completed' THEN 0 WHEN 'goal_reached' THEN 1 ELSE 2 END, s.progress DESC, s.updated_at DESC LIMIT 1`, userID, assignmentID))
	if err != nil {
		return nil
	}
	return ss
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var in struct {
		AppType      string          `json:"appType"`
		AssignmentID int64           `json:"assignmentId"`
		Title        string          `json:"title"`
		Context      json.RawMessage `json:"context"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if !appTypes[in.AppType] {
		writeErr(w, 400, "bad_request", "invalid appType")
		return
	}
	var aid any
	if in.AssignmentID > 0 {
		a, err := s.getAssignment(in.AssignmentID)
		if err != nil || (!s.canManageClass(u, a.ClassID) && (!s.isClassMember(u, a.ClassID) || !a.Published)) {
			writeErr(w, 403, "forbidden", "assignment not available")
			return
		}
		if a.AppType != in.AppType {
			writeErr(w, 400, "bad_request", "assignment is for another app")
			return
		}
		aid = a.ID
		// Previous unfinished attempts are closed when a new one starts.
		execOrLog(s.db, "abandon empty sessions", `UPDATE activity_sessions SET status = 'abandoned', updated_at = ? WHERE user_id = ? AND assignment_id = ? AND status = 'active' AND turns = 0`, now(), u.ID, a.ID)
	}
	ctx := "{}"
	if len(in.Context) > 0 {
		ctx = string(in.Context)
	}
	res, err := s.db.Exec(`INSERT INTO activity_sessions(user_id, assignment_id, app_type, title, context_json, started_at, updated_at) VALUES(?,?,?,?,?,?,?)`,
		u.ID, aid, in.AppType, truncate(in.Title, 200), ctx, now(), now())
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	id, _ := res.LastInsertId()
	ss, _ := scanSummary(s.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.id = ?`, id))
	writeJSON(w, 201, ss)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func (s *Server) loadSessionForUser(u *User, id int64) (*SessionDetail, bool, error) {
	var d SessionDetail
	var ctx, tr, jev string
	ss, err := scanSummary(s.db.QueryRow(`SELECT `+sessionSummaryCols+`, s.context_json, s.transcript_json, s.jev_json, s.reflection, s.evaluation`+sessionFrom+` WHERE s.id = ?`, id),
		&ctx, &tr, &jev, &d.Reflection, &d.Evaluation)
	if err != nil {
		return nil, false, err
	}
	d.SessionSummary = *ss
	d.Context, d.Transcript, d.Jev = json.RawMessage(ctx), json.RawMessage(tr), json.RawMessage(jev)
	owner := ss.UserID != nil && *ss.UserID == u.ID
	if owner || u.Role == "admin" {
		return &d, owner, nil
	}
	if ss.AssignmentID != nil {
		if a, err := s.getAssignment(*ss.AssignmentID); err == nil && s.canManageClass(u, a.ClassID) {
			return &d, false, nil
		}
	}
	// teachers can see free sessions of students in their classes
	if u.Role == "teacher" && ss.UserID != nil && countRows(s.db, `SELECT COUNT(*) FROM class_members m1 JOIN class_members m2 ON m1.class_id = m2.class_id
		WHERE m1.user_id = ? AND m1.role = 'teacher' AND m2.user_id = ?`, u.ID, *ss.UserID) > 0 {
		return &d, false, nil
	}
	return nil, false, fmt.Errorf("forbidden")
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	d, _, err := s.loadSessionForUser(currentUser(r), pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", "session not found")
		return
	}
	writeJSON(w, 200, d)
}

func (s *Server) handleMySessions(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	rows, err := s.db.Query(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND (s.turns > 0 OR s.status != 'abandoned') ORDER BY s.started_at DESC LIMIT 100`, u.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	defer rows.Close()
	out := []*SessionSummary{}
	for rows.Next() {
		if ss, err := scanSummary(rows); err == nil {
			out = append(out, ss)
		}
	}
	writeJSON(w, 200, out)
}

// handleSaveTranscript stores the conversation and, for assignments, asks the
// JEV judge whether the teacher's goals are reached. The response tells the
// client whether the activity must end.
func (s *Server) handleSaveTranscript(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	d, owner, err := s.loadSessionForUser(u, pathID(r, "id"))
	if err != nil || !owner {
		writeErr(w, 404, "not_found", "session not found")
		return
	}
	var in struct {
		Messages []transcriptMsg `json:"messages"`
		Context  json.RawMessage `json:"context"`
		Judge    *bool           `json:"judge"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if len(in.Messages) > 1000 {
		in.Messages = in.Messages[len(in.Messages)-1000:]
	}
	turns := 0
	for _, m := range in.Messages {
		if m.Role == "user" && strings.TrimSpace(m.Content) != "" {
			turns++
		}
	}
	status := d.Status
	b := sqlBatch{db: s.db}
	b.exec(`UPDATE activity_sessions SET transcript_json = ?, turns = ?, updated_at = ? WHERE id = ?`, mustJSON(in.Messages), turns, now(), d.ID)
	if len(in.Context) > 0 {
		b.exec(`UPDATE activity_sessions SET context_json = ? WHERE id = ?`, string(in.Context), d.ID)
	}
	if err := b.err; err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}

	resp := map[string]any{"status": status, "turns": turns, "progress": d.Progress, "ended": status != "active"}
	if d.AssignmentID == nil || status != "active" {
		writeJSON(w, 200, resp)
		return
	}
	a, err := s.getAssignment(*d.AssignmentID)
	if err != nil {
		writeJSON(w, 200, resp)
		return
	}
	resp["maxTurns"] = a.MaxTurns
	reason := ""

	js := s.jevSettings()
	every := js.EvaluateEvery
	if every < 1 {
		every = 1
	}
	shouldJudge := turns > 0 && (turns%every == 0 || (a.MaxTurns > 0 && turns >= a.MaxTurns))
	if in.Judge != nil {
		shouldJudge = *in.Judge && turns > 0
	}
	if shouldJudge {
		ctxText := ""
		if len(in.Context) > 0 {
			ctxText = string(in.Context)
		} else {
			ctxText = string(d.Context)
		}
		ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
		jr := s.judge(ctx, judgeInput{Instructions: a.Instructions, Goals: a.Goals, AppType: a.AppType, Context: truncate(ctxText, 2000),
			Transcript: in.Messages, Locale: u.Locale, MinTurns: a.MinTurns, Turns: turns}, &u.ID, &d.ID)
		cancel()
		resp["jev"] = jr
		if jr.Engine != "none" {
			if _, err := s.db.Exec(`UPDATE activity_sessions SET jev_json = ?, progress = ? WHERE id = ?`, mustJSON(jr), jr.Progress, d.ID); err != nil {
				writeErr(w, 500, "internal", err.Error())
				return
			}
			resp["progress"] = jr.Progress
			if jr.Completed && a.AutoEnd {
				status, reason = "goal_reached", "goal_reached"
			}
		}
	}
	if status == "active" && a.MaxTurns > 0 && turns >= a.MaxTurns {
		status, reason = "turn_limit", "turn_limit"
	}
	if status != "active" {
		if _, err := s.db.Exec(`UPDATE activity_sessions SET status = ?, updated_at = ? WHERE id = ?`, status, now(), d.ID); err != nil {
			writeErr(w, 500, "internal", err.Error())
			return
		}
	}
	resp["status"] = status
	resp["ended"] = status != "active"
	resp["reason"] = reason
	writeJSON(w, 200, resp)
}

func (s *Server) handleCompleteSession(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	d, owner, err := s.loadSessionForUser(u, pathID(r, "id"))
	if err != nil || !owner {
		writeErr(w, 404, "not_found", "session not found")
		return
	}
	var in struct {
		Reflection        string `json:"reflection"`
		Evaluation        string `json:"evaluation"`
		ScoreConversation *int   `json:"scoreConversation"`
		ScoreReflection   *int   `json:"scoreReflection"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	_, err = s.db.Exec(`UPDATE activity_sessions SET status = 'completed', reflection = ?, evaluation = ?, score_conversation = ?, score_reflection = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
		truncate(in.Reflection, 20000), truncate(in.Evaluation, 40000), in.ScoreConversation, in.ScoreReflection, now(), now(), d.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}
