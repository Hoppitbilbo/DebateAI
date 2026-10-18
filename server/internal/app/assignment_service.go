package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// assignmentService runs the teacher's assignments: creating and editing
// them, who may see them, the students' progress and the e-mail sent when
// one is published.
type assignmentService struct {
	assignments assignmentStore
	classes     classStore
	sessions    sessionStore
	classSvc    *classService
	mail        mailer
	siteName    func() string
}

var (
	errAssignmentNotFound = errors.New("assignment not found")
	errNotYourClass       = errors.New("not your class")
	errNotAssigned        = errors.New("not assigned to you")
	errAssignmentInvalid  = errors.New("title and a valid appType are required")
)

// AssignmentInput is the teacher's form; nil fields keep their value on
// update and take the defaults on create.
type AssignmentInput struct {
	Title             *string          `json:"title"`
	Instructions      *string          `json:"instructions"`
	AppType           *string          `json:"appType"`
	Config            *json.RawMessage `json:"config"`
	Goals             *[]string        `json:"goals"`
	MinTurns          *int             `json:"minTurns"`
	MaxTurns          *int             `json:"maxTurns"`
	AutoEnd           *bool            `json:"autoEnd"`
	RequireReflection *bool            `json:"requireReflection"`
	AllowLive         *bool            `json:"allowLive"`
	Published         *bool            `json:"published"`
	DueAt             *string          `json:"dueAt"`
	Notify            bool             `json:"notify"` // e-mail the students when it gets published
}

type StudentProgress struct {
	UserID       int64           `json:"userId"`
	Name         string          `json:"name"`
	Email        string          `json:"email"`
	Session      *SessionSummary `json:"session,omitempty"`
	AttemptCount int             `json:"attemptCount"`
}

// Managed returns an assignment that u may manage (errAssignmentNotFound, errNotYourClass).
func (svc *assignmentService) Managed(u *User, id int64) (*Assignment, error) {
	a, err := svc.assignments.Get(id)
	if err != nil {
		return nil, errAssignmentNotFound
	}
	if !svc.classSvc.CanManage(u, a.ClassID) {
		return nil, errNotYourClass
	}
	return a, nil
}

// Visible returns an assignment for u with u's latest attempt: teachers of
// the class always, students only when it is published in their class.
func (svc *assignmentService) Visible(u *User, id int64) (*Assignment, error) {
	a, err := svc.assignments.Get(id)
	if err != nil {
		return nil, errAssignmentNotFound
	}
	if !svc.classSvc.CanManage(u, a.ClassID) && (!svc.classes.IsMember(a.ClassID, u.ID) || !a.Published) {
		return nil, errNotAssigned
	}
	a.MySession = svc.sessions.Latest(u.ID, a.ID)
	return a, nil
}

// ListForClass returns the class assignments with how many students started
// and finished each.
func (svc *assignmentService) ListForClass(classID int64) ([]*Assignment, error) {
	out, err := svc.assignments.ListForClass(classID)
	if err != nil {
		return nil, err
	}
	students := svc.classes.CountStudents(classID)
	for _, a := range out {
		a.Stats = &AssignStats{Students: students, Started: svc.sessions.CountStarted(a.ID), Completed: svc.sessions.CountFinished(a.ID)}
	}
	return out, nil
}

// ListForStudent returns the student's assignments with their latest attempts.
func (svc *assignmentService) ListForStudent(u *User) ([]*Assignment, error) {
	out, err := svc.assignments.ListForStudent(u.ID)
	for _, a := range out {
		a.MySession = svc.sessions.Latest(u.ID, a.ID)
	}
	return out, err
}

func (svc *assignmentService) Create(u *User, classID int64, in AssignmentInput, baseURL string) (*Assignment, error) {
	if in.Title == nil || strings.TrimSpace(*in.Title) == "" || in.AppType == nil || !domain.AppTypes[*in.AppType] {
		return nil, errAssignmentInvalid
	}
	n := domain.NewAssignment{
		ClassID: classID, Title: strings.TrimSpace(*in.Title), AppType: *in.AppType, Config: "{}", Goals: []string{},
		MinTurns: valueOr(in.MinTurns, 0), MaxTurns: valueOr(in.MaxTurns, 0),
		AutoEnd: valueOr(in.AutoEnd, true), RequireReflection: valueOr(in.RequireReflection, true),
		AllowLive: valueOr(in.AllowLive, true), Published: valueOr(in.Published, true),
		DueAt: in.DueAt, CreatedBy: u.ID,
	}
	if in.Config != nil && len(*in.Config) > 0 {
		n.Config = string(*in.Config)
	}
	if in.Goals != nil {
		n.Goals = domain.CleanGoals(*in.Goals)
	}
	if in.Instructions != nil {
		n.Instructions = strings.TrimSpace(*in.Instructions)
	}
	id, err := svc.assignments.Create(n)
	if err != nil {
		return nil, err
	}
	a, err := svc.assignments.Get(id)
	if err == nil && in.Notify && a.Published {
		svc.notifyStudents(a, baseURL)
	}
	return a, err
}

// Update applies the teacher's changes; students are notified when the
// assignment becomes published and the teacher asked for it.
func (svc *assignmentService) Update(a *Assignment, in AssignmentInput, baseURL string) (*Assignment, error) {
	wasPublished := a.Published
	p := domain.AssignmentPatch{
		MinTurns: in.MinTurns, MaxTurns: in.MaxTurns, AutoEnd: in.AutoEnd, RequireReflection: in.RequireReflection,
		AllowLive: in.AllowLive, Published: in.Published, DueAt: in.DueAt,
	}
	if in.Title != nil && strings.TrimSpace(*in.Title) != "" {
		p.Title = ptr(strings.TrimSpace(*in.Title))
	}
	if in.Instructions != nil {
		p.Instructions = ptr(strings.TrimSpace(*in.Instructions))
	}
	if in.AppType != nil && domain.AppTypes[*in.AppType] {
		p.AppType = in.AppType
	}
	if in.Config != nil {
		p.Config = ptr(string(*in.Config))
	}
	if in.Goals != nil {
		p.Goals = ptr(domain.CleanGoals(*in.Goals))
	}
	if err := svc.assignments.Update(a.ID, p); err != nil {
		return nil, err
	}
	a, err := svc.assignments.Get(a.ID)
	if err == nil && in.Notify && a.Published && !wasPublished {
		svc.notifyStudents(a, baseURL)
	}
	return a, err
}

// Progress returns each student of the class with their best attempt.
func (svc *assignmentService) Progress(a *Assignment) ([]StudentProgress, error) {
	students, err := svc.classes.Students(a.ClassID)
	if err != nil {
		return nil, err
	}
	out := []StudentProgress{}
	for _, st := range students {
		out = append(out, StudentProgress{UserID: st.ID, Name: st.Name, Email: st.Email,
			Session: svc.sessions.Best(st.ID, a.ID), AttemptCount: svc.sessions.CountAttempts(st.ID, a.ID)})
	}
	return out, nil
}

// notifyStudents e-mails the active students of the class about a
// published assignment.
func (svc *assignmentService) notifyStudents(a *Assignment, baseURL string) {
	students, err := svc.classes.Students(a.ClassID)
	if err != nil {
		return
	}
	for _, st := range students {
		if !st.Active {
			continue
		}
		subj, body := renderMail("assignment", st.Locale, map[string]string{"site": svc.siteName(), "name": st.Name, "class": a.ClassName,
			"title": a.Title, "due": dueText(a.DueAt, st.Locale), "link": baseURL + "/dashboard"})
		svc.mail.sendMailAsync(st.Email, subj, body)
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
