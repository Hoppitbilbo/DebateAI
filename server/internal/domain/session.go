package domain

import (
	"encoding/json"
	"errors"
)

// Session statuses.
const (
	SessionActive      = "active"
	SessionGoalReached = "goal_reached"
	SessionTurnLimit   = "turn_limit"
	SessionCompleted   = "completed"
	SessionAbandoned   = "abandoned"
)

type SessionSummary struct {
	ID                int64   `json:"id"`
	UserID            *int64  `json:"userId,omitempty"`
	UserName          string  `json:"userName,omitempty"`
	AssignmentID      *int64  `json:"assignmentId,omitempty"`
	AssignmentTitle   string  `json:"assignmentTitle,omitempty"`
	AppType           string  `json:"appType"`
	Title             string  `json:"title"`
	Status            string  `json:"status"`
	Turns             int     `json:"turns"`
	Progress          int     `json:"progress"`
	ScoreConversation *int    `json:"scoreConversation,omitempty"`
	ScoreReflection   *int    `json:"scoreReflection,omitempty"`
	TeacherScore      *int    `json:"teacherScore,omitempty"` // 0-10, given by the teacher
	CostUSD           float64 `json:"costUsd"`
	StartedAt         string  `json:"startedAt"`
	UpdatedAt         string  `json:"updatedAt"`
	CompletedAt       *string `json:"completedAt,omitempty"`
	// UnverifiedLines counts the AI lines of the saved conversation that the
	// server did not produce (after the student's first message): edited or
	// invented lines, or voice lines, which the server never sees.
	UnverifiedLines int `json:"unverifiedLines,omitempty"`
}

type SessionDetail struct {
	SessionSummary
	Context    json.RawMessage `json:"context"`
	Transcript json.RawMessage `json:"transcript"`
	Jev        json.RawMessage `json:"jev"`
	Reflection string          `json:"reflection"`
	Evaluation string          `json:"evaluation"`
	// Revision grows by one at every transcript save.
	Revision int64 `json:"revision"`
	// Voice: part of the conversation was spoken (its AI lines cannot be checked).
	Voice bool `json:"voice,omitempty"`
	// Written by the teacher after reading the conversation.
	TeacherFeedback   string  `json:"teacherFeedback"`
	TeacherFeedbackAt *string `json:"teacherFeedbackAt,omitempty"`
}

// Errors of the conditional session writes.
var (
	// ErrStaleRevision: the transcript was saved on top of an older revision.
	ErrStaleRevision = errors.New("the conversation was saved meanwhile from another request; reload it")
	// ErrSessionCompleted: a handed-in attempt is not rewritten.
	ErrSessionCompleted = errors.New("this attempt has already been handed in")
)

// TranscriptSave is a new revision of an attempt's conversation.
type TranscriptSave struct {
	JSON    string
	Turns   int
	Context *string // replaces the activity setup when not nil
	// BaseRevision, when set, is the revision the client saw: the save is
	// refused with ErrStaleRevision if another one came in meanwhile.
	BaseRevision *int64
	// Unverified is the UnverifiedLines of this revision.
	Unverified int
}

// NewSession holds the values of an activity attempt to start.
type NewSession struct {
	UserID       int64
	AssignmentID *int64 // nil for free practice
	AppType      string
	Title        string
	Context      string // JSON object
}

// SessionCompletion is what the student hands in at the end of an activity.
type SessionCompletion struct {
	Reflection        string
	Evaluation        string
	ScoreConversation *int
	ScoreReflection   *int
}

// BestAttempt is a student's best attempt on an assignment and how many
// attempts they made.
type BestAttempt struct {
	Session  *SessionSummary
	Attempts int
}

// ProgressCell is the best attempt of one student on one assignment.
type ProgressCell struct {
	AssignmentID int64   `json:"assignmentId"`
	UserID       int64   `json:"userId"`
	Status       string  `json:"status"`
	Progress     int     `json:"progress"`
	SessionID    int64   `json:"sessionId"`
	Score        *int    `json:"score,omitempty"`
	TeacherScore *int    `json:"teacherScore,omitempty"`
	CostUSD      float64 `json:"costUsd"`
}

// TeacherFeedback is what a teacher writes about a student's attempt.
type TeacherFeedback struct {
	Text  string `json:"feedback"`
	Score *int   `json:"score"` // 0-10, optional
}
