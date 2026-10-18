package app

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ---------- provider registry ----------

// aiGateway is the AI side of the platform: it builds provider adapters
// (cached), prices and meters every call, enforces the budget, orders the
// route targets of a task and runs the fallback chain for chat and judging.
type aiGateway struct {
	providers providerStore
	prices    priceStore
	usage     usageStore
	sessions  sessionStore // to add the cost of a call to its session
	settings  *settingsService
	crypto    *Crypto

	// newProvider builds an adapter from its configuration (ai.New unless
	// replaced with WithProviderFactory).
	newProvider func(ai.Config) (ai.Provider, error)

	provMu sync.Mutex
	provs  map[int64]cachedProvider
}

func newAIGateway(providers providerStore, prices priceStore, usage usageStore, sessions sessionStore, settings *settingsService, crypto *Crypto) *aiGateway {
	return &aiGateway{providers: providers, prices: prices, usage: usage, sessions: sessions, settings: settings, crypto: crypto,
		newProvider: ai.New, provs: map[int64]cachedProvider{}}
}

type cachedProvider struct {
	p    ai.Provider
	cfg  ai.Config
	name string
}

func (g *aiGateway) insertProvider(name, kind, baseURL, apiKey string) (int64, error) {
	return g.providers.Create(name, kind, strings.TrimSpace(baseURL), g.crypto.Encrypt(strings.TrimSpace(apiKey)))
}

func (g *aiGateway) invalidateProvider(id int64) {
	g.provMu.Lock()
	delete(g.provs, id)
	g.provMu.Unlock()
}

// provider returns a ready adapter for an enabled provider.
func (g *aiGateway) provider(id int64) (*cachedProvider, error) {
	g.provMu.Lock()
	defer g.provMu.Unlock()
	if cp, ok := g.provs[id]; ok {
		return &cp, nil
	}
	rec, err := g.providers.Get(id)
	if err != nil {
		return nil, fmt.Errorf("provider %d not found", id)
	}
	if !rec.Enabled {
		return nil, fmt.Errorf("provider %s is disabled", rec.Name)
	}
	key, err := g.crypto.Decrypt(rec.APIKeyEnc)
	if err != nil {
		return nil, err
	}
	cfg := ai.Config{ID: id, Name: rec.Name, Kind: rec.Kind, BaseURL: rec.BaseURL, APIKey: key}
	p, err := g.newProvider(cfg)
	if err != nil {
		return nil, err
	}
	cp := cachedProvider{p: p, cfg: cfg, name: rec.Name}
	g.provs[id] = cp
	return &cp, nil
}

// ---------- pricing & budget ----------

type price struct {
	In, Out float64
	Known   bool
}

func (g *aiGateway) priceFor(providerID int64, model string) price {
	if in, out, ok := g.prices.Get(providerID, model); ok {
		return price{in, out, true}
	}
	if ai.IsLikelyFree(g.providers.BaseURL(providerID), model) {
		return price{0, 0, true}
	}
	return price{}
}

func MonthStart() string {
	n := time.Now().UTC()
	return time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
}

func (g *aiGateway) MonthSpend() float64 {
	return g.usage.SpendSince(MonthStart())
}

func (g *aiGateway) BudgetExceeded() bool {
	b := g.settings.Budget()
	return b.MonthlyUSD > 0 && b.BlockPaidWhenExceeded && g.MonthSpend() >= b.MonthlyUSD
}

// ---------- usage log ----------

type usageEntry struct {
	UserID     *int64
	SessionID  *int64
	ProviderID int64
	Provider   string
	Model      string
	Task       string
	Usage      ai.Usage
	OK         bool
	Latency    time.Duration
	Err        string
}

func (g *aiGateway) logUsage(e usageEntry) float64 {
	var cost float64
	if e.Usage.CostUSD != nil && *e.Usage.CostUSD >= 0 {
		cost = *e.Usage.CostUSD
	} else {
		p := g.priceFor(e.ProviderID, e.Model)
		cost = (float64(e.Usage.InputTokens)*p.In + float64(e.Usage.OutputTokens)*p.Out) / 1e6
	}
	logIfErr("usage log", g.usage.Insert(domain.UsageRecord{
		UserID: e.UserID, SessionID: e.SessionID, ProviderID: e.ProviderID, Provider: e.Provider, Model: e.Model, Task: e.Task,
		InputTokens: e.Usage.InputTokens, OutputTokens: e.Usage.OutputTokens, CostUSD: cost, OK: e.OK,
		LatencyMs: e.Latency.Milliseconds(), Error: e.Err,
	}))
	if e.SessionID != nil && cost > 0 {
		logIfErr("add session cost", g.sessions.AddCost(*e.SessionID, cost))
	}
	return cost
}

// retryable tells whether another target should be tried after err.
func retryable(err error) bool {
	var he *ai.HTTPError
	if errors.As(err, &he) {
		return he.Status == 429 || he.Status >= 500 || he.Status == 404 || he.Status == 403 || he.Status == 401 || he.Status == 400
	}
	return !errors.Is(err, context.Canceled)
}

type GenResult struct {
	Text       string
	ProviderID int64
	Provider   string
	Model      string
}

// firstTokenTimeout bounds how long a streamed answer may stay silent before
// the next target is tried. Free models are often queued for minutes.
var firstTokenTimeout = 25 * time.Second

var ErrNoTargets = errors.New("no AI model is configured for this task (ask the administrator to configure providers)")

// generate runs a request through the fallback chain. When onDelta is non-nil
// the response is streamed; fallback only happens before the first delta.
func (g *aiGateway) Generate(ctx context.Context, task string, req ai.Request, userID, sessionID *int64, onDelta func(string) error) (*GenResult, error) {
	targets := g.Targets(task)
	if len(targets) == 0 {
		if g.BudgetExceeded() {
			return nil, errors.New("monthly AI budget exhausted and no free model is configured")
		}
		return nil, ErrNoTargets
	}
	var out *GenResult
	var started atomic.Bool
	err := g.runFallbackChain("ai "+task, targets, func(t RouteTarget, cp *cachedProvider) error {
		tm, ok := cp.p.(ai.TextModel)
		if !ok {
			return errSkipTarget // e.g. Jev only answers structured questions (see judge.go)
		}
		r := req
		r.Model = t.Model
		if r.ReasoningEffort == "" && (task == TaskChat || task == TaskUtility) {
			r.ReasoningEffort = "low" // characters must answer quickly
		}
		model := g.meterText(ai.WithFirstTokenTimeout(tm, firstTokenTimeout),
			usageEntry{UserID: userID, SessionID: sessionID, ProviderID: t.ProviderID, Provider: cp.name, Model: t.Model, Task: task})
		var res *ai.Response
		var err error
		if onDelta != nil {
			res, err = model.Stream(ctx, r, func(d string) error {
				started.Store(true)
				return onDelta(d)
			})
		} else {
			res, err = model.Generate(ctx, r)
		}
		if err != nil {
			return err
		}
		out = &GenResult{Text: res.Text, ProviderID: t.ProviderID, Provider: cp.name, Model: t.Model}
		return nil
	}, func(err error) bool {
		// Fall back only before the student saw any text, and only for
		// errors another model may not have (a silent model is one).
		return started.Load() || !retryable(err) || ctx.Err() != nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
