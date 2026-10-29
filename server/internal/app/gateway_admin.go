package app

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Provider administration and the Live voice endpoints of the gateway.

var (
	ErrBadProvider      = errors.New("name and a valid kind are required")
	ErrProviderNotFound = errors.New("provider not found")
	// ErrProviderSetup wraps failures to build the adapter (disabled, bad
	// key...), as opposed to failures of the upstream call itself.
	ErrProviderSetup = errors.New("provider not usable")
	ErrNoText        = errors.New("provider cannot generate text")
)

// ProviderView is a provider as the admin sees it: the API key is never
// sent, only whether it is set and a hint to recognise it.
type ProviderView struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	Kind      string         `json:"kind"`
	BaseURL   string         `json:"baseUrl"`
	HasKey    bool           `json:"hasKey"`
	KeyHint   string         `json:"keyHint,omitempty"`
	Models    []ai.ModelInfo `json:"models"`
	Enabled   bool           `json:"enabled"`
	CreatedAt string         `json:"createdAt"`
}

func (g *aiGateway) ProviderViews() []ProviderView {
	out := []ProviderView{}
	for _, rec := range g.providers.List() {
		p := ProviderView{ID: rec.ID, Name: rec.Name, Kind: rec.Kind, BaseURL: rec.BaseURL, Models: rec.Models, Enabled: rec.Enabled, CreatedAt: rec.CreatedAt}
		if key, err := g.crypto.Decrypt(rec.APIKeyEnc); err == nil && key != "" {
			p.HasKey = true
			if len(key) > 8 {
				p.KeyHint = key[:3] + "…" + key[len(key)-4:]
			}
		}
		out = append(out, p)
	}
	return out
}

func (g *aiGateway) providerView(id int64) (*ProviderView, error) {
	for _, p := range g.ProviderViews() {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, ErrProviderNotFound
}

// NewProvider is the admin's form to add a provider; Models is a preset
// list used only when the provider cannot list its own.
type NewProvider struct {
	Name, Kind, BaseURL, APIKey string
	Models                      []ai.ModelInfo `json:"models"`
}

// AddProvider stores a provider, imports its models and prices, and routes
// the tasks still without a model to it (see route_policies.go).
func (g *aiGateway) AddProvider(ctx context.Context, in NewProvider) (*ProviderView, error) {
	if strings.TrimSpace(in.Name) == "" || !ai.KnownKind(in.Kind) {
		return nil, ErrBadProvider
	}
	id, err := g.insertProvider(strings.TrimSpace(in.Name), in.Kind, in.BaseURL, in.APIKey)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, modelListTimeout)
	defer cancel()
	models, err := g.listModels(ctx, id)
	switch {
	case err == nil && len(models) > 0:
		g.storeModels(id, models)
	case len(in.Models) > 0:
		g.storeModels(id, in.Models)
	}
	if err != nil {
		log.Printf("provider %s: listing models failed: %v", in.Name, err)
	}
	g.autoRoute(id, in.Kind)
	return g.providerView(id)
}

// ProviderChange lists the provider fields to change.
type ProviderChange struct {
	Name    *string `json:"name"`
	BaseURL *string `json:"baseUrl"`
	APIKey  *string `json:"apiKey"`
	Enabled *bool   `json:"enabled"`
}

func (g *aiGateway) UpdateProvider(id int64, c ProviderChange) (*ProviderView, error) {
	p := domain.ProviderPatch{Enabled: c.Enabled}
	if c.Name != nil && strings.TrimSpace(*c.Name) != "" {
		p.Name = ptr(strings.TrimSpace(*c.Name))
	}
	if c.BaseURL != nil {
		p.BaseURL = ptr(strings.TrimSpace(*c.BaseURL))
	}
	if c.APIKey != nil && *c.APIKey != "" {
		p.APIKeyEnc = ptr(g.crypto.Encrypt(strings.TrimSpace(*c.APIKey)))
	}
	err := g.providers.Update(id, p)
	g.invalidateProvider(id)
	if err != nil {
		return nil, err
	}
	return g.providerView(id)
}

// DeleteProvider removes a provider and its targets from every task.
func (g *aiGateway) DeleteProvider(id int64) error {
	if err := g.providers.Delete(id); err != nil {
		return err
	}
	g.invalidateProvider(id)
	rt := g.settings.Routing()
	for task, list := range rt.Tasks {
		kept := list[:0:0]
		for _, t := range list {
			if t.ProviderID != id {
				kept = append(kept, t)
			}
		}
		rt.Tasks[task] = kept
	}
	return g.settings.SaveRouting(rt)
}

// RefreshModels asks the provider for its current model list and stores it.
func (g *aiGateway) RefreshModels(ctx context.Context, id int64) ([]ai.ModelInfo, error) {
	g.invalidateProvider(id)
	ctx, cancel := context.WithTimeout(ctx, modelRefreshTimeout)
	defer cancel()
	models, err := g.listModels(ctx, id)
	if err != nil {
		return nil, err
	}
	g.storeModels(id, models)
	return models, nil
}

func (g *aiGateway) listModels(ctx context.Context, id int64) ([]ai.ModelInfo, error) {
	cp, err := g.provider(id)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderSetup, err)
	}
	return cp.p.ListModels(ctx)
}

// ProviderTestResult: Usage is reported for text models only.
type ProviderTestResult struct {
	OK        bool      `json:"ok"`
	LatencyMs int64     `json:"latencyMs"`
	Output    string    `json:"output"`
	Usage     *ai.Usage `json:"usage,omitempty"`
}

// TestProvider sends a tiny request to a model (a structured question for
// Jev) and reports how long it took; the call is metered like any other.
func (g *aiGateway) TestProvider(ctx context.Context, id int64, model string, userID int64) (*ProviderTestResult, error) {
	g.invalidateProvider(id)
	cp, err := g.provider(id)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderSetup, err)
	}
	ctx, cancel := context.WithTimeout(ctx, providerTestTimeout)
	defer cancel()
	start := time.Now()
	entry := usageEntry{UserID: &userID, ProviderID: id, Provider: cp.name, Model: model, Task: "test"}
	if d, ok := cp.p.(ai.Decider); ok {
		state := map[string]any{"conversation": []map[string]string{
			{"from": "student", "text": "Why did you invade Russia?"},
			{"from": "Napoleon", "text": "The Tsar broke the Continental System."},
		}}
		res, err := g.meterDecider(d, entry).Decide(ctx, model, state,
			map[string]ai.JevQuestion{"asked": {Type: "noul", Instructions: "In `conversation`, did the student ask about the invasion of Russia?"}})
		if err != nil {
			return nil, err
		}
		return &ProviderTestResult{OK: true, LatencyMs: time.Since(start).Milliseconds(), Output: mustJSON(res.Answers)}, nil
	}
	tm, ok := cp.p.(ai.TextModel)
	if !ok {
		return nil, fmt.Errorf("%w: %v", ErrProviderSetup, ErrNoText)
	}
	res, err := g.meterText(tm, entry).Generate(ctx, ai.Request{Model: model, Messages: []ai.Message{{Role: ai.RoleUser, Content: "Reply with the single word: ok"}}, MaxTokens: 50})
	if err != nil {
		return nil, err
	}
	return &ProviderTestResult{OK: true, LatencyMs: time.Since(start).Milliseconds(), Output: res.Text, Usage: &res.Usage}, nil
}

// LiveToken is a short-lived Gemini Live token the browser uses directly.
type LiveToken struct {
	// GrantID identifies the conversation when its usage is reported.
	GrantID    string `json:"grantId"`
	Token      string `json:"token"`
	Model      string `json:"model"`
	ProviderID int64  `json:"providerId"`
	ExpiresAt  string `json:"expiresAt"`
	VoiceName  string `json:"voiceName"`
}

// LiveToken returns a token from the first Gemini target of the live task,
// and records the grant its usage will be reported against.
func (g *aiGateway) LiveToken(ctx context.Context, systemInstruction, voice string, userID, sessionID *int64) (*LiveToken, error) {
	if voice == "" {
		voice = g.settings.Routing().DefaultVoice
	}
	var lastErr error = ErrNoTargets
	for _, t := range g.Targets(TaskLive) {
		cp, err := g.provider(t.ProviderID)
		if err != nil || cp.cfg.Kind != ai.KindGemini {
			continue
		}
		// The audio goes straight to the provider: its cost is reserved
		// until the browser reports the usage, or the grant expires.
		reservation, err := g.reserveTokens(t, liveReservedTokens, liveReservedTokens, liveGrantTTL)
		if err != nil {
			lastErr = err
			continue
		}
		tctx, cancel := context.WithTimeout(ctx, liveTokenTimeout)
		tok, exp, err := ai.CreateLiveToken(tctx, cp.cfg, ai.LiveTokenOptions{Model: t.Model, SystemInstruction: systemInstruction, VoiceName: voice})
		cancel()
		if err != nil {
			g.releaseReservation(reservation)
			lastErr = err
			log.Printf("live token via %s/%s: %v", cp.name, t.Model, err)
			continue
		}
		now := time.Now().UTC()
		grant := domain.LiveGrant{ID: randomToken(18), UserID: userID, SessionID: sessionID, ProviderID: t.ProviderID, Model: t.Model,
			CreatedAt: now.Format(time.RFC3339), ExpiresAt: now.Add(liveGrantTTL).Format(time.RFC3339), ReservationID: reservation}
		if err := g.grants.Create(grant); err != nil {
			g.releaseReservation(reservation)
			return nil, err
		}
		return &LiveToken{GrantID: grant.ID, Token: tok, Model: t.Model, ProviderID: t.ProviderID, ExpiresAt: exp.UTC().Format(time.RFC3339), VoiceName: voice}, nil
	}
	return nil, lastErr
}

// LiveUsage is what the browser reports at the end of a Live conversation
// (the audio goes straight to Google, so only the client knows the tokens).
type LiveUsage struct {
	GrantID                   string
	UserID                    *int64 // who reports it
	InputTokens, OutputTokens int
}

// ErrLiveGrant: the report does not match a voice conversation the server
// allowed to this user, or it was already reported.
var ErrLiveGrant = errors.New("unknown or already reported live session")

// RecordLiveUsage logs a Live conversation once, against its grant, and
// returns its cost. Provider, model, attempt and duration come from the
// grant, not from the browser; the token counts still do (estimated).
func (g *aiGateway) RecordLiveUsage(u LiveUsage) (float64, error) {
	grant, err := g.grants.Consume(u.GrantID)
	if err != nil {
		return 0, ErrLiveGrant
	}
	if (grant.UserID == nil) != (u.UserID == nil) || (grant.UserID != nil && *grant.UserID != *u.UserID) {
		return 0, ErrLiveGrant
	}
	started, _ := time.Parse(time.RFC3339, grant.CreatedAt)
	took := min(time.Since(started), liveGrantTTL)
	defer g.releaseReservation(grant.ReservationID) // after the real usage is logged
	return g.logUsage(usageEntry{UserID: grant.UserID, SessionID: grant.SessionID, ProviderID: grant.ProviderID, Provider: g.providers.Name(grant.ProviderID),
		Model: grant.Model, Task: TaskLive, Usage: ai.Usage{InputTokens: u.InputTokens, OutputTokens: u.OutputTokens}, OK: true,
		Latency: took}), nil
}

// storeModels saves the model list of a provider and imports the prices it
// publishes (e.g. OpenRouter), unless the admin has set them manually.
func (g *aiGateway) storeModels(providerID int64, models []ai.ModelInfo) {
	logIfErr("store models", g.providers.SetModels(providerID, models))
	for _, m := range models {
		if m.InputPerM != nil && m.OutputPerM != nil {
			logIfErr("import price", g.prices.Import(providerID, m.ID, *m.InputPerM, *m.OutputPerM))
		} else if m.Free {
			logIfErr("import price", g.prices.Import(providerID, m.ID, 0, 0))
		}
	}
}

func usageOr(r *ai.JevResult) ai.Usage {
	if r == nil {
		return ai.Usage{}
	}
	return r.Usage
}
