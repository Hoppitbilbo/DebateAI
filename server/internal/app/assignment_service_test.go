package app

import (
	"errors"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// visibilityFixture: a class with an owner, a student and an unpublished
// assignment, plus a teacher of another class.
func visibilityFixture(t *testing.T) (s *Server, owner, stranger, stud *User, a *Assignment) {
	s = newTestServer(t)
	user := func(email, role string) *User {
		id, err := s.Accounts.CreateUser(email, "", "", role, "it")
		if err != nil {
			t.Fatal(err)
		}
		u, _ := s.Users.Get(id)
		return u
	}
	owner, stranger, stud = user("o@x.it", domain.RoleTeacher), user("x@x.it", domain.RoleTeacher), user("s@x.it", domain.RoleStudent)
	class, _ := s.ClassSvc.Create(owner, "3A", "", nil)
	s.Classes.AddMember(class.ID, stud.ID, domain.RoleStudent)
	title, app, draft := "T", "wiki-chatbot", false
	a, err := s.AssignmentSvc.Create(owner, class.ID, AssignmentInput{Title: &title, AppType: &app, Published: &draft}, "http://site")
	if err != nil {
		t.Fatal(err)
	}
	return s, owner, stranger, stud, a
}

func TestAssignmentVisibility(t *testing.T) {
	s, owner, stranger, stud, a := visibilityFixture(t)
	if _, err := s.AssignmentSvc.Visible(stud, a.ID); !errors.Is(err, errNotAssigned) {
		t.Fatalf("drafts are hidden from students: %v", err)
	}
	if _, err := s.AssignmentSvc.Managed(stranger, a.ID); !errors.Is(err, errNotYourClass) {
		t.Fatalf("other teachers cannot manage it: %v", err)
	}
	if _, err := s.AssignmentSvc.Managed(owner, 9999); !errors.Is(err, errAssignmentNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if _, err := s.SessionSvc.Start(stud, NewAttempt{AppType: "wiki-chatbot", AssignmentID: a.ID}); !errors.Is(err, errAssignmentForbidden) {
		t.Fatalf("no attempt on a draft: %v", err)
	}

	published := true
	s.AssignmentSvc.Update(a, AssignmentInput{Published: &published}, "http://site")
	if got, err := s.AssignmentSvc.Visible(stud, a.ID); err != nil || got.MySession != nil {
		t.Fatalf("published: %v %+v", err, got)
	}
	if _, err := s.SessionSvc.Start(stud, NewAttempt{AppType: "convinci-tu", AssignmentID: a.ID}); !errors.Is(err, errOtherApp) {
		t.Fatalf("wrong app: %v", err)
	}
	if _, err := s.SessionSvc.Start(stud, NewAttempt{AppType: "nope"}); !errors.Is(err, errInvalidApp) {
		t.Fatalf("invalid app: %v", err)
	}
	ss, err := s.SessionSvc.Start(stud, NewAttempt{AppType: "wiki-chatbot", AssignmentID: a.ID})
	if err != nil {
		t.Fatal(err)
	}
	if _, owns, err := s.SessionSvc.Load(stud, ss.ID); err != nil || !owns {
		t.Fatalf("owner: %v %v", err, owns)
	}
	if _, owns, err := s.SessionSvc.Load(owner, ss.ID); err != nil || owns {
		t.Fatalf("the class teacher sees it without owning it: %v %v", err, owns)
	}
	if _, _, err := s.SessionSvc.Load(stranger, ss.ID); !errors.Is(err, errSessionNotFound) {
		t.Fatalf("other teachers must not see it: %v", err)
	}
	if p, _ := s.AssignmentSvc.Progress(a); len(p) != 1 || p[0].AttemptCount != 1 || p[0].Session == nil {
		t.Fatalf("progress: %+v", p)
	}
}
