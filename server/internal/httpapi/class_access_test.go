package httpapi

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestClassAccessAndInvitationHTTP(t *testing.T) {
	s := newTestAPI(t)
	handler := s.Handler()
	newUser := func(email, role string) (*domain.User, *client) {
		t.Helper()
		id, err := s.Accounts.CreateUser(email, "Test", "password123", role, "it")
		if err != nil {
			t.Fatal(err)
		}
		u, err := s.Users.Get(id)
		if err != nil {
			t.Fatal(err)
		}
		c := newHandlerClient(t, handler)
		if code := c.do("POST", "/api/auth/login", map[string]string{"email": email, "password": "password123"}, nil); code != http.StatusOK {
			t.Fatalf("login: %d", code)
		}
		return u, c
	}
	teacher, teacherClient := newUser("teacher@test.it", domain.RoleTeacher)
	other, otherClient := newUser("other@test.it", domain.RoleTeacher)
	student, studentClient := newUser("student@test.it", domain.RoleStudent)
	class, err := s.ClassSvc.Create(teacher, "Class", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	foreign, err := s.ClassSvc.Create(other, "Foreign", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Classes.AddMember(foreign.ID, student.ID, domain.RoleStudent); err != nil {
		t.Fatal(err)
	}

	var invitation inviteResultsResponse
	if code := teacherClient.do("POST", fmtPath("/api/classes/%d/invite", class.ID), map[string]any{"emails": []string{student.Email}}, &invitation); code != http.StatusOK || len(invitation.Results) != 1 {
		t.Fatalf("invite: %d %+v", code, invitation)
	}
	if s.Classes.IsMember(class.ID, student.ID) || invitation.Results[0].Status != "invited" {
		t.Fatal("invitation enrolled the student without acceptance")
	}
	link, err := url.Parse(invitation.Results[0].Link)
	if err != nil {
		t.Fatal(err)
	}
	guest := newHandlerClient(t, handler)
	if code := guest.do("POST", "/api/auth/register", map[string]string{"token": link.Query().Get("token"), "password": "wrong"}, nil); code != http.StatusUnauthorized {
		t.Fatalf("wrong password: %d", code)
	}
	if s.Classes.IsMember(class.ID, student.ID) {
		t.Fatal("failed acceptance granted access")
	}
	if code := guest.do("POST", "/api/auth/register", map[string]string{"token": link.Query().Get("token"), "password": "password123"}, nil); code != http.StatusCreated {
		t.Fatalf("accept invitation: %d", code)
	}
	if !s.Classes.IsMember(class.ID, student.ID) {
		t.Fatal("accepted invitation did not enroll student")
	}

	title, appType := "Assignment", "wiki-chatbot"
	a, err := s.AssignmentSvc.Create(teacher, class.ID, app.AssignmentInput{Title: &title, AppType: &appType}, "")
	if err != nil {
		t.Fatal(err)
	}
	id, err := s.Sessions.Create(domain.NewSession{UserID: student.ID, AssignmentID: &a.ID, AppType: appType})
	if err != nil {
		t.Fatal(err)
	}
	path := fmtPath("/api/sessions/%d", id)
	for _, c := range []*client{teacherClient, studentClient} {
		if code := c.do("GET", path, nil, nil); code != http.StatusOK {
			t.Fatalf("authorized read: %d", code)
		}
	}
	if code := otherClient.do("GET", path, nil, nil); code != http.StatusNotFound {
		t.Fatalf("other class read: %d", code)
	}
	if code := otherClient.do("PUT", path+"/feedback", map[string]string{"feedback": "Unauthorized"}, nil); code != http.StatusNotFound {
		t.Fatalf("other class feedback: %d", code)
	}
	for _, path := range []string{fmtPath("/api/classes/%d/grades.xlsx", class.ID), fmtPath("/api/assignments/%d/grades.xlsx", a.ID)} {
		if code := otherClient.do("GET", path, nil, nil); code != http.StatusForbidden {
			t.Fatalf("other class export: %d", code)
		}
		if code := teacherClient.do("GET", path, nil, nil); code != http.StatusOK {
			t.Fatalf("own class export: %d", code)
		}
	}
}
