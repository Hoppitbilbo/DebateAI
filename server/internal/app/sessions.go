package app

import (
	"errors"
	"net/http"
)

// ownSession returns the {id} session of the path when the current user
// owns it; otherwise it answers 404.
func (s *Server) ownSession(w http.ResponseWriter, r *http.Request) (*User, *SessionDetail, bool) {
	u := currentUser(r)
	d, owner, err := s.SessionSvc.Load(u, pathID(r, "id"))
	if err != nil || !owner {
		writeErr(w, 404, "not_found", errSessionNotFound.Error())
		return nil, nil, false
	}
	return u, d, true
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var in NewAttempt
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	ss, err := s.SessionSvc.Start(currentUser(r), in)
	switch {
	case errors.Is(err, errInvalidApp), errors.Is(err, errOtherApp):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case errors.Is(err, errAssignmentForbidden):
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
	var in transcriptUpdate
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	resp, err := s.SessionSvc.SaveTranscript(r.Context(), u, d, in)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, resp)
}

func (s *Server) handleCompleteSession(w http.ResponseWriter, r *http.Request) {
	_, d, ok := s.ownSession(w, r)
	if !ok {
		return
	}
	var in Completion
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if err := s.SessionSvc.Complete(d, in); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}
