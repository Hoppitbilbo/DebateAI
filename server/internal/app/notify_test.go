package app

import (
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// recordingListener remembers the published assignments.
type recordingListener struct{ titles []string }

func (l *recordingListener) AssignmentPublished(a *Assignment, baseURL string) {
	l.titles = append(l.titles, a.Title)
}

func TestAssignmentPublishedEvent(t *testing.T) {
	s, owner, _, _, a := visibilityFixture(t) // unpublished draft
	l := &recordingListener{}
	svc := *s.assignmentSvc
	svc.listeners = []assignmentListener{l}

	published, title, app := true, "Pubblicato", "wiki-chatbot"
	svc.Update(a, AssignmentInput{Published: &published}, "http://site")
	if len(l.titles) != 0 {
		t.Fatal("no event when the teacher did not ask to notify")
	}
	a, _ = s.assignments.Get(a.ID)
	draft := false
	svc.Update(a, AssignmentInput{Published: &draft}, "http://site")
	a, _ = s.assignments.Get(a.ID)
	svc.Update(a, AssignmentInput{Published: &published, Notify: true}, "http://site")
	a, _ = s.assignments.Get(a.ID)
	svc.Update(a, AssignmentInput{Notify: true}, "http://site") // already published: no new event
	svc.Create(owner, a.ClassID, AssignmentInput{Title: &title, AppType: &app, Notify: true}, "http://site")
	if strings.Join(l.titles, ",") != "T,Pubblicato" {
		t.Fatalf("events: %v", l.titles)
	}
}

func TestMailNotifierWritesToActiveStudents(t *testing.T) {
	s, _, _, stud, a := visibilityFixture(t)
	other, _ := s.accounts.CreateUser("off@x.it", "", "", domain.RoleStudent, "en")
	s.classes.AddMember(a.ClassID, other, domain.RoleStudent)
	off := false
	s.users.Update(other, domain.UserPatch{Active: &off})

	m := &captureMailer{}
	due := "2026-11-01T10:00:00Z"
	a.DueAt = &due
	mailNotifier{classes: s.classes, mail: m, siteName: func() string { return "Site" }}.AssignmentPublished(a, "http://site")
	if len(m.bodies) != 1 || !strings.Contains(m.bodies[0], "01/11/2026 10:00") || !strings.Contains(m.bodies[0], "http://site/dashboard") {
		t.Fatalf("mails: %q (student %s)", m.bodies, stud.Email)
	}
}
