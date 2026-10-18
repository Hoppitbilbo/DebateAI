package app

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// canManageClass: admins, the owner, or co-teachers.
func (s *Server) canManageClass(u *User, classID int64) bool {
	return u.Role == domain.RoleAdmin || s.classes.Teaches(classID, u.ID)
}

func (s *Server) isClassMember(u *User, classID int64) bool {
	return s.classes.IsMember(classID, u.ID)
}

func (s *Server) handleListClasses(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	var out []*Class
	var err error
	if u.Role == domain.RoleAdmin && r.URL.Query().Get("mine") != "1" {
		out, err = s.classes.ListAll()
	} else {
		out, err = s.classes.ListTaughtBy(u.ID)
	}
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
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
	id, err := s.classes.Create(strings.TrimSpace(in.Name), strings.TrimSpace(in.Description), owner)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	c, _ := s.classes.Get(id)
	writeJSON(w, 201, c)
}

func (s *Server) handleGetClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	c, err := s.classes.Get(id)
	if err != nil {
		writeErr(w, 404, "not_found", "class not found")
		return
	}
	writeJSON(w, 200, classDetailResponse{Class: c, Members: s.classes.Members(id), Invites: s.invites.ListPendingForClass(id)})
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
	p := domain.ClassPatch{Archived: in.Archived}
	if in.Name != nil && strings.TrimSpace(*in.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*in.Name))
	}
	if in.Description != nil {
		p.Description = ptr(strings.TrimSpace(*in.Description))
	}
	if err := s.classes.Update(id, p); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	c, _ := s.classes.Get(id)
	writeJSON(w, 200, c)
}

func (s *Server) handleDeleteClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	if err := s.classes.Delete(id); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleRegenerateCode(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	id := pathID(r, "id")
	if !s.canManageClass(u, id) {
		writeErr(w, 403, "forbidden", "not your class")
		return
	}
	code := domain.NewJoinCode()
	if err := s.classes.SetJoinCode(id, code); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, joinCodeResponse{JoinCode: code})
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
	if in.Role == domain.RoleTeacher && u.Role != domain.RoleAdmin && !s.classes.IsOwner(id, u.ID) {
		writeErr(w, 403, "forbidden", "only the class owner can add co-teachers")
		return
	}
	locale := in.Locale
	if locale == "" {
		locale = u.Locale
	}
	className := s.classes.Name(id)

	results := []inviteResult{}
	for _, raw := range splitEmails(in.Emails) {
		if existing, err := s.getUserByEmail(raw); err == nil {
			memberRole := "student"
			if existing.Role != "student" && in.Role == "teacher" {
				memberRole = "teacher"
			}
			if err := s.classes.AddMember(id, existing.ID, memberRole); err != nil {
				results = append(results, inviteResult{Email: existing.Email, Status: "error", EmailSent: boolPtr(false), Error: err.Error()})
				continue
			}
			subj, body := renderMail("added", existing.Locale, map[string]string{"site": s.general().SiteName, "name": existing.Name, "inviter": u.Name, "class": className, "link": s.baseURL(r) + "/dashboard"})
			s.sendMailAsync(existing.Email, subj, body)
			results = append(results, inviteResult{Email: existing.Email, Status: "added", EmailSent: boolPtr(s.smtp().Host != "")})
			continue
		}
		inv, err := s.accounts.CreateInvite(Invitation{Inviter: u, Email: raw, Role: in.Role, ClassID: &id, ClassName: className, Locale: locale}, s.baseURL(r))
		if err != nil {
			results = append(results, inviteResult{Email: raw, Status: "error", EmailSent: boolPtr(false), Error: err.Error()})
			continue
		}
		results = append(results, invitedResult(inv))
	}
	writeJSON(w, 200, inviteResultsResponse{Results: results})
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
	if err := s.classes.RemoveMember(id, pathID(r, "userId")); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeOK(w)
}

func (s *Server) handleTeacherInvites(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	writeJSON(w, 200, s.invites.ListByInviter(u.ID, maxListedTeacherInvites))
}

// ---------- student side ----------

func (s *Server) handleJoinClass(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	if !s.general().AllowJoinByCode {
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
	c, err := s.classes.FindByJoinCode(domain.NormalizeJoinCode(in.Code))
	if err != nil {
		writeErr(w, 404, "invalid_code", "class code not found")
		return
	}
	if err := s.classes.AddMember(c.ID, u.ID, domain.RoleStudent); err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	writeJSON(w, 200, joinClassResponse{ClassID: c.ID, Name: c.Name})
}

func (s *Server) handleMyClasses(w http.ResponseWriter, r *http.Request) {
	u := currentUser(r)
	out, err := s.classes.ListJoinedBy(u.ID)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	for _, c := range out {
		c.JoinCode = "" // students do not need it
	}
	writeJSON(w, 200, out)
}
