package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Assignment events (Observer pattern): assignmentService announces what
// happened and does not know who reacts. Mail is one listener; others (a
// push notification, a webhook) can be added without touching the service.

type assignmentListener interface {
	// AssignmentPublished is called when students should hear about a
	// published assignment (the teacher asked to notify them).
	AssignmentPublished(a *domain.Assignment, baseURL string)
}

type feedbackListener interface {
	// FeedbackGiven is called when a teacher has written feedback on an attempt.
	FeedbackGiven(d *domain.SessionDetail, teacher *domain.User, baseURL string)
}

// mailNotifier e-mails the active students of the class.
type mailNotifier struct {
	classes  classStore
	mail     mailer
	siteName func() string
}

func (n mailNotifier) AssignmentPublished(a *domain.Assignment, baseURL string) {
	students, err := n.classes.Students(a.ClassID)
	if err != nil {
		return
	}
	for _, st := range students {
		if !st.Active {
			continue
		}
		subj, body := RenderMail("assignment", st.Locale, map[string]string{"site": n.siteName(), "name": st.Name, "class": a.ClassName,
			"title": a.Title, "due": dueText(a.DueAt, st.Locale), "link": baseURL + "/dashboard"})
		n.mail.SendMailAsync(st.Email, subj, body)
	}
}

// feedbackMailer tells the student that the teacher wrote feedback.
type feedbackMailer struct {
	users    userStore
	mail     mailer
	siteName func() string
}

func (n feedbackMailer) FeedbackGiven(d *domain.SessionDetail, teacher *domain.User, baseURL string) {
	if d.UserID == nil || strings.TrimSpace(d.TeacherFeedback) == "" {
		return
	}
	student, err := n.users.Get(*d.UserID)
	if err != nil || !student.Active {
		return
	}
	title := d.AssignmentTitle
	if title == "" {
		title = d.Title
	}
	subj, body := RenderMail("feedback", student.Locale, map[string]string{"site": n.siteName(), "name": student.Name, "teacher": teacher.Name,
		"title": title, "link": fmt.Sprintf("%s/sessions/%d", baseURL, d.ID)})
	n.mail.SendMailAsync(student.Email, subj, body)
}

// dueText is the "due on ..." sentence of the mail, in the reader's language.
func dueText(dueAt *string, locale string) string {
	if dueAt == nil {
		return ""
	}
	when := *dueAt
	if t, err := time.Parse(time.RFC3339, when); err == nil {
		when = t.Format("02/01/2006 15:04")
	}
	return fmt.Sprintf(duePhrase[NormLocale(locale)], when)
}
