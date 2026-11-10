package app

import (
	"errors"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestRecipientGuardNeverSendsToAnEmptyAddress(t *testing.T) {
	m := &captureMailer{}
	g := recipientGuard{m}
	if err := g.SendMail("  ", "s", "b"); !errors.Is(err, ErrNoRecipient) {
		t.Fatalf("want ErrNoRecipient, got %v", err)
	}
	g.SendMailAsync("", "s", "b")
	if len(m.bodies) != 0 {
		t.Fatalf("nothing may be sent: %q", m.bodies)
	}
	if err := g.SendMail("a@x.it", "s", "b"); err != nil || len(m.bodies) != 1 {
		t.Fatal("real addresses go through")
	}
}

func TestOutboxDoesNotQueueAnEmptyAddress(t *testing.T) {
	s := newTestServer(t)
	s.Outbox.enqueue("", "s", "b")
	if pending, _ := s.Outbox.store.CountPending(); pending != 0 {
		t.Fatal("a mail without recipient must not be queued")
	}
}

func TestNotifiersSkipAccountsWithoutEmail(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	stud, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: c.JoinCode, Username: "anna", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}
	m := &captureMailer{}
	mailNotifier{classes: s.Classes, mail: m, siteName: func() string { return "Site" }}.
		AssignmentPublished(&domain.Assignment{ClassID: c.ID, ClassName: c.Name, Title: "T"}, "http://site")
	sid := stud.ID
	feedbackMailer{users: s.Users, mail: m, siteName: func() string { return "Site" }}.
		FeedbackGiven(&domain.SessionDetail{SessionSummary: domain.SessionSummary{ID: 1, UserID: &sid}, TeacherFeedback: "Bravo"}, &domain.User{Name: "Prof"}, "http://site")
	if len(m.bodies) != 0 {
		t.Fatalf("no mail for an account without e-mail: %q", strings.Join(m.bodies, "|"))
	}
}
