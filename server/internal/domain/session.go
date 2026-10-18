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

