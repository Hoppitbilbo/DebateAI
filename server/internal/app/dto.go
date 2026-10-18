package app

import (
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Response bodies of the HTTP API. The JSON tags are the contract with the
// frontend (src/lib/api.ts); testdata/shapes.json pins them.

type okResponse struct {
	OK bool `json:"ok"`
}

func writeOK(w http.ResponseWriter) { writeJSON(w, 200, okResponse{OK: true}) }

// ---------- public & auth ----------

type publicConfigResponse struct {
	SiteName        string `json:"siteName"`
	DefaultLocale   string `json:"defaultLocale"`
	GuestAccess     bool   `json:"guestAccess"`
	GuestLive       bool   `json:"guestLive"`
	AllowJoinByCode bool   `json:"allowJoinByCode"`
	LiveEnabled     bool   `json:"liveEnabled"`
	SetupRequired   bool   `json:"setupRequired"`
	MailConfigured  bool   `json:"mailConfigured"`
}

type meResponse struct {
	User *User `json:"user"`
}

type inviteInfoResponse struct {
	Email      string `json:"email"`
	Role       string `json:"role"`
	ClassName  string `json:"className"`
	InvitedBy  string `json:"invitedBy"`
	Locale     string `json:"locale"`
	UserExists bool   `json:"userExists"`
}

// inviteResult is one row of a bulk invite. EmailSent is omitted for the
// admin's error rows, which never had it.
type inviteResult struct {
	Email     string `json:"email"`
	Status    string `json:"status"` // added | invited | error
	EmailSent *bool  `json:"emailSent,omitempty"`
	Link      string `json:"link,omitempty"`
	Error     string `json:"error,omitempty"`
}

type inviteResultsResponse struct {
	Results []inviteResult `json:"results"`
}

func boolPtr(b bool) *bool { return &b }

func invitedResult(inv *inviteRow) inviteResult {
	return inviteResult{Email: inv.Email, Status: "invited", EmailSent: boolPtr(inv.EmailSent), Link: inv.Link}
}

// ---------- classes ----------

type classProgressResponse struct {
	Cells []domain.ProgressCell `json:"cells"`
}

type classDetailResponse struct {
	Class   *Class      `json:"class"`
	Members []Member    `json:"members"`
	Invites []inviteRow `json:"invites"`
}

type joinCodeResponse struct {
	JoinCode string `json:"joinCode"`
}

type joinClassResponse struct {
	ClassID int64  `json:"classId"`
	Name    string `json:"name"`
}

// ---------- assignments & sessions ----------

type assignmentProgressResponse struct {
	Assignment *Assignment       `json:"assignment"`
	Students   []StudentProgress `json:"students"`
}

// transcriptSyncResponse answers PUT /api/sessions/{id}/transcript. Free or
// already ended sessions only carry the first four fields; active assignment
// sessions add maxTurns and reason, and jev when the judge ran.
type transcriptSyncResponse struct {
	Status   string       `json:"status"`
	Turns    int          `json:"turns"`
	Progress int          `json:"progress"`
	Ended    bool         `json:"ended"`
	MaxTurns *int         `json:"maxTurns,omitempty"`
	Reason   *string      `json:"reason,omitempty"`
	Jev      *JudgeResult `json:"jev,omitempty"`
}

// ---------- AI gateway ----------

type aiStatusResponse struct {
	Text        bool `json:"text"`
	Live        bool `json:"live"`
	Judge       bool `json:"judge"`
	LoggedIn    bool `json:"loggedIn"`
	GuestAccess bool `json:"guestAccess"`
}

type generateResponse struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

// Server-sent events of a streamed generation.
type (
	streamDelta struct {
		Delta string `json:"delta"`
	}
	streamError struct {
		Error string `json:"error"`
	}
	streamDone struct {
		Done     bool   `json:"done"`
		Provider string `json:"provider"`
		Model    string `json:"model"`
	}
)

type liveUsageResponse struct {
	OK      bool    `json:"ok"`
	CostUSD float64 `json:"costUsd"`
}

// ---------- admin ----------

type userCounts struct {
	Admin   int `json:"admin"`
	Teacher int `json:"teacher"`
	Student int `json:"student"`
}

type adminOverviewResponse struct {
	Users           userCounts `json:"users"`
	Classes         int        `json:"classes"`
	Assignments     int        `json:"assignments"`
	Sessions        int        `json:"sessions"`
	PendingInvites  int        `json:"pendingInvites"`
	Providers       int        `json:"providers"`
	MonthSpendUSD   float64    `json:"monthSpendUsd"`
	TodaySpendUSD   float64    `json:"todaySpendUsd"`
	MonthBudgetUSD  float64    `json:"monthBudgetUsd"`
	BudgetExceeded  bool       `json:"budgetExceeded"`
	RequestsToday   int        `json:"requestsToday"`
	ErrorsToday     int        `json:"errorsToday"`
	MailConfigured  bool       `json:"mailConfigured"`
	RoutingComplete bool       `json:"routingComplete"`
}

type settingsResponse struct {
	General         GeneralSettings `json:"general"`
	SMTP            SMTPSettings    `json:"smtp"`
	SMTPHasPassword bool            `json:"smtpHasPassword"`
	Budget          BudgetSettings  `json:"budget"`
	Routing         RoutingSettings `json:"routing"`
	Jev             JevSettings     `json:"jev"`
	Tasks           []string        `json:"tasks"`
}

type usageSummaryResponse struct {
	Days          int                     `json:"days"`
	ByDay         []domain.UsageAggregate `json:"byDay"`
	ByModel       []domain.UsageAggregate `json:"byModel"`
	ByTask        []domain.UsageAggregate `json:"byTask"`
	ByProvider    []domain.UsageAggregate `json:"byProvider"`
	ByUser        []domain.UsageAggregate `json:"byUser"`
	ByClass       []domain.UsageAggregate `json:"byClass"`
	MonthSpendUSD float64                 `json:"monthSpendUsd"`
	Budget        BudgetSettings          `json:"budget"`
}
