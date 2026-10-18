package httpapi

import (
	"errors"
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// managedAssignment returns the {id} assignment of the path when the
// current user may manage it; otherwise it answers 404 or 403.
func (s *Server) managedAssignment(w http.ResponseWriter, r *http.Request) (*domain.User, *domain.Assignment, bool) {
	u := currentUser(r)
	a, err := s.AssignmentSvc.Managed(u, pathID(r, "id"))
	switch {
	case errors.Is(err, app.ErrAssignmentNotFound):
		writeErr(w, 404, "not_found", err.Error())
		return nil, nil, false
	case err != nil:
		writeErr(w, 403, "forbidden", err.Error())
		return nil, nil, false
	}
	return u, a, true
}

func (s *Server) handleListAssignments(w http.ResponseWriter, r *http.Request) {
	_, classID, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	out, err := s.AssignmentSvc.ListForClass(classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleCreateAssignment(w http.ResponseWriter, r *http.Request) {
	u, classID, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	var in app.AssignmentInput
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	a, err := s.AssignmentSvc.Create(u, classID, in, s.baseURL(r))
	switch {
	case errors.Is(err, app.ErrAssignmentInvalid):
		writeErr(w, 400, "bad_request", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 201, a)
}

func (s *Server) handleUpdateAssignment(w http.ResponseWriter, r *http.Request) {
	_, a, ok := s.managedAssignment(w, r)
	if !ok {
		return
	}
	var in app.AssignmentInput
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	a, err := s.AssignmentSvc.Update(a, in, s.baseURL(r))
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, a)
}

func (s *Server) handleDeleteAssignment(w http.ResponseWriter, r *http.Request) {
	_, a, ok := s.managedAssignment(w, r)
	if !ok {
		return
	}
	if err := s.Assignments.Delete(a.ID); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleGetAssignment(w http.ResponseWriter, r *http.Request) {
	a, err := s.AssignmentSvc.Visible(currentUser(r), pathID(r, "id"))
	switch {
	case errors.Is(err, app.ErrAssignmentNotFound):
		writeErr(w, 404, "not_found", err.Error())
		return
	case err != nil:
		writeErr(w, 403, "forbidden", err.Error())
		return
	}
	writeJSON(w, 200, a)
}

func (s *Server) handleMyAssignments(w http.ResponseWriter, r *http.Request) {
	out, err := s.AssignmentSvc.ListForStudent(currentUser(r))
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}

// ---------- progress for teachers ----------

func (s *Server) handleAssignmentProgress(w http.ResponseWriter, r *http.Request) {
	_, a, ok := s.managedAssignment(w, r)
	if !ok {
		return
	}
	students, err := s.AssignmentSvc.Progress(a)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, assignmentProgressResponse{Assignment: a, Students: students})
}

// handleClassProgress returns a students × assignments matrix.
func (s *Server) handleClassProgress(w http.ResponseWriter, r *http.Request) {
	_, classID, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	cells, err := s.Sessions.BestPerStudent(classID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, classProgressResponse{Cells: cells})
}
