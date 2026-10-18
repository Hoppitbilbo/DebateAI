package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

var appTypes = domain.AppTypes

func (s *Server) getAssignment(id int64) (*Assignment, error) { return s.assignments.Get(id) }

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

func (s *Server) handleListAssignments(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	classID := pathID(r, "id")
	if !s.canManageClass(u, classID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	out, err := s.assignments.ListForClass(classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	students := s.classes.CountStudents(classID)
	for _, a := range out {
		a.Stats = &AssignStats{
			Students:  students,
			Started:   s.sessions.CountStarted(a.ID),
			Completed: s.sessions.CountFinished(a.ID),
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
	n := domain.NewAssignment{
		ClassID: classID, Title: strings.TrimSpace(*in.Title), AppType: *in.AppType, Config: "{}", Goals: []string{},
		MinTurns: valueOr(in.MinTurns, 0), MaxTurns: valueOr(in.MaxTurns, 0),
		AutoEnd: valueOr(in.AutoEnd, true), RequireReflection: valueOr(in.RequireReflection, true),
		AllowLive: valueOr(in.AllowLive, true), Published: valueOr(in.Published, true),
		DueAt: in.DueAt, CreatedBy: u.ID,
	}
	if in.Config != nil && len(*in.Config) > 0 {
		n.Config = string(*in.Config)
	}
	if in.Goals != nil {
		n.Goals = domain.CleanGoals(*in.Goals)
	}
	if in.Instructions != nil {
		n.Instructions = strings.TrimSpace(*in.Instructions)
	}
	id, err := s.assignments.Create(n)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	a, _ := s.getAssignment(id)
	if in.Notify && a.Published {
		s.notifyAssignment(r, a)
	}
	writeJSON(w, 201, a)
}

func (s *Server) notifyAssignment(r *http.Request, a *Assignment) {
	students, err := s.classes.Students(a.ClassID)
	if err != nil {
		return
	}
	link := s.baseURL(r) + "/dashboard"
	for _, st := range students {
		if !st.Active {
			continue
		}
		email, name, locale := st.Email, st.Name, st.Locale
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
	p := domain.AssignmentPatch{
		MinTurns: in.MinTurns, MaxTurns: in.MaxTurns, AutoEnd: in.AutoEnd, RequireReflection: in.RequireReflection,
		AllowLive: in.AllowLive, Published: in.Published, DueAt: in.DueAt,
	}
	if in.Title != nil && strings.TrimSpace(*in.Title) != "" {
		p.Title = ptr(strings.TrimSpace(*in.Title))
	}
	if in.Instructions != nil {
		p.Instructions = ptr(strings.TrimSpace(*in.Instructions))
	}
	if in.AppType != nil && appTypes[*in.AppType] {
		p.AppType = in.AppType
	}
	if in.Config != nil {
		p.Config = ptr(string(*in.Config))
	}
	if in.Goals != nil {
		p.Goals = ptr(domain.CleanGoals(*in.Goals))
	}
	if err := s.assignments.Update(a.ID, p); err != nil {
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
	if err := s.assignments.Delete(a.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
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
	out, err := s.assignments.ListForStudent(u.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
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
	students, err := s.classes.Students(a.ClassID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	var out []StudentProgress
	for _, st := range students {
		out = append(out, StudentProgress{UserID: st.ID, Name: st.Name, Email: st.Email})
	}
	for i := range out {
		out[i].Session = s.bestSession(out[i].UserID, a.ID)
		out[i].AttemptCount = s.sessions.CountAttempts(out[i].UserID, a.ID)
	}
	if out == nil {
		out = []StudentProgress{}
	}
	writeJSON(w, 200, assignmentProgressResponse{Assignment: a, Students: out})
}

// handleClassProgress returns a students × assignments matrix.
func (s *Server) handleClassProgress(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	classID := pathID(r, "id")
	if !s.canManageClass(u, classID) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	cells, err := s.sessions.BestPerStudent(classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, classProgressResponse{Cells: cells})
}

// ---------- sessions ----------

func (s *Server) latestSession(userID, assignmentID int64) *SessionSummary {
	return s.sessions.Latest(userID, assignmentID)
}

func (s *Server) bestSession(userID, assignmentID int64) *SessionSummary {
	return s.sessions.Best(userID, assignmentID)
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
	n := domain.NewSession{UserID: u.ID, AppType: in.AppType, Title: truncate(in.Title, maxSessionTitleChars), Context: "{}"}
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
		n.AssignmentID = &a.ID
		// Previous unfinished attempts are closed when a new one starts.
		logIfErr("abandon empty sessions", s.sessions.AbandonEmpty(u.ID, a.ID))
	}
	if len(in.Context) > 0 {
		n.Context = string(in.Context)
	}
	id, err := s.sessions.Create(n)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	ss, _ := s.sessions.Summary(id)
	writeJSON(w, 201, ss)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func (s *Server) loadSessionForUser(u *User, id int64) (*SessionDetail, bool, error) {
	d, err := s.sessions.Detail(id)
	if err != nil {
		return nil, false, err
	}
	ss := &d.SessionSummary
	owner := ss.UserID != nil && *ss.UserID == u.ID
	if owner || u.Role == domain.RoleAdmin {
		return d, owner, nil
	}
	if ss.AssignmentID != nil {
		if a, err := s.getAssignment(*ss.AssignmentID); err == nil && s.canManageClass(u, a.ClassID) {
			return d, false, nil
		}
	}
	// teachers can see free sessions of students in their classes
	if u.Role == domain.RoleTeacher && ss.UserID != nil && s.classes.TeachesStudent(u.ID, *ss.UserID) {
		return d, false, nil
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
	out, err := s.sessions.ListForUser(u.ID, maxListedSessions)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
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
	var in transcriptUpdate
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	resp, err := s.sessionSvc.SaveTranscript(r.Context(), u, d, in)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
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
	err = s.sessions.Complete(d.ID, domain.SessionCompletion{
		Reflection: truncate(in.Reflection, maxReflectionChars), Evaluation: truncate(in.Evaluation, maxEvaluationChars),
		ScoreConversation: in.ScoreConversation, ScoreReflection: in.ScoreReflection,
	})
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}
