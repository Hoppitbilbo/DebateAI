package app

import "github.com/Hoppitbilbo/DebateAI/server/internal/domain"

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

func DefaultGeneral() GeneralSettings {
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

// RoomSettings configure the temporary rooms ("aula lampo"): who may open
// them, their limits and the AI models their guests use.
type RoomSettings struct {
	Enabled                bool `json:"enabled"`
	AllowAnonymousTeachers bool `json:"allowAnonymousTeachers"`
	MaxMinutes             int  `json:"maxMinutes"` // at most domain.MaxRoomDuration
	MaxGuests              int  `json:"maxGuests"`
	// Limits are per guest and per room, never per IP: a school lab
	// reaches the server from a single address.
	RequestsPerGuestPerHour int `json:"requestsPerGuestPerHour"`
	MaxRequestsPerRoom      int `json:"maxRequestsPerRoom"`
	MaxOpenAnonymousRooms   int `json:"maxOpenAnonymousRooms"`
	// Tasks routes the guests' AI calls; an empty task uses the main
	// routing. FreeOnly drops every target that is not known to be free.
	Tasks    map[string][]RouteTarget `json:"tasks"`
	FreeOnly bool                     `json:"freeOnly"`
}

// RoomTasks are the tasks a room may route to its own models (no live voice).
var RoomTasks = []string{TaskChat, TaskEvaluation, TaskUtility, TaskJudge}

func DefaultRooms() RoomSettings {
	return RoomSettings{
		Enabled: true, AllowAnonymousTeachers: true, MaxMinutes: 120, MaxGuests: 40,
		RequestsPerGuestPerHour: 120, MaxRequestsPerRoom: 3000, MaxOpenAnonymousRooms: 50,
		Tasks: map[string][]RouteTarget{}, FreeOnly: true,
	}
}

// normalize keeps the limits inside their allowed ranges.
func (r RoomSettings) normalize() RoomSettings {
	maxMinutes := int(domain.MaxRoomDuration.Minutes())
	if r.MaxMinutes <= 0 || r.MaxMinutes > maxMinutes {
		r.MaxMinutes = maxMinutes
	}
	if r.MaxGuests <= 0 {
		r.MaxGuests = DefaultRooms().MaxGuests
	}
	if r.Tasks == nil {
		r.Tasks = map[string][]RouteTarget{}
	}
	return r
}

func DefaultJev() JevSettings {
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
	SettingGeneral = "general"
	SettingSMTP    = "smtp"
	SettingBudget  = "budget"
	SettingRouting = "routing"
	SettingJev     = "jev"
	SettingRooms   = "rooms"
)

func (c *settingsService) General() GeneralSettings {
	return loadSetting(c.store, SettingGeneral, DefaultGeneral())
}

func (c *settingsService) Budget() BudgetSettings {
	return loadSetting(c.store, SettingBudget, BudgetSettings{MonthlyUSD: 0, WarnPercent: 80, BlockPaidWhenExceeded: true})
}

func (c *settingsService) Routing() RoutingSettings {
	r := loadSetting(c.store, SettingRouting, RoutingSettings{Strategy: StrategyOrdered, Tasks: map[string][]RouteTarget{}, DefaultVoice: "Aoede"})
	if r.Tasks == nil {
		r.Tasks = map[string][]RouteTarget{}
	}
	return r
}

func (c *settingsService) Rooms() RoomSettings {
	return loadSetting(c.store, SettingRooms, DefaultRooms()).normalize()
}

func (c *settingsService) SaveRooms(v RoomSettings) error {
	return c.store.Save(SettingRooms, v.normalize())
}

func (c *settingsService) Jev() JevSettings {
	return loadSetting(c.store, SettingJev, DefaultJev())
}

// SMTP returns the mail settings with the password decrypted; without a
// configured host the environment defaults apply.
func (c *settingsService) SMTP() SMTPSettings {
	st := loadSetting(c.store, SettingSMTP, c.smtpDefaults)
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
	v.DefaultLocale = NormLocale(v.DefaultLocale)
	return c.store.Save(SettingGeneral, v)
}

// SaveSMTP encrypts a new password; an empty one keeps the stored password.
func (c *settingsService) SaveSMTP(v SMTPSettings) error {
	if v.Password == "" {
		v.Password = loadSetting(c.store, SettingSMTP, SMTPSettings{}).Password
	} else {
		v.Password = c.crypto.Encrypt(v.Password)
	}
	if v.Port == 0 {
		v.Port = 587
	}
	return c.store.Save(SettingSMTP, v)
}

func (c *settingsService) SaveBudget(v BudgetSettings) error { return c.store.Save(SettingBudget, v) }

func (c *settingsService) SaveRouting(v RoutingSettings) error {
	if v.Tasks == nil {
		v.Tasks = map[string][]RouteTarget{}
	}
	return c.store.Save(SettingRouting, v)
}

func (c *settingsService) SaveJev(v JevSettings) error { return c.store.Save(SettingJev, v) }
