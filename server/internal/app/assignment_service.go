package app

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// assignmentService runs the teacher's assignments: creating and editing
// them, who may see them and the students' progress. Listeners hear when
// one is published.
type assignmentService struct {
	assignments assignmentStore
	classes     classStore
	sessions    sessionStore
	classSvc    *classService
	listeners   []assignmentListener
}

// published tells every listener that students should hear about a.
func (svc *assignmentService) published(a *domain.Assignment, baseURL string) {
	for _, l := range svc.listeners {
		l.AssignmentPublished(a, baseURL)
	}
}

var (
	ErrAssignmentNotFound = errors.New("assignment not found")
	ErrNotYourClass       = errors.New("not your class")
	ErrNotAssigned        = errors.New("not assigned to you")
	ErrAssignmentInvalid  = errors.New("title and a valid appType are required")
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
	UserID       int64                  `json:"userId"`
	Name         string                 `json:"name"`
	Email        string                 `json:"email"`
	Session      *domain.SessionSummary `json:"session,omitempty"`
	AttemptCount int                    `json:"attemptCount"`
}

// Managed returns an assignment that u may manage (ErrAssignmentNotFound, ErrNotYourClass).
func (svc *assignmentService) Managed(u *domain.User, id int64) (*domain.Assignment, error) {
	a, err := svc.assignments.Get(id)
	if err != nil {
		return nil, ErrAssignmentNotFound
	}
	if !svc.classSvc.CanManage(u, a.ClassID) {
		return nil, ErrNotYourClass
	}
	return a, nil
}

// Visible returns an assignment for u with u's latest attempt: teachers of
// the class always, students only when it is published in their class.
func (svc *assignmentService) Visible(u *domain.User, id int64) (*domain.Assignment, error) {
	a, err := svc.assignments.Get(id)
	if err != nil {
		return nil, ErrAssignmentNotFound
	}
	if !svc.classSvc.MayAttempt(u, a) {
		return nil, ErrNotAssigned
	}
	a.MySession = svc.sessions.Latest(u.ID, a.ID)
	return a, nil
}

// ListForClass returns the class assignments with how many students started
// and finished each.
func (svc *assignmentService) ListForClass(classID int64) ([]*domain.Assignment, error) {
	out, err := svc.assignments.ListForClass(classID)
	if err != nil {
		return nil, err
	}
	stats, err := svc.sessions.StatsForClass(classID)
	if err != nil {
		return nil, err
	}
	students := svc.classes.CountStudents(classID)
	for _, a := range out {
		st := stats[a.ID]
		st.Students = students
		a.Stats = &st
	}
	return out, nil
}

// ListForStudent returns the student's assignments with their latest attempts.
func (svc *assignmentService) ListForStudent(u *domain.User) ([]*domain.Assignment, error) {
	out, err := svc.assignments.ListForStudent(u.ID)
	if err != nil {
		return nil, err
	}
	latest, err := svc.sessions.LatestPerAssignment(u.ID)
	if err != nil {
		return nil, err
	}
	for _, a := range out {
		a.MySession = latest[a.ID]
	}
	return out, nil
}

// newAssignment reads the teacher's form for a new assignment, with the
// defaults of the missing fields; ErrAssignmentInvalid without a title or
// a known app.
func (in AssignmentInput) newAssignment() (domain.NewAssignment, error) {
	if in.Title == nil || strings.TrimSpace(*in.Title) == "" || in.AppType == nil || !domain.AppTypes[*in.AppType] {
		return domain.NewAssignment{}, ErrAssignmentInvalid
	}
	n := domain.NewAssignment{
		Title: strings.TrimSpace(*in.Title), AppType: *in.AppType, Config: "{}", Goals: []string{},
		MinTurns: valueOr(in.MinTurns, 0), MaxTurns: valueOr(in.MaxTurns, 0),
		AutoEnd: valueOr(in.AutoEnd, true), RequireReflection: valueOr(in.RequireReflection, true),
		AllowLive: valueOr(in.AllowLive, true), Published: valueOr(in.Published, true),
		DueAt: in.DueAt,
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
	return n, nil
}

func (svc *assignmentService) Create(u *domain.User, classID int64, in AssignmentInput, baseURL string) (*domain.Assignment, error) {
	n, err := in.newAssignment()
	if err != nil {
		return nil, err
	}
	n.ClassID, n.CreatedBy = classID, &u.ID
	id, err := svc.assignments.Create(n)
	if err != nil {
		return nil, err
	}
	a, err := svc.assignments.Get(id)
	if err == nil && in.Notify && a.Published {
		svc.published(a, baseURL)
	}
	return a, err
}

// Update applies the teacher's changes; students are notified when the
// assignment becomes published and the teacher asked for it.
func (svc *assignmentService) Update(a *domain.Assignment, in AssignmentInput, baseURL string) (*domain.Assignment, error) {
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
		svc.published(a, baseURL)
	}
	return a, err
}

// Progress returns each student of the class with their best attempt.
func (svc *assignmentService) Progress(a *domain.Assignment) ([]StudentProgress, error) {
	students, err := svc.classes.Students(a.ClassID)
	if err != nil {
		return nil, err
	}
	best, err := svc.sessions.BestPerUser(a.ID)
	if err != nil {
		return nil, err
	}
	out := []StudentProgress{}
	for _, st := range students {
		b := best[st.ID]
		out = append(out, StudentProgress{UserID: st.ID, Name: st.Name, Email: st.Email, Session: b.Session, AttemptCount: b.Attempts})
	}
	return out, nil
}

// GradeRow is one student's best attempt on one assignment, for reports.
type GradeRow struct {
	Student, Email, Assignment string
	Session                    *domain.SessionSummary // nil when not started
	Attempts                   int
}

// Grades returns a row per student for each assignment, in class order.
func (svc *assignmentService) Grades(assignments []*domain.Assignment) ([]GradeRow, error) {
	rows := []GradeRow{}
	for _, a := range assignments {
		students, err := svc.Progress(a)
		if err != nil {
			return nil, err
		}
		for _, st := range students {
			rows = append(rows, GradeRow{Student: st.Name, Email: st.Email, Assignment: a.Title, Session: st.Session, Attempts: st.AttemptCount})
		}
	}
	return rows, nil
}
