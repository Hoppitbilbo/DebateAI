package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// sessionService runs a student's attempt at an activity: it stores the
// transcript, asks the JEV judge about the assignment goals and moves the
// session through its states (domain.SessionState).
type sessionService struct {
	sessions    sessionStore
	assignments assignmentStore
	classes     classStore
	classSvc    *classService
	judge       goalEvaluator
	jevSettings func() JevSettings
	listeners   []feedbackListener
}

var (
	ErrInvalidApp          = errors.New("invalid appType")
	ErrAssignmentForbidden = errors.New("assignment not available")
	ErrOtherApp            = errors.New("assignment is for another app")
	ErrSessionNotFound     = errors.New("session not found")
	ErrFeedbackForbidden   = errors.New("only the class teacher can give feedback")
)

// maxTeacherFeedbackChars bounds the teacher's written feedback.
const maxTeacherFeedbackChars = 20000

// NewAttempt is what the client sends to start an activity.
type NewAttempt struct {
	AppType      string          `json:"appType"`
	AssignmentID int64           `json:"assignmentId"` // 0 for free practice
	Title        string          `json:"title"`
	Context      json.RawMessage `json:"context"`
}

// Start opens a new attempt; for an assignment it also closes the
// student's previous attempts that never got a turn.
func (svc *sessionService) Start(u *domain.User, in NewAttempt) (*domain.SessionSummary, error) {
	if !domain.AppTypes[in.AppType] {
		return nil, ErrInvalidApp
	}
	n := domain.NewSession{UserID: u.ID, AppType: in.AppType, Title: truncate(in.Title, maxSessionTitleChars), Context: "{}"}
	if in.AssignmentID > 0 {
		a, err := svc.assignments.Get(in.AssignmentID)
		if err != nil || (!svc.classSvc.CanManage(u, a.ClassID) && (!svc.classes.IsMember(a.ClassID, u.ID) || !a.Published)) {
			return nil, ErrAssignmentForbidden
		}
		if a.AppType != in.AppType {
			return nil, ErrOtherApp
		}
		n.AssignmentID = &a.ID
		logIfErr("abandon empty sessions", svc.sessions.AbandonEmpty(u.ID, a.ID))
	}
	if len(in.Context) > 0 {
		n.Context = string(in.Context)
	}
	id, err := svc.sessions.Create(n)
	if err != nil {
		return nil, err
	}
	return svc.sessions.Summary(id)
}

// Load returns a session u may see and whether u is its owner. Admins see
// every session; teachers those of their classes' assignments and the free
// practice of their students.
func (svc *sessionService) Load(u *domain.User, id int64) (*domain.SessionDetail, bool, error) {
	d, err := svc.sessions.Detail(id)
	if err != nil {
		return nil, false, ErrSessionNotFound
	}
	owner := d.UserID != nil && *d.UserID == u.ID
	if owner || u.Role == domain.RoleAdmin {
		return d, owner, nil
	}
	if d.AssignmentID != nil {
		if a, err := svc.assignments.Get(*d.AssignmentID); err == nil && svc.classSvc.CanManage(u, a.ClassID) {
			return d, false, nil
		}
	}
	if u.Role == domain.RoleTeacher && d.UserID != nil && svc.classes.TeachesStudent(u.ID, *d.UserID) {
		return d, false, nil
	}
	return nil, false, ErrSessionNotFound
}

// GiveFeedback stores the teacher's feedback (and optional 0-10 score) on a
// student's attempt and tells the listeners (the student gets an e-mail).
// Teachers who can see the session and admins may do it, never its owner.
func (svc *sessionService) GiveFeedback(u *domain.User, id int64, f domain.TeacherFeedback, baseURL string) (*domain.SessionDetail, error) {
	d, owner, err := svc.Load(u, id)
	if err != nil {
		return nil, err
	}
	if owner || (u.Role != domain.RoleTeacher && u.Role != domain.RoleAdmin) {
		return nil, ErrFeedbackForbidden
	}
	if f.Score != nil && (*f.Score < 0 || *f.Score > 10) {
		return nil, invalid(errors.New("score must be between 0 and 10"))
	}
	f.Text = truncate(strings.TrimSpace(f.Text), maxTeacherFeedbackChars)
	if err := svc.sessions.SetTeacherFeedback(id, f); err != nil {
		return nil, err
	}
	d, err = svc.sessions.Detail(id)
	if err != nil {
		return nil, err
	}
	for _, l := range svc.listeners {
		l.FeedbackGiven(d, u, baseURL)
	}
	return d, nil
}

// Completion is what the student hands in after the activity.
type Completion struct {
	Reflection        string `json:"reflection"`
	Evaluation        string `json:"evaluation"`
	ScoreConversation *int   `json:"scoreConversation"`
	ScoreReflection   *int   `json:"scoreReflection"`
}

// Complete closes the attempt with the student's reflection and evaluation.
func (svc *sessionService) Complete(d *domain.SessionDetail, c Completion) error {
	return svc.sessions.Complete(d.ID, domain.SessionCompletion{
		Reflection: truncate(c.Reflection, maxReflectionChars), Evaluation: truncate(c.Evaluation, maxEvaluationChars),
		ScoreConversation: c.ScoreConversation, ScoreReflection: c.ScoreReflection,
	})
}

// goalEvaluator scores a conversation against the assignment goals
// (implemented by Server.judge).
type goalEvaluator interface {
	judge(ctx context.Context, in judgeInput, userID, sessionID *int64) JudgeResult
}

// TranscriptUpdate is what the client sends after each turn.
type TranscriptUpdate struct {
	Messages []TranscriptMessage `json:"messages"`
	Context  json.RawMessage     `json:"context"`
	Judge    *bool               `json:"judge"` // force (true) or skip (false) judging
}

// SaveTranscript stores the conversation of session d, owned by u, and for
// an active assignment judges it and applies the resulting state change.
func (svc *sessionService) SaveTranscript(ctx context.Context, u *domain.User, d *domain.SessionDetail, in TranscriptUpdate) (TranscriptSync, error) {
	msgs := lastMessages(in.Messages, maxTranscriptMessages)
	turns := countStudentTurns(msgs)
	var newContext *string
	if len(in.Context) > 0 {
		newContext = ptr(string(in.Context))
	}
	if err := svc.sessions.SaveTranscript(d.ID, mustJSON(msgs), turns, newContext); err != nil {
		return TranscriptSync{}, err
	}

	state := domain.StateOf(d.Status)
	resp := TranscriptSync{Status: state.Status(), Turns: turns, Progress: d.Progress, Ended: state.Ended()}
	if d.AssignmentID == nil || state.Ended() {
		return resp, nil
	}
	a, err := svc.assignments.Get(*d.AssignmentID)
	if err != nil {
		return resp, nil
	}
	resp.MaxTurns = &a.MaxTurns

	outcome := domain.TurnOutcome{Turns: turns, MaxTurns: a.MaxTurns, AutoEnd: a.AutoEnd}
	if svc.shouldJudge(turns, a.MaxTurns, in.Judge) {
		jr := svc.evaluate(ctx, u, d, a, msgs, firstNonEmpty(in.Context, d.Context), turns)
		resp.Jev = &jr
		if jr.Engine != "none" {
			if err := svc.sessions.SaveJudgement(d.ID, mustJSON(jr), jr.Progress); err != nil {
				return resp, err
			}
			resp.Progress = jr.Progress
			outcome.GoalsCompleted = jr.Completed
		}
	}

	next, reason := state.Next(outcome)
	if next.Status() != state.Status() {
		if err := svc.sessions.SetStatus(d.ID, next.Status()); err != nil {
			return resp, err
		}
	}
	resp.Status, resp.Ended, resp.Reason = next.Status(), next.Ended(), &reason
	return resp, nil
}

// shouldJudge: every EvaluateEvery turns and on the last allowed turn,
// unless the client forces or skips it.
func (svc *sessionService) shouldJudge(turns, maxTurns int, force *bool) bool {
	if turns == 0 {
		return false
	}
	if force != nil {
		return *force
	}
	every := max(svc.jevSettings().EvaluateEvery, 1)
	return turns%every == 0 || (maxTurns > 0 && turns >= maxTurns)
}

func (svc *sessionService) evaluate(ctx context.Context, u *domain.User, d *domain.SessionDetail, a *domain.Assignment, msgs []TranscriptMessage, activity json.RawMessage, turns int) JudgeResult {
	ctx, cancel := context.WithTimeout(ctx, judgeRequestTimeout)
	defer cancel()
	return svc.judge.judge(ctx, judgeInput{
		Instructions: a.Instructions, Goals: a.Goals, AppType: a.AppType,
		Context:    truncate(string(activity), maxJudgeContextChars),
		Transcript: msgs, Locale: u.Locale, MinTurns: a.MinTurns, Turns: turns,
	}, &u.ID, &d.ID)
}

// lastMessages keeps the newest n messages.
func lastMessages(msgs []TranscriptMessage, n int) []TranscriptMessage {
	if len(msgs) > n {
		return msgs[len(msgs)-n:]
	}
	return msgs
}

// countStudentTurns counts the non-empty messages written by the student.
func countStudentTurns(msgs []TranscriptMessage) int {
	turns := 0
	for _, m := range msgs {
		if m.Role == "user" && strings.TrimSpace(m.Content) != "" {
			turns++
		}
	}
	return turns
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func firstNonEmpty(a, b json.RawMessage) json.RawMessage {
	if len(a) > 0 {
		return a
	}
	return b
}
