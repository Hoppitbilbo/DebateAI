package domain

import (
	"encoding/json"
	"strings"
)

// AppTypes are the activities an assignment can use.
var AppTypes = map[string]bool{
	"convinci-tu": true, "doppia-intervista": true, "wiki-chatbot": true,
	"personaggio-misterioso": true, "impersona-tu": true, "you-moderate": true,
}

// MaxAssignmentGoals bounds how many goals the judge evaluates.
const MaxAssignmentGoals = 12

type Assignment struct {
	ID                int64           `json:"id"`
	ClassID           int64           `json:"classId"`
	ClassName         string          `json:"className"`
	Title             string          `json:"title"`
	Instructions      string          `json:"instructions"`
	AppType           string          `json:"appType"`
	Config            json.RawMessage `json:"config"`
	Goals             []string        `json:"goals"`
	MinTurns          int             `json:"minTurns"`
	MaxTurns          int             `json:"maxTurns"`
	AutoEnd           bool            `json:"autoEnd"`
	RequireReflection bool            `json:"requireReflection"`
	AllowLive         bool            `json:"allowLive"`
	Published         bool            `json:"published"`
	DueAt             *string         `json:"dueAt,omitempty"`
	CreatedAt         string          `json:"createdAt"`
	UpdatedAt         string          `json:"updatedAt"`
	MySession         *SessionSummary `json:"mySession,omitempty"`
	Stats             *AssignStats    `json:"stats,omitempty"`
}

type AssignStats struct {
	Students  int `json:"students"`
	Started   int `json:"started"`
	Completed int `json:"completed"`
}

// NewAssignment holds the values of an assignment to create.
type NewAssignment struct {
	ClassID           int64
	Title             string
	Instructions      string
	AppType           string
	Config            string // JSON object
	Goals             []string
	MinTurns          int
	MaxTurns          int
	AutoEnd           bool
	RequireReflection bool
	AllowLive         bool
	Published         bool
	DueAt             *string
	CreatedBy         *int64 // nil for the assignment of a room opened without an account
}

// AssignmentPatch lists the fields to change; nil fields stay as they are.
// DueAt pointing to "" clears the due date.
type AssignmentPatch struct {
	Title             *string
	Instructions      *string
	AppType           *string
	Config            *string
	Goals             *[]string
	MinTurns          *int
	MaxTurns          *int
	AutoEnd           *bool
	RequireReflection *bool
	AllowLive         *bool
	Published         *bool
	DueAt             *string
}

// CleanGoals trims the goals, drops empty ones and keeps at most
// MaxAssignmentGoals.
func CleanGoals(g []string) []string {
	out := []string{}
	for _, s := range g {
		if s = strings.TrimSpace(s); s != "" {
			out = append(out, s)
		}
	}
	if len(out) > MaxAssignmentGoals {
		out = out[:MaxAssignmentGoals]
	}
	return out
}
