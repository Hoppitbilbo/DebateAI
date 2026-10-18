package app

import "github.com/Hoppitbilbo/DebateAI/server/internal/domain"

// Results the services return; their JSON is part of the API contract.

// InviteResult is one row of a bulk invite. EmailSent is omitted for the
// admin's error rows, which never had it.
type InviteResult struct {
	Email     string `json:"email"`
	Status    string `json:"status"` // added | invited | error
	EmailSent *bool  `json:"emailSent,omitempty"`
	Link      string `json:"link,omitempty"`
	Error     string `json:"error,omitempty"`
}

func boolPtr(b bool) *bool { return &b }

func InvitedResult(inv *domain.Invite) InviteResult {
	return InviteResult{Email: inv.Email, Status: "invited", EmailSent: boolPtr(inv.EmailSent), Link: inv.Link}
}

// TranscriptSync answers PUT /api/sessions/{id}/transcript. Free or
// already ended sessions only carry the first four fields; active assignment
// sessions add maxTurns and reason, and jev when the judge ran.
type TranscriptSync struct {
	Status   string       `json:"status"`
	Turns    int          `json:"turns"`
	Progress int          `json:"progress"`
	Ended    bool         `json:"ended"`
	MaxTurns *int         `json:"maxTurns,omitempty"`
	Reason   *string      `json:"reason,omitempty"`
	Jev      *JudgeResult `json:"jev,omitempty"`
}
