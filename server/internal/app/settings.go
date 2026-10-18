package app

// loadSetting returns the stored value of key, or def when it is missing or invalid.
func loadSetting[T any](st settingsStore, key string, def T) T {
	out := def
	if !st.Load(key, &out) {
		return def
	}
	return out
}

// Task names the router knows about. Each task has its own ordered list of
// provider/model targets so the admin can, for example, use a free model for
// character chat, a stronger one for evaluations and Jev as the judge.
const (
	TaskChat       = "chat"
	TaskEvaluation = "evaluation"
	TaskUtility    = "utility"
	TaskJudge      = "judge"
	TaskLive       = "live"
)

var AllTasks = []string{TaskChat, TaskEvaluation, TaskUtility, TaskJudge, TaskLive}

type GeneralSettings struct {
	SiteName              string `json:"siteName"`
	DefaultLocale         string `json:"defaultLocale"`
	PublicURL             string `json:"publicUrl"`
	GuestAccess           bool   `json:"guestAccess"`
	GuestLive             bool   `json:"guestLive"`
	GuestRequestsPerHour  int    `json:"guestRequestsPerHour"`
	StudentRequestsPerDay int    `json:"studentRequestsPerDay"`
	AllowJoinByCode       bool   `json:"allowJoinByCode"`
	LiveEnabled           bool   `json:"liveEnabled"`
}

func defaultGeneral() GeneralSettings {
	return GeneralSettings{
		SiteName:              "AiDebate.tech",
		DefaultLocale:         "it",
		GuestAccess:           true,
		GuestLive:             false,
		GuestRequestsPerHour:  60,
		StudentRequestsPerDay: 400,
		AllowJoinByCode:       true,
		LiveEnabled:           true,
	}
}

type SMTPSettings struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password,omitempty"` // stored encrypted
	From     string `json:"from"`
	Security string `json:"security"` // starttls | tls | none
}

type BudgetSettings struct {
	MonthlyUSD            float64 `json:"monthlyUsd"`
	WarnPercent           int     `json:"warnPercent"`
	BlockPaidWhenExceeded bool    `json:"blockPaidWhenExceeded"`
}

type RouteTarget struct {
	ProviderID int64  `json:"providerId"`
	Model      string `json:"model"`
}

type RoutingSettings struct {
	// ordered: try targets in the configured order.
	// free_first: free targets first, then the rest in order.
	// cheapest: sort by known price (input+output per 1M).
	Strategy     string                   `json:"strategy"`
	Tasks        map[string][]RouteTarget `json:"tasks"`
	DefaultVoice string                   `json:"defaultVoice"`
}

type JevSettings struct {
	Enabled       bool    `json:"enabled"`
	Threshold     float64 `json:"threshold"`
	EvaluateEvery int     `json:"evaluateEvery"`
	MaxStateChars int     `json:"maxStateChars"`
}

func defaultJev() JevSettings {
	return JevSettings{Enabled: true, Threshold: defaultJudgeThreshold, EvaluateEvery: 1, MaxStateChars: 24000}
}

func (s *Server) general() GeneralSettings {
	return loadSetting(s.settings, "general", defaultGeneral())
}

func (s *Server) budget() BudgetSettings {
	return loadSetting(s.settings, "budget", BudgetSettings{MonthlyUSD: 0, WarnPercent: 80, BlockPaidWhenExceeded: true})
}

func (s *Server) routing() RoutingSettings {
	r := loadSetting(s.settings, "routing", RoutingSettings{Strategy: StrategyOrdered, Tasks: map[string][]RouteTarget{}, DefaultVoice: "Aoede"})
	if r.Tasks == nil {
		r.Tasks = map[string][]RouteTarget{}
	}
	return r
}

func (s *Server) jevSettings() JevSettings {
	return loadSetting(s.settings, "jev", defaultJev())
}

func (s *Server) smtp() SMTPSettings {
	st := loadSetting(s.settings, "smtp", s.cfg.SMTP)
	if st.Host == "" {
		st = s.cfg.SMTP
		return st
	}
	if pw, err := s.crypto.Decrypt(st.Password); err == nil {
		st.Password = pw
	}
	return st
}
