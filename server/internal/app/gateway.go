package app

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// ---------- provider registry ----------

type providerRow struct {
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

type cachedProvider struct {
	p    ai.Provider
	cfg  ai.Config
	name string
}

func (s *Server) insertProvider(name, kind, baseURL, apiKey string) (int64, error) {
	res, err := s.db.Exec(`INSERT INTO providers(name, kind, base_url, api_key_enc, created_at) VALUES(?,?,?,?,?)`,
		name, kind, strings.TrimSpace(baseURL), s.crypto.Encrypt(strings.TrimSpace(apiKey)), now())
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Server) invalidateProvider(id int64) {
	s.provMu.Lock()
	delete(s.provs, id)
	s.provMu.Unlock()
}

// provider returns a ready adapter for an enabled provider.
func (s *Server) provider(id int64) (*cachedProvider, error) {
	s.provMu.Lock()
	defer s.provMu.Unlock()
	if cp, ok := s.provs[id]; ok {
		return &cp, nil
	}
	var name, kind, base, keyEnc string
	var enabled int
	if err := s.db.QueryRow(`SELECT name, kind, base_url, api_key_enc, enabled FROM providers WHERE id = ?`, id).
		Scan(&name, &kind, &base, &keyEnc, &enabled); err != nil {
		return nil, fmt.Errorf("provider %d not found", id)
	}
	if enabled != 1 {
		return nil, fmt.Errorf("provider %s is disabled", name)
	}
	key, err := s.crypto.Decrypt(keyEnc)
	if err != nil {
		return nil, err
	}
	cfg := ai.Config{ID: id, Name: name, Kind: kind, BaseURL: base, APIKey: key}
	p, err := ai.New(cfg)
	if err != nil {
		return nil, err
	}
	cp := cachedProvider{p: p, cfg: cfg, name: name}
	s.provs[id] = cp
	return &cp, nil
}

// ---------- pricing & budget ----------

type price struct {
	In, Out float64
	Known   bool
}

func (s *Server) priceFor(providerID int64, model string) price {
	var in, out float64
	if err := s.db.QueryRow(`SELECT input_per_m, output_per_m FROM model_prices WHERE provider_id = ? AND model = ?`, providerID, model).Scan(&in, &out); err == nil && in >= 0 && out >= 0 {
		return price{in, out, true}
	}
	var base string
	_ = s.db.QueryRow(`SELECT base_url FROM providers WHERE id = ?`, providerID).Scan(&base)
	if ai.IsLikelyFree(base, model) {
		return price{0, 0, true}
	}
	return price{}
}

func monthStart() string {
	n := time.Now().UTC()
	return time.Date(n.Year(), n.Month(), 1, 0, 0, 0, 0, time.UTC).Format(time.RFC3339)
}

func (s *Server) monthSpend() float64 {
	var v sql.NullFloat64
	_ = s.db.QueryRow(`SELECT SUM(cost_usd) FROM usage_log WHERE created_at >= ?`, monthStart()).Scan(&v)
	return v.Float64
}

func (s *Server) budgetExceeded() bool {
	b := s.budget()
	return b.MonthlyUSD > 0 && b.BlockPaidWhenExceeded && s.monthSpend() >= b.MonthlyUSD
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

func (s *Server) logUsage(e usageEntry) float64 {
	var cost float64
	if e.Usage.CostUSD != nil && *e.Usage.CostUSD >= 0 {
		cost = *e.Usage.CostUSD
	} else {
		p := s.priceFor(e.ProviderID, e.Model)
		cost = (float64(e.Usage.InputTokens)*p.In + float64(e.Usage.OutputTokens)*p.Out) / 1e6
	}
	ok := 0
	if e.OK {
		ok = 1
	}
	_, err := s.db.Exec(`INSERT INTO usage_log(created_at, user_id, session_id, provider_id, provider_name, model, task, input_tokens, output_tokens, cost_usd, ok, latency_ms, error)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, now(), e.UserID, e.SessionID, e.ProviderID, e.Provider, e.Model, e.Task,
		e.Usage.InputTokens, e.Usage.OutputTokens, cost, ok, e.Latency.Milliseconds(), e.Err)
	if err != nil {
		log.Printf("usage log: %v", err)
	}
	if e.SessionID != nil && cost > 0 {
		execOrLog(s.db, "add session cost", `UPDATE activity_sessions SET cost_usd = cost_usd + ? WHERE id = ?`, cost, *e.SessionID)
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

type genResult struct {
	Text       string
	ProviderID int64
	Provider   string
	Model      string
}

// firstTokenTimeout bounds how long a streamed answer may stay silent before
// the next target is tried. Free models are often queued for minutes.
var firstTokenTimeout = 25 * time.Second

var errNoTargets = errors.New("no AI model is configured for this task (ask the administrator to configure providers)")

// generate runs a request through the fallback chain. When onDelta is non-nil
// the response is streamed; fallback only happens before the first delta.
func (s *Server) generate(ctx context.Context, task string, req ai.Request, userID, sessionID *int64, onDelta func(string) error) (*genResult, error) {
	targets := s.targets(task)
	if len(targets) == 0 {
		if s.budgetExceeded() {
			return nil, errors.New("monthly AI budget exhausted and no free model is configured")
		}
		return nil, errNoTargets
	}
	var out *genResult
	var started atomic.Bool
	err := s.runFallbackChain("ai "+task, targets, func(t RouteTarget, cp *cachedProvider) error {
		tm, ok := cp.p.(ai.TextModel)
		if !ok {
			return errSkipTarget // e.g. Jev only answers structured questions (see judge.go)
		}
		r := req
		r.Model = t.Model
		if r.ReasoningEffort == "" && (task == TaskChat || task == TaskUtility) {
			r.ReasoningEffort = "low" // characters must answer quickly
		}
		model := s.meterText(ai.WithFirstTokenTimeout(tm, firstTokenTimeout),
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
		out = &genResult{Text: res.Text, ProviderID: t.ProviderID, Provider: cp.name, Model: t.Model}
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

// ---------- access control for AI endpoints ----------

func (s *Server) aiAllowed(w http.ResponseWriter, r *http.Request) (*User, bool) {
	u := s.userFromRequest(r)
	g := s.general()
	if u == nil {
		if !g.GuestAccess {
			writeErr(w, 401, "login_required", "login required to use the AI apps")
			return nil, false
		}
		if !s.limiter.allow("guest:"+clientIP(r), g.GuestRequestsPerHour, time.Hour) {
			writeErr(w, 429, "rate_limited", "too many requests from this network, retry later or log in")
			return nil, false
		}
		return nil, true
	}
	if u.Role == "student" && g.StudentRequestsPerDay > 0 {
		since := time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
		if countRows(s.db, `SELECT COUNT(*) FROM usage_log WHERE user_id = ? AND created_at >= ? AND task != 'judge'`, u.ID, since) >= g.StudentRequestsPerDay {
			writeErr(w, 429, "daily_limit", "daily AI request limit reached")
			return nil, false
		}
	}
	return u, true
}

// sessionFor validates that sessionID belongs to user; returns nil if absent.
func (s *Server) sessionFor(u *User, sessionID int64) (*int64, string, error) {
	if sessionID == 0 || u == nil {
		return nil, "", nil
	}
	var owner sql.NullInt64
	var status string
	if err := s.db.QueryRow(`SELECT user_id, status FROM activity_sessions WHERE id = ?`, sessionID).Scan(&owner, &status); err != nil {
		return nil, "", errors.New("session not found")
	}
	if !owner.Valid || owner.Int64 != u.ID {
		return nil, "", errors.New("session does not belong to you")
	}
	return &sessionID, status, nil
}

// ---------- handlers ----------

func (s *Server) handleAIStatus(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	g := s.general()
	live := g.LiveEnabled && len(s.targets(TaskLive)) > 0 && (u != nil || g.GuestLive)
	writeJSON(w, 200, aiStatusResponse{
		Text:        len(s.targets(TaskChat)) > 0 && (u != nil || g.GuestAccess),
		Live:        live,
		Judge:       s.jevSettings().Enabled && len(s.targets(TaskJudge)) > 0,
		LoggedIn:    u != nil,
		GuestAccess: g.GuestAccess,
	})
}

type generateIn struct {
	Task        string       `json:"task"`
	System      string       `json:"system"`
	Messages    []ai.Message `json:"messages"`
	SessionID   int64        `json:"sessionId"`
	Stream      bool         `json:"stream"`
	JSON        bool         `json:"json"`
	Temperature *float64     `json:"temperature"`
	MaxTokens   int          `json:"maxTokens"`
}

func (s *Server) handleGenerate(w http.ResponseWriter, r *http.Request) {
	u, ok := s.aiAllowed(w, r)
	if !ok {
		return
	}
	var in generateIn
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	switch in.Task {
	case "", TaskChat:
		in.Task = TaskChat
	case TaskEvaluation, TaskUtility:
	default:
		writeErr(w, 400, "bad_task", "unknown task")
		return
	}
	if len(in.Messages) == 0 {
		writeErr(w, 400, "bad_request", "messages required")
		return
	}
	if len(in.Messages) > maxChatHistoryMessages {
		in.Messages = in.Messages[len(in.Messages)-maxChatHistoryMessages:]
	}
	var userID *int64
	if u != nil {
		userID = &u.ID
	}
	sessionID, status, err := s.sessionFor(u, in.SessionID)
	if err != nil {
		writeErr(w, 403, "bad_session", err.Error())
		return
	}
	if sessionID != nil && in.Task == TaskChat && status != "active" {
		writeErr(w, 409, "session_ended", "this activity has ended")
		return
	}
	req := ai.Request{System: in.System, Messages: in.Messages, JSON: in.JSON, Temperature: in.Temperature, MaxTokens: in.MaxTokens}

	if !in.Stream {
		res, err := s.generate(r.Context(), in.Task, req, userID, sessionID, nil)
		if err != nil {
			writeErr(w, 502, "ai_error", err.Error())
			return
		}
		writeJSON(w, 200, generateResponse{Text: res.Text, Provider: res.Provider, Model: res.Model})
		return
	}

	flusher, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(200)
	send := func(v any) error {
		b, _ := json.Marshal(v)
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return err
		}
		if flusher != nil {
			flusher.Flush()
		}
		return nil
	}
	res, err := s.generate(r.Context(), in.Task, req, userID, sessionID, func(d string) error { return send(streamDelta{Delta: d}) })
	if err != nil {
		_ = send(streamError{Error: err.Error()})
		return
	}
	_ = send(streamDone{Done: true, Provider: res.Provider, Model: res.Model})
}

func (s *Server) handleLiveToken(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	g := s.general()
	if !g.LiveEnabled || (u == nil && !g.GuestLive) {
		writeErr(w, 403, "live_disabled", "live conversation is not enabled for this account")
		return
	}
	if _, ok := s.aiAllowed(w, r); !ok {
		return
	}
	if !s.limiter.allow(fmt.Sprintf("live:%s:%v", clientIP(r), u != nil), liveTokensLimit, time.Hour) {
		writeErr(w, 429, "rate_limited", "too many live sessions, retry later")
		return
	}
	var in struct {
		SessionID         int64  `json:"sessionId"`
		SystemInstruction string `json:"systemInstruction"`
		VoiceName         string `json:"voiceName"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	if _, status, err := s.sessionFor(u, in.SessionID); err != nil {
		writeErr(w, 403, "bad_session", err.Error())
		return
	} else if status != "" && status != "active" {
		writeErr(w, 409, "session_ended", "this activity has ended")
		return
	}
	voice := in.VoiceName
	if voice == "" {
		voice = s.routing().DefaultVoice
	}
	var lastErr error = errNoTargets
	for _, t := range s.targets(TaskLive) {
		cp, err := s.provider(t.ProviderID)
		if err != nil || cp.cfg.Kind != ai.KindGemini {
			continue
		}
		ctx, cancel := context.WithTimeout(r.Context(), liveTokenTimeout)
		tok, exp, err := ai.CreateLiveToken(ctx, cp.cfg, ai.LiveTokenOptions{Model: t.Model, SystemInstruction: in.SystemInstruction, VoiceName: voice})
		cancel()
		if err != nil {
			lastErr = err
			log.Printf("live token via %s/%s: %v", cp.name, t.Model, err)
			continue
		}
		writeJSON(w, 200, liveTokenResponse{Token: tok, Model: t.Model, ProviderID: t.ProviderID, ExpiresAt: exp.UTC().Format(time.RFC3339), VoiceName: voice})
		return
	}
	writeErr(w, 502, "live_unavailable", lastErr.Error())
}

// handleLiveUsage records token usage reported by the browser at the end of a
// Live session (the WebSocket goes directly to Google, so the server only
// learns usage from the client).
func (s *Server) handleLiveUsage(w http.ResponseWriter, r *http.Request) {
	u := s.userFromRequest(r)
	var in struct {
		SessionID    int64  `json:"sessionId"`
		ProviderID   int64  `json:"providerId"`
		Model        string `json:"model"`
		InputTokens  int    `json:"inputTokens"`
		OutputTokens int    `json:"outputTokens"`
		Seconds      int    `json:"seconds"`
	}
	if err := readJSON(r, &in); err != nil {
		writeErr(w, 400, "bad_request", err.Error())
		return
	}
	// sanity bounds: ignore absurd client values
	if in.InputTokens < 0 || in.OutputTokens < 0 || in.InputTokens > 5_000_000 || in.OutputTokens > 5_000_000 {
		writeErr(w, 400, "bad_request", "invalid usage")
		return
	}
	var userID *int64
	if u != nil {
		userID = &u.ID
	}
	sessionID, _, _ := s.sessionFor(u, in.SessionID)
	name := ""
	_ = s.db.QueryRow(`SELECT name FROM providers WHERE id = ?`, in.ProviderID).Scan(&name)
	cost := s.logUsage(usageEntry{UserID: userID, SessionID: sessionID, ProviderID: in.ProviderID, Provider: name, Model: in.Model, Task: TaskLive,
		Usage: ai.Usage{InputTokens: in.InputTokens, OutputTokens: in.OutputTokens}, OK: true, Latency: time.Duration(in.Seconds) * time.Second})
	writeJSON(w, 200, liveUsageResponse{OK: true, CostUSD: cost})
}
