package domain

import "encoding/json"

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
	CostUSD           float64 `json:"costUsd"`
	StartedAt         string  `json:"startedAt"`
	UpdatedAt         string  `json:"updatedAt"`
	CompletedAt       *string `json:"completedAt,omitempty"`
}

type SessionDetail struct {
	SessionSummary
	Context    json.RawMessage `json:"context"`
	Transcript json.RawMessage `json:"transcript"`
	Jev        json.RawMessage `json:"jev"`
	Reflection string          `json:"reflection"`
	Evaluation string          `json:"evaluation"`
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

// ProgressCell is the best attempt of one student on one assignment.
type ProgressCell struct {
	AssignmentID int64   `json:"assignmentId"`
	UserID       int64   `json:"userId"`
	Status       string  `json:"status"`
	Progress     int     `json:"progress"`
	SessionID    int64   `json:"sessionId"`
	Score        *int    `json:"score,omitempty"`
	CostUSD      float64 `json:"costUsd"`
}
