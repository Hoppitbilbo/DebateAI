package httpapi

import (
	"net/http"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
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
	// Temporary rooms: whether they exist and whether a teacher without an
	// account may open one.
	RoomsEnabled   bool `json:"roomsEnabled"`
	AnonymousRooms bool `json:"anonymousRooms"`
	RoomMaxMinutes int  `json:"roomMaxMinutes"`
}

type meResponse struct {
	User *domain.User `json:"user"`
}

type inviteInfoResponse struct {
	Email      string `json:"email"`
	Role       string `json:"role"`
	ClassName  string `json:"className"`
	InvitedBy  string `json:"invitedBy"`
	Locale     string `json:"locale"`
	UserExists bool   `json:"userExists"`
}

type inviteResultsResponse struct {
	Results []app.InviteResult `json:"results"`
}

// ---------- classes ----------

type classProgressResponse struct {
	Cells []domain.ProgressCell `json:"cells"`
}

type classDetailResponse struct {
	Class   *domain.Class   `json:"class"`
	Members []domain.Member `json:"members"`
	Invites []domain.Invite `json:"invites"`
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
	Assignment *domain.Assignment    `json:"assignment"`
	Students   []app.StudentProgress `json:"students"`
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
	General         app.GeneralSettings `json:"general"`
	SMTP            app.SMTPSettings    `json:"smtp"`
	SMTPHasPassword bool                `json:"smtpHasPassword"`
	Budget          app.BudgetSettings  `json:"budget"`
	Routing         app.RoutingSettings `json:"routing"`
	Jev             app.JevSettings     `json:"jev"`
	Rooms           app.RoomSettings    `json:"rooms"`
	Tasks           []string            `json:"tasks"`
	RoomTasks       []string            `json:"roomTasks"`
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
	Budget        app.BudgetSettings      `json:"budget"`
}

// rejoinPINResponse is the one-time PIN a teacher reads to a guest.
type rejoinPINResponse struct {
	PIN string `json:"pin"`
}
