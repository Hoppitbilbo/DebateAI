package app

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Characterization tests for the gateway fallback chain (refactoring task 0.1).

// fakeProvider answers per model: an entry in errs makes that model fail,
// a delay in slow makes Stream wait before the first delta.
type fakeProvider struct {
	errs  map[string]error
	slow  map[string]time.Duration
	calls []string
}

func (f *fakeProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	f.calls = append(f.calls, req.Model)
	if err := f.errs[req.Model]; err != nil {
		return nil, err
	}
	return &ai.Response{Text: "answer from " + req.Model, Usage: ai.Usage{InputTokens: 10, OutputTokens: 5}}, nil
}

func (f *fakeProvider) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	f.calls = append(f.calls, req.Model)
	if d := f.slow[req.Model]; d > 0 {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(d):
		}
	}
	if err := f.errs[req.Model]; err != nil {
		return nil, err
	}
	text := "answer from " + req.Model
	if err := onDelta(text); err != nil {
		return nil, err
	}
	return &ai.Response{Text: text}, nil
}

func (f *fakeProvider) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	cfg := Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := OpenDB(cfg.DatabasePath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewServer(cfg, db, nil)
}

// useProvider puts a provider straight into the adapter cache, bypassing the DB.
func useProvider(s *Server, id int64, kind string, p ai.Provider) {
	s.provs[id] = cachedProvider{p: p, cfg: ai.Config{ID: id, Kind: kind}, name: "fake" + itoa(id)}
}

func setChatRoute(t *testing.T, s *Server, strategy string, targets ...RouteTarget) {
	t.Helper()
	if err := putSetting(s.db, "routing", RoutingSettings{Strategy: strategy, Tasks: map[string][]RouteTarget{TaskChat: targets}}); err != nil {
		t.Fatal(err)
	}
}

func chatRequest() ai.Request {
	return ai.Request{Messages: []ai.Message{{Role: "user", Content: "hi"}}}
}

func usageRows(t *testing.T, s *Server) (ok, failed int) {
	t.Helper()
	return countRows(s.db, `SELECT COUNT(*) FROM usage_log WHERE ok = 1`), countRows(s.db, `SELECT COUNT(*) FROM usage_log WHERE ok = 0`)
}

func TestGenerateFallsBackOnRetryableError(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{errs: map[string]error{"busy": &ai.HTTPError{Status: 429, Body: "quota"}}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "busy"}, RouteTarget{1, "ok"})

	res, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil)
	if err != nil || res.Model != "ok" || res.Text != "answer from ok" {
		t.Fatalf("expected fallback to ok: %v %+v", err, res)
	}
	if ok, failed := usageRows(t, s); ok != 1 || failed != 1 {
		t.Fatalf("usage log ok=%d failed=%d", ok, failed)
	}
}

func TestGenerateStopsOnCanceledContext(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{errs: map[string]error{"first": context.Canceled}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "first"}, RouteTarget{1, "second"})

	if _, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err == nil {
		t.Fatal("expected error")
	}
	if strings.Join(fp.calls, ",") != "first" {
		t.Fatalf("non-retryable error must not fall back, calls: %v", fp.calls)
	}
}

func TestGenerateSkipsJevProviders(t *testing.T) {
	s := newTestServer(t)
	jev := &fakeProvider{}
	llm := &fakeProvider{}
	useProvider(s, 1, ai.KindJev, jev)
	useProvider(s, 2, ai.KindOpenAI, llm)
	setChatRoute(t, s, "ordered", RouteTarget{1, "jev-latest"}, RouteTarget{2, "m"})

	res, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil)
	if err != nil || res.ProviderID != 2 || len(jev.calls) != 0 {
		t.Fatalf("jev must be skipped: %v %+v %v", err, res, jev.calls)
	}
}

func TestGenerateSetsLowReasoningForChat(t *testing.T) {
	s := newTestServer(t)
	var seen string
	useProvider(s, 1, ai.KindOpenAI, recordingProvider{fakeProvider: &fakeProvider{}, effort: &seen})
	setChatRoute(t, s, "ordered", RouteTarget{1, "m"})

	if _, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if seen != "low" {
		t.Fatalf("reasoning effort = %q", seen)
	}
}

type recordingProvider struct {
	*fakeProvider
	effort *string
}

func (r recordingProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	*r.effort = req.ReasoningEffort
	return r.fakeProvider.Generate(ctx, req)
}

func TestGenerateStreamTimesOutSilentModel(t *testing.T) {
	old := firstTokenTimeout
	firstTokenTimeout = 50 * time.Millisecond
	defer func() { firstTokenTimeout = old }()

	s := newTestServer(t)
	fp := &fakeProvider{slow: map[string]time.Duration{"silent": time.Second}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "silent"}, RouteTarget{1, "fast"})

	var got strings.Builder
	res, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(d string) error {
		got.WriteString(d)
		return nil
	})
	if err != nil || res.Model != "fast" || got.String() != "answer from fast" {
		t.Fatalf("expected timeout fallback: %v %+v %q", err, res, got.String())
	}
}

func TestGenerateNoFallbackAfterFirstDelta(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, failAfterDelta{&fakeProvider{}})
	fp := &fakeProvider{}
	useProvider(s, 2, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"}, RouteTarget{2, "b"})

	_, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(string) error { return nil })
	if err == nil || len(fp.calls) != 0 {
		t.Fatalf("must not fall back once streaming started: %v %v", err, fp.calls)
	}
}

type failAfterDelta struct{ *fakeProvider }

func (failAfterDelta) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	_ = onDelta("partial")
	return nil, &ai.HTTPError{Status: 500, Body: "broken mid-stream"}
}

func TestGenerateWithoutTargets(t *testing.T) {
	s := newTestServer(t)
	if _, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); !errors.Is(err, errNoTargets) {
		t.Fatalf("expected errNoTargets, got %v", err)
	}
}

func TestTargetsStrategies(t *testing.T) {
	s := newTestServer(t)
	paid, free := RouteTarget{1, "paid"}, RouteTarget{1, "cheap:free"}

	setChatRoute(t, s, "ordered", paid, free)
	if got := s.targets(TaskChat); got[0] != paid {
		t.Fatalf("ordered: %v", got)
	}
	setChatRoute(t, s, "free_first", paid, free)
	if got := s.targets(TaskChat); got[0] != free {
		t.Fatalf("free_first: %v", got)
	}
	setChatRoute(t, s, "cheapest", paid, free)
	if got := s.targets(TaskChat); got[0] != free {
		t.Fatalf("cheapest (unknown price sorts last): %v", got)
	}
}

func TestTargetsFallBackToChatRoute(t *testing.T) {
	s := newTestServer(t)
	setChatRoute(t, s, "ordered", RouteTarget{1, "m"})
	if got := s.targets(TaskEvaluation); len(got) != 1 || got[0].Model != "m" {
		t.Fatalf("evaluation should reuse chat targets: %v", got)
	}
	if got := s.targets(TaskLive); len(got) != 0 {
		t.Fatalf("live must not reuse chat targets: %v", got)
	}
}

func TestBudgetExceededKeepsOnlyFreeTargets(t *testing.T) {
	s := newTestServer(t)
	if err := putSetting(s.db, "budget", BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO usage_log(created_at, provider_id, provider_name, model, task, input_tokens, output_tokens, cost_usd, ok, latency_ms, error)
		VALUES(?, 1, 'p', 'paid', 'chat', 0, 0, 5, 1, 0, '')`, now()); err != nil {
		t.Fatal(err)
	}
	setChatRoute(t, s, "ordered", RouteTarget{1, "paid"}, RouteTarget{1, "cheap:free"})
	if got := s.targets(TaskChat); len(got) != 1 || got[0].Model != "cheap:free" {
		t.Fatalf("budget filter: %v", got)
	}

	setChatRoute(t, s, "ordered", RouteTarget{1, "paid"})
	if _, err := s.generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err == nil || !strings.Contains(err.Error(), "budget") {
		t.Fatalf("expected budget error, got %v", err)
	}
}

func TestRetryable(t *testing.T) {
	cases := map[error]bool{
		&ai.HTTPError{Status: 429}: true,
		&ai.HTTPError{Status: 503}: true,
		&ai.HTTPError{Status: 400}: true,
		&ai.HTTPError{Status: 422}: false,
		context.Canceled:           false,
		errors.New("network"):      true,
	}
	for err, want := range cases {
		if got := retryable(err); got != want {
			t.Errorf("retryable(%v) = %v, want %v", err, got, want)
		}
	}
}
