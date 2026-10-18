package app

import (
	"context"
	"database/sql"
	"log"

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

	Crypto        *Crypto
	Settings      *settingsService
	Mailer        mailer
	Gateway       *aiGateway
	Accounts      *authService
	ClassSvc      *classService
	AssignmentSvc *assignmentService
	SessionSvc    *sessionService
}

// NewServices builds every repository on db and every service on them.
func NewServices(cfg Config, db *sql.DB) *Services {
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
		Crypto:        NewCrypto(cfg.Secret),
	}
	sv.Settings = &settingsService{store: sv.SettingsStore, crypto: sv.Crypto, smtpDefaults: cfg.SMTP}
	sv.Mailer = smtpMailer{settings: sv.Settings}
	siteName := func() string { return sv.Settings.General().SiteName }
	sv.Gateway = newAIGateway(sv.Providers, sv.Prices, sv.Usage, sv.Sessions, sv.Settings, sv.Crypto)
	sv.Accounts = &authService{users: sv.Users, logins: sv.Logins, invites: sv.Invites, classes: sv.Classes, mail: sv.Mailer, siteName: siteName}
	sv.ClassSvc = &classService{classes: sv.Classes, users: sv.Users, accounts: sv.Accounts, mail: sv.Mailer,
		siteName: siteName, mailOn: sv.Settings.MailConfigured}
	sv.AssignmentSvc = &assignmentService{assignments: sv.Assignments, classes: sv.Classes, sessions: sv.Sessions, classSvc: sv.ClassSvc,
		listeners: []assignmentListener{mailNotifier{classes: sv.Classes, mail: sv.Mailer, siteName: siteName}}}
	sv.SessionSvc = &sessionService{sessions: sv.Sessions, assignments: sv.Assignments, classes: sv.Classes, classSvc: sv.ClassSvc,
		judge: sv.Gateway, jevSettings: sv.Settings.Jev}
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
		id, err := sv.Gateway.insertProvider(name, kind, baseURL, key)
		if err != nil {
			log.Printf("bootstrap %s: %v", name, err)
			return 0
		}
		if cp, err := sv.Gateway.provider(id); err == nil {
			ctx, cancel := context.WithTimeout(context.Background(), modelListTimeout)
			if models, err := cp.p.ListModels(ctx); err == nil && len(models) > 0 {
				sv.Gateway.storeModels(id, models)
			} else if err != nil {
				log.Printf("bootstrap %s: listing models failed: %v", name, err)
			}
			cancel()
		}
		sv.Gateway.autoRoute(id, kind)
		log.Printf("configured %s from environment", name)
		return id
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
