package app

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/Hoppitbilbo/DebateAI/server/internal/store"
)

// Services is the application: the repositories and the services built on
// them. NewServices is the composition root that wires them together.
type Services struct {
	SettingsStore settingsStore
	Users         userStore
	Logins        authSessionStore
	Invites       inviteStore
	Classes       classStore
	Assignments   assignmentStore
	Sessions      sessionStore
	Providers     providerStore
	Prices        priceStore
	Usage         usageStore
	Rooms         roomStore

	Crypto        *Crypto
	Settings      *settingsService
	Mailer        mailer
	Gateway       *aiGateway
	Accounts      *authService
	ClassSvc      *classService
	AssignmentSvc *assignmentService
	SessionSvc    *sessionService
	RoomSvc       *roomService
	RoomTransfer  *roomTransfer
}

// Option changes how NewServices builds the application.
type Option func(*Services)

// WithProviderFactory replaces ai.New for building AI provider adapters
// (e.g. to talk to fake models in tests).
func WithProviderFactory(f func(ai.Config) (ai.Provider, error)) Option {
	return func(sv *Services) { sv.Gateway.newProvider = f }
}

// NewServices builds every repository on db and every service on them.
func NewServices(cfg Config, db *sql.DB, opts ...Option) *Services {
	sv := &Services{
		SettingsStore: store.NewSettings(db),
		Users:         store.NewUsers(db),
		Logins:        store.NewAuthSessions(db),
		Invites:       store.NewInvites(db),
		Classes:       store.NewClasses(db),
		Assignments:   store.NewAssignments(db),
		Sessions:      store.NewActivitySessions(db),
		Providers:     store.NewProviders(db),
		Prices:        store.NewPrices(db),
		Usage:         store.NewUsage(db),
		Rooms:         store.NewRooms(db),
		Crypto:        NewCrypto(cfg.Secret),
	}
	sv.Settings = &settingsService{store: sv.SettingsStore, crypto: sv.Crypto, smtpDefaults: cfg.SMTP}
	sv.Mailer = smtpMailer{settings: sv.Settings}
	siteName := func() string { return sv.Settings.General().SiteName }
	sv.Gateway = newAIGateway(sv.Providers, sv.Prices, sv.Usage, sv.Sessions, sv.Settings, sv.Crypto)
	sv.Accounts = &authService{users: sv.Users, logins: sv.Logins, invites: sv.Invites, classes: sv.Classes, mail: sv.Mailer, siteName: siteName}
	sv.ClassSvc = &classService{classes: sv.Classes, rooms: sv.Rooms, users: sv.Users, accounts: sv.Accounts, mail: sv.Mailer,
		siteName: siteName, mailOn: sv.Settings.MailConfigured}
	sv.AssignmentSvc = &assignmentService{assignments: sv.Assignments, classes: sv.Classes, sessions: sv.Sessions, classSvc: sv.ClassSvc,
		listeners: []assignmentListener{mailNotifier{classes: sv.Classes, mail: sv.Mailer, siteName: siteName}}}
	sv.SessionSvc = &sessionService{sessions: sv.Sessions, assignments: sv.Assignments, classes: sv.Classes, classSvc: sv.ClassSvc,
		judge: sv.Gateway, jevSettings: sv.Settings.Jev,
		listeners: []feedbackListener{feedbackMailer{users: sv.Users, mail: sv.Mailer, siteName: siteName}}}
	sv.RoomSvc = &roomService{rooms: sv.Rooms, sessions: sv.Sessions, assignments: sv.Assignments, classSvc: sv.ClassSvc,
		accounts: sv.Accounts, usage: sv.Usage, settings: sv.Settings.Rooms, aiReady: sv.Gateway.RoomChatReady, now: time.Now}
	sv.RoomTransfer = &roomTransfer{rooms: sv.Rooms, sessions: sv.Sessions, assignments: sv.Assignments, classes: sv.Classes, classSvc: sv.ClassSvc,
		crypto: sv.Crypto, endRoom: sv.RoomSvc.End, now: time.Now}
	for _, opt := range opts {
		opt(sv)
	}
	return sv
}

// bootstrap creates the first admin and default providers from environment
// variables so a fresh server is usable with `ADMIN_EMAIL=... GEMINI_API_KEY=...`.
func (sv *Services) Bootstrap(cfg Config) {
	if cfg.AdminEmail != "" && cfg.AdminPassword != "" && sv.Users.Count("") == 0 {
		if _, err := sv.Accounts.CreateUser(cfg.AdminEmail, cfg.AdminName, cfg.AdminPassword, domain.RoleAdmin, "it"); err != nil {
			log.Printf("bootstrap admin: %v", err)
		} else {
			log.Printf("created admin user %s", cfg.AdminEmail)
		}
	}
	if sv.Providers.Count(false) > 0 {
		return
	}
	// Same path as adding a provider in the admin panel: list models, import
	// prices, then let autoRoute pick sensible defaults per task.
	add := func(name, kind, baseURL, key string) int64 {
		p, err := sv.Gateway.AddProvider(context.Background(), NewProvider{Name: name, Kind: kind, BaseURL: baseURL, APIKey: key})
		if err != nil {
			log.Printf("bootstrap %s: %v", name, err)
			return 0
		}
		log.Printf("configured %s from environment", name)
		return p.ID
	}
	if cfg.OpenRouterKey != "" {
		if id := add("OpenRouter", "openai", "https://openrouter.ai/api/v1", cfg.OpenRouterKey); id != 0 {
			// openrouter/free is OpenRouter's own router over its free models:
			// a stable id that keeps working as individual free models change.
			rt := sv.Settings.Routing()
			for _, task := range []string{TaskChat, TaskEvaluation, TaskUtility, TaskJudge} {
				rt.Tasks[task] = []RouteTarget{{id, "openrouter/free"}}
			}
			if err := sv.Settings.SaveRouting(rt); err != nil {
				log.Printf("bootstrap OpenRouter routing: %v", err)
			}
		}
	}
	if cfg.GeminiAPIKey != "" {
		add("Google Gemini", "gemini", "", cfg.GeminiAPIKey)
	}
	if cfg.OpencodeKey != "" {
		add("OpenCode Zen", "openai", "https://opencode.ai/inference/openai/v1", cfg.OpencodeKey)
		add("OpenCode Jev", "jev", "https://opencode.ai/inference/systemone/v1/systemone", cfg.OpencodeKey)
	}
	if cfg.TypeSafeKey != "" {
		add("TypeSafe Jev", "jev", "https://api.typesafe.ai/v1", cfg.TypeSafeKey)
	}
}
