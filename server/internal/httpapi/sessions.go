package httpapi

import (
	"errors"
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ownSession returns the {id} session of the path when the current user
// owns it; otherwise it answers 404.
func (s *Server) ownSession(w http.ResponseWriter, r *http.Request) (*domain.User, *domain.SessionDetail, bool) {
	u := currentUser(r)
	d, owner, err := s.SessionSvc.Load(u, pathID(r, "id"))
	if err != nil || !owner {
		writeErr(w, 404, "not_found", app.ErrSessionNotFound.Error())
		return nil, nil, false
	}
	return u, d, true
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var in app.NewAttempt
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	ss, err := s.SessionSvc.Start(currentUser(r), in)
	switch {
	case errors.Is(err, app.ErrInvalidApp), errors.Is(err, app.ErrOtherApp):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case errors.Is(err, app.ErrAssignmentForbidden):
		writeErr(w, 403, "forbidden", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 201, ss)
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	d, _, err := s.SessionSvc.Load(currentUser(r), pathID(r, "id"))
	if err != nil {
		writeErr(w, 404, "not_found", err.Error())
		return
	}
	writeJSON(w, 200, d)
}

func (s *Server) handleMySessions(w http.ResponseWriter, r *http.Request) {
	out, err := s.Sessions.ListForUser(currentUser(r).ID, maxListedSessions)
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
	u, d, ok := s.ownSession(w, r)
	if !ok {
		return
	}
	var in app.TranscriptUpdate
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	resp, err := s.SessionSvc.SaveTranscript(r.Context(), u, d, in)
	switch {
	case errors.Is(err, domain.ErrStaleRevision):
		writeErr(w, 409, "stale_revision", err.Error())
		return
	case errors.Is(err, domain.ErrSessionCompleted):
		writeErr(w, 409, "session_completed", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, resp)
}

// handleSessionFeedback stores the teacher's written feedback and score.
func (s *Server) handleSessionFeedback(w http.ResponseWriter, r *http.Request) {
	var in domain.TeacherFeedback
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	d, err := s.SessionSvc.GiveFeedback(currentUser(r), pathID(r, "id"), in, s.baseURL(r))
	switch {
	case errors.Is(err, app.ErrSessionNotFound):
		writeErr(w, 404, "not_found", err.Error())
		return
	case errors.Is(err, app.ErrFeedbackForbidden):
		writeErr(w, 403, "forbidden", err.Error())
		return
	case err != nil:
		writeServiceErr(w, err)
		return
	}
	writeJSON(w, 200, d)
}

func (s *Server) handleCompleteSession(w http.ResponseWriter, r *http.Request) {
	_, d, ok := s.ownSession(w, r)
	if !ok {
		return
	}
	var in app.Completion
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if err := s.SessionSvc.Complete(d, in); err != nil {
		writeServiceErr(w, err)
		return
	}
	writeOK(w)
}
