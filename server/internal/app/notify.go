package app

import (
	"fmt"
	"time"
)

// Assignment events (Observer pattern): assignmentService announces what
// happened and does not know who reacts. Mail is one listener; others (a
// push notification, a webhook) can be added without touching the service.

type assignmentListener interface {
	// AssignmentPublished is called when students should hear about a
	// published assignment (the teacher asked to notify them).
	AssignmentPublished(a *Assignment, baseURL string)
}

// mailNotifier e-mails the active students of the class.
type mailNotifier struct {
	classes  classStore
	mail     mailer
	siteName func() string
}

func (n mailNotifier) AssignmentPublished(a *Assignment, baseURL string) {
	students, err := n.classes.Students(a.ClassID)
	if err != nil {
		return
	}
	for _, st := range students {
		if !st.Active {
			continue
		}
		subj, body := renderMail("assignment", st.Locale, map[string]string{"site": n.siteName(), "name": st.Name, "class": a.ClassName,
			"title": a.Title, "due": dueText(a.DueAt, st.Locale), "link": baseURL + "/dashboard"})
		n.mail.sendMailAsync(st.Email, subj, body)
	}
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
	return fmt.Sprintf(duePhrase[normLocale(locale)], when)
}
