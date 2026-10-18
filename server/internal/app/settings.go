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

// settingsService reads and writes the admin settings with their defaults;
// the SMTP password is kept encrypted at rest.
type settingsService struct {
	store        settingsStore
	crypto       *Crypto
	smtpDefaults SMTPSettings // from the environment
}

// Setting keys.
const (
	settingGeneral = "general"
	settingSMTP    = "smtp"
	settingBudget  = "budget"
	settingRouting = "routing"
	settingJev     = "jev"
)

func (c *settingsService) General() GeneralSettings {
	return loadSetting(c.store, settingGeneral, defaultGeneral())
}

func (c *settingsService) Budget() BudgetSettings {
	return loadSetting(c.store, settingBudget, BudgetSettings{MonthlyUSD: 0, WarnPercent: 80, BlockPaidWhenExceeded: true})
}

func (c *settingsService) Routing() RoutingSettings {
	r := loadSetting(c.store, settingRouting, RoutingSettings{Strategy: StrategyOrdered, Tasks: map[string][]RouteTarget{}, DefaultVoice: "Aoede"})
	if r.Tasks == nil {
		r.Tasks = map[string][]RouteTarget{}
	}
	return r
}

func (c *settingsService) Jev() JevSettings {
	return loadSetting(c.store, settingJev, defaultJev())
}

// SMTP returns the mail settings with the password decrypted; without a
// configured host the environment defaults apply.
func (c *settingsService) SMTP() SMTPSettings {
	st := loadSetting(c.store, settingSMTP, c.smtpDefaults)
	if st.Host == "" {
		return c.smtpDefaults
	}
	if pw, err := c.crypto.Decrypt(st.Password); err == nil {
		st.Password = pw
	}
	return st
}

// MailConfigured reports whether e-mails can be sent.
func (c *settingsService) MailConfigured() bool { return c.SMTP().Host != "" }

func (c *settingsService) SaveGeneral(v GeneralSettings) error {
	v.DefaultLocale = normLocale(v.DefaultLocale)
	return c.store.Save(settingGeneral, v)
}

// SaveSMTP encrypts a new password; an empty one keeps the stored password.
func (c *settingsService) SaveSMTP(v SMTPSettings) error {
	if v.Password == "" {
		v.Password = loadSetting(c.store, settingSMTP, SMTPSettings{}).Password
	} else {
		v.Password = c.crypto.Encrypt(v.Password)
	}
	if v.Port == 0 {
		v.Port = 587
	}
	return c.store.Save(settingSMTP, v)
}

func (c *settingsService) SaveBudget(v BudgetSettings) error { return c.store.Save(settingBudget, v) }

func (c *settingsService) SaveRouting(v RoutingSettings) error {
	if v.Tasks == nil {
		v.Tasks = map[string][]RouteTarget{}
	}
	return c.store.Save(settingRouting, v)
}

func (c *settingsService) SaveJev(v JevSettings) error { return c.store.Save(settingJev, v) }
