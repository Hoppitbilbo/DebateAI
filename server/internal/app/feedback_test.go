package app

import (
	"errors"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestGiveFeedback(t *testing.T) {
	s, owner, stranger, stud, a := visibilityFixture(t)
	published := true
	s.AssignmentSvc.Update(a, AssignmentInput{Published: &published}, "http://site")
	ss, err := s.SessionSvc.Start(stud, NewAttempt{AppType: "wiki-chatbot", AssignmentID: a.ID})
	if err != nil {
		t.Fatal(err)
	}
	m := &captureMailer{}
	svc := *s.SessionSvc
	svc.listeners = []feedbackListener{feedbackMailer{users: s.Users, mail: m, siteName: func() string { return "Site" }}}

	score, tooHigh := 8, 11
	if _, err := svc.GiveFeedback(stud, ss.ID, domain.TeacherFeedback{Text: "io"}, "http://site"); !errors.Is(err, ErrFeedbackForbidden) {
		t.Fatalf("the student cannot grade their own work: %v", err)
	}
	if _, err := svc.GiveFeedback(stranger, ss.ID, domain.TeacherFeedback{Text: "x"}, "http://site"); !errors.Is(err, ErrSessionNotFound) {
		t.Fatalf("a teacher of another class cannot see it: %v", err)
	}
	if _, err := svc.GiveFeedback(owner, ss.ID, domain.TeacherFeedback{Text: "x", Score: &tooHigh}, "http://site"); !IsInvalid(err) {
		t.Fatalf("score out of range: %v", err)
	}
	d, err := svc.GiveFeedback(owner, ss.ID, domain.TeacherFeedback{Text: "  Ottime domande  ", Score: &score}, "http://site")
	if err != nil || d.TeacherFeedback != "Ottime domande" || *d.TeacherScore != 8 {
		t.Fatalf("feedback: %v %+v", err, d)
	}
	if len(m.bodies) != 1 || !strings.Contains(m.bodies[0], "http://site/sessions/") {
		t.Fatalf("the student must get a mail: %q", m.bodies)
	}
	if best := s.Sessions.Best(stud.ID, a.ID); best.TeacherScore == nil || *best.TeacherScore != 8 {
		t.Fatalf("the teacher score must show in the progress: %+v", best)
	}
}
