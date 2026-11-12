package httpapi

import (
	"context"
	"errors"
	"fmt"
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
	if !decodeLimit(w, r, &in, maxSessionBodyBytes) {
		return
	}
	ss, err := s.SessionSvc.Start(currentUser(r), in)
	switch {
	case errors.Is(err, app.ErrInvalidApp), errors.Is(err, app.ErrOtherApp), app.IsInvalid(err):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case errors.Is(err, app.ErrTooManyAttempts):
		writeErr(w, 429, "rate_limited", err.Error())
		return
	case errors.Is(err, app.ErrAssignmentForbidden):
		writeErr(w, 403, "forbidden", err.Error())
		return
	case err != nil:
		writeInternal(w, err)
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
		writeInternal(w, err)
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
	if !decodeLimit(w, r, &in, maxSessionBodyBytes) {
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
	case app.IsInvalid(err):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case err != nil:
		writeInternal(w, err)
		return
	}
	writeJSON(w, 200, resp)
}

// handleEvaluateSession grades the attempt on the server, streaming the
// evaluation as server-sent events, and hands it in with the result.
func (s *Server) handleEvaluateSession(w http.ResponseWriter, r *http.Request) {
	// One evaluation per attempt at a time (two tabs, two instances): the
	// claim comes before the attempt is read, so a second request sees the
	// attempt as the first one left it.
	claim, err := s.Gateway.Admit(evaluationClaim(pathID(r, "id")))
	if errors.Is(err, app.ErrTooManyGenerations) {
		writeErr(w, 429, "busy", "this attempt is already being evaluated")
		return
	} else if err != nil {
		writeErr(w, 503, "usage_unavailable", err.Error())
		return
	}
	defer claim()
	_, d, ok := s.ownSession(w, r)
	if !ok {
		return
	}
	if d.Status == domain.SessionCompleted {
		writeErr(w, 409, "session_completed", domain.ErrSessionCompleted.Error())
		return
	}
	var in app.EvaluationRequest
	if !decode(w, r, &in) {
		return
	}
	u, release, ok := s.admit(w, r)
	if !ok {
		return
	}
	defer release()
	send := startEventStream(w)
	// The hand-in is not lost when the browser goes away (a closed tab, a
	// dropped connection): the evaluation runs to the end, within its own
	// deadline, and is stored; the stream just stops being written.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(aiContext(r, u)), evaluationDeadline)
	defer cancel()
	ev, err := s.SessionSvc.Evaluate(ctx, u, d, in, func(delta string) error {
		_ = send(streamDelta{Delta: delta})
		return nil
	})
	if err != nil {
		_ = send(streamError{Error: err.Error()})
		return
	}
	_ = send(evaluationDone{Done: true, Evaluation: *ev})
}

// evaluationClaim is the single slot an attempt's evaluation holds while it
// runs (released at the end, or after inflightTTL if the process dies).
func evaluationClaim(sessionID int64) []app.Admission {
	return []app.Admission{{Scope: fmt.Sprintf("evaluate:%d", sessionID), Limit: 1}}
}

// handleSessionFeedback stores the teacher's written feedback and score.
func (s *Server) handleSessionFeedback(w http.ResponseWriter, r *http.Request) {
	var in domain.TeacherFeedback
	if !decode(w, r, &in) {
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
	if !decode(w, r, &in) {
		return
	}
	if err := s.SessionSvc.Complete(d, in); errors.Is(err, domain.ErrSessionCompleted) {
		writeErr(w, 409, "session_completed", err.Error())
		return
	} else if err != nil {
		writeServiceErr(w, err)
		return
	}
	writeOK(w)
}
