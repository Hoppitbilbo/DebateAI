package httpapi

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// managedClass returns the {id} of the path when the current user may
// manage that class; otherwise it answers 403 and ok is false.
func (s *Server) managedClass(w http.ResponseWriter, r *http.Request) (u *domain.User, id int64, ok bool) {
	u, id = currentUser(r), pathID(r, "id")
	if !s.ClassSvc.CanManage(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return nil, 0, false
	}
	return u, id, true
}

func (s *Server) handleListClasses(w http.ResponseWriter, r *http.Request) {
	out, err := s.ClassSvc.List(currentUser(r), r.URL.Query().Get("mine") == "1")
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}

func (s *Server) handleCreateClass(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name, Description string
		OwnerID           *int64 `json:"ownerId"`
	}
	if err := readJSON(r, &in); err != nil || strings.TrimSpace(in.Name) == "" {
		writeErr(w, 400, "bad_request", "name required")
		return
	}
	c, err := s.ClassSvc.Create(currentUser(r), in.Name, in.Description, in.OwnerID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 201, c)
}

func (s *Server) handleGetClass(w http.ResponseWriter, r *http.Request) {
	_, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	c, err := s.Classes.Get(id)
	if err != nil {
		writeErr(w, 404, "not_found", "class not found")
		return
	}
	writeJSON(w, 200, classDetailResponse{Class: c, Members: s.Classes.Members(id), Invites: s.Invites.ListPendingForClass(id)})
}

func (s *Server) handleUpdateClass(w http.ResponseWriter, r *http.Request) {
	_, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	var in app.ClassChange
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	c, err := s.ClassSvc.Update(id, in)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, c)
}

func (s *Server) handleDeleteClass(w http.ResponseWriter, r *http.Request) {
	_, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	if err := s.Classes.Delete(id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleRegenerateCode(w http.ResponseWriter, r *http.Request) {
	_, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	code, err := s.ClassSvc.RegenerateCode(id)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, joinCodeResponse{JoinCode: code})
}

// handleClassInvite invites a list of e-mails. Existing users are added to the
// class immediately (and notified); new addresses receive a registration link.
func (s *Server) handleClassInvite(w http.ResponseWriter, r *http.Request) {
	u, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	var in app.MemberInvitation
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	results, err := s.ClassSvc.Invite(u, id, in, s.baseURL(r))
	switch {
	case errors.Is(err, app.ErrBadMemberRole):
		writeErr(w, 400, "bad_role", err.Error())
		return
	case errors.Is(err, app.ErrOnlyOwner):
		writeErr(w, 403, "forbidden", err.Error())
		return
	}
	writeJSON(w, 200, inviteResultsResponse{Results: results})
}

func (s *Server) handleRemoveMember(w http.ResponseWriter, r *http.Request) {
	_, id, ok := s.managedClass(w, r)
	if !ok {
		return
	}
	if err := s.Classes.RemoveMember(id, pathID(r, "userId")); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleTeacherInvites(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, s.Invites.ListByInviter(currentUser(r).ID, maxListedTeacherInvites))
}

// ---------- student side ----------

func (s *Server) handleJoinClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.Settings.General().AllowJoinByCode {
		writeErr(w, 403, "disabled", "joining by code is disabled")
		return
	}
	if !s.limiter.allow(fmt.Sprintf("join:%d", u.ID), joinAttemptsLimit, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many attempts")
		return
	}
	var in struct{ Code string }
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	c, err := s.ClassSvc.Join(u, in.Code)
	switch {
	case errors.Is(err, app.ErrInvalidCode):
		writeErr(w, 404, "invalid_code", err.Error())
		return
	case err != nil:
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, joinClassResponse{ClassID: c.ID, Name: c.Name})
}

func (s *Server) handleMyClasses(w http.ResponseWriter, r *http.Request) {
	out, err := s.ClassSvc.Joined(currentUser(r))
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, out)
}
