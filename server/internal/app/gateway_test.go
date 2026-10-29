package app

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Characterization tests for the gateway fallback chain (refactoring task 0.1).

// fakeProvider answers per model: an entry in errs makes that model fail,
// a delay in slow makes Stream wait before the first delta.
type fakeProvider struct {
	errs  map[string]error
	slow  map[string]time.Duration
	texts map[string]string // answer of a model, when not "answer from <model>"
	calls []string
}

func (f *fakeProvider) answer(model string) string {
	if text, ok := f.texts[model]; ok {
		return text
	}
	return "answer from " + model
}

func (f *fakeProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	f.calls = append(f.calls, req.Model)
	if err := f.errs[req.Model]; err != nil {
		return nil, err
	}
	return &ai.Response{Text: f.answer(req.Model), Usage: ai.Usage{InputTokens: 10, OutputTokens: 5}}, nil
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
	// a few words at a time, like a real stream
	text := f.answer(req.Model)
	for _, word := range strings.SplitAfter(text, " ") {
		if err := onDelta(word); err != nil {
			return nil, err
		}
	}
	return &ai.Response{Text: text}, nil
}

func (f *fakeProvider) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }

func newTestServer(t *testing.T) *Services {
	t.Helper()
	dir := t.TempDir()
	cfg := Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return NewServices(cfg, db)
}

// useProvider puts a provider straight into the adapter cache, bypassing
// the DB; it never expires there (loaded in the far future).
func useProvider(s *Services, id int64, kind string, p ai.Provider) {
	s.Gateway.provs[id] = cachedProvider{p: p, cfg: ai.Config{ID: id, Kind: kind}, name: "fake" + itoa(id), loaded: time.Now().AddDate(100, 0, 0)}
}

// A provider changed on another instance (here: straight in the database)
// is rebuilt once its cached adapter is older than providerCacheTTL.
func TestProviderCacheExpires(t *testing.T) {
	s := newTestServer(t)
	now := time.Now()
	s.Gateway.provNow = func() time.Time { return now }
	built := 0
	s.Gateway.newProvider = func(c ai.Config) (ai.Provider, error) { built++; return &fakeProvider{}, nil }
	id, err := s.Gateway.insertProvider("p", ai.KindOpenAI, "", "key")
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := s.Gateway.provider(id); err != nil {
			t.Fatal(err)
		}
	}
	if built != 1 {
		t.Fatalf("built %d times, want 1 (cached)", built)
	}
	disabled := false
	if err := s.Providers.Update(id, domain.ProviderPatch{Enabled: &disabled}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Gateway.provider(id); err != nil {
		t.Fatal("still cached before the TTL")
	}
	now = now.Add(providerCacheTTL)
	if _, err := s.Gateway.provider(id); err == nil {
		t.Fatal("a provider disabled elsewhere must be seen after the TTL")
	}
}

func setChatRoute(t *testing.T, s *Services, strategy string, targets ...RouteTarget) {
	t.Helper()
	if err := s.Settings.SaveRouting(RoutingSettings{Strategy: strategy, Tasks: map[string][]RouteTarget{TaskChat: targets}}); err != nil {
		t.Fatal(err)
	}
}

func chatRequest() ai.Request {
	return ai.Request{Messages: []ai.Message{{Role: "user", Content: "hi"}}}
}

func usageRows(t *testing.T, s *Services) (ok, failed int) {
	t.Helper()
	failed = s.Usage.CountSince("", true)
	return s.Usage.CountSince("", false) - failed, failed
}

func TestGenerateFallsBackOnRetryableError(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{errs: map[string]error{"busy": &ai.HTTPError{Status: 429, Body: "quota"}}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "busy"}, RouteTarget{1, "ok"})

	res, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil)
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

	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err == nil {
		t.Fatal("expected error")
	}
	if strings.Join(fp.calls, ",") != "first" {
		t.Fatalf("non-retryable error must not fall back, calls: %v", fp.calls)
	}
}

func TestGenerateSkipsProvidersWithoutText(t *testing.T) {
	s := newTestServer(t)
	jev := &fakeDecider{}
	llm := &fakeProvider{}
	useProvider(s, 1, ai.KindJev, jev)
	useProvider(s, 2, ai.KindOpenAI, llm)
	setChatRoute(t, s, "ordered", RouteTarget{1, "jev-latest"}, RouteTarget{2, "m"})

	res, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil)
	if err != nil || res.ProviderID != 2 || jev.decisions != 0 {
		t.Fatalf("providers without text capability must be skipped: %v %+v", err, res)
	}
}

func TestGenerateSetsLowReasoningForChat(t *testing.T) {
	s := newTestServer(t)
	var seen string
	useProvider(s, 1, ai.KindOpenAI, recordingProvider{fakeProvider: &fakeProvider{}, effort: &seen})
	setChatRoute(t, s, "ordered", RouteTarget{1, "m"})

	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err != nil {
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
	res, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(d string) error {
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

	_, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(string) error { return nil })
	if err == nil || len(fp.calls) != 0 {
		t.Fatalf("must not fall back once streaming started: %v %v", err, fp.calls)
	}
}

type failAfterDelta struct{ *fakeProvider }

func (failAfterDelta) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	_ = onDelta(strings.Repeat("partial ", refusalProbeChars/4))
	return nil, &ai.HTTPError{Status: 500, Body: "broken mid-stream"}
}

func TestGenerateWithoutTargets(t *testing.T) {
	s := newTestServer(t)
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); !errors.Is(err, ErrNoTargets) {
		t.Fatalf("expected ErrNoTargets, got %v", err)
	}
}

func TestTargetsStrategies(t *testing.T) {
	s := newTestServer(t)
	paid, free := RouteTarget{1, "paid"}, RouteTarget{1, "cheap:free"}

	setChatRoute(t, s, "ordered", paid, free)
	if got := s.Gateway.Targets(TaskChat); got[0] != paid {
		t.Fatalf("ordered: %v", got)
	}
	setChatRoute(t, s, "free_first", paid, free)
	if got := s.Gateway.Targets(TaskChat); got[0] != free {
		t.Fatalf("free_first: %v", got)
	}
	setChatRoute(t, s, "cheapest", paid, free)
	if got := s.Gateway.Targets(TaskChat); got[0] != free {
		t.Fatalf("cheapest (unknown price sorts last): %v", got)
	}
}

func TestTargetsFallBackToChatRoute(t *testing.T) {
	s := newTestServer(t)
	setChatRoute(t, s, "ordered", RouteTarget{1, "m"})
	if got := s.Gateway.Targets(TaskEvaluation); len(got) != 1 || got[0].Model != "m" {
		t.Fatalf("evaluation should reuse chat targets: %v", got)
	}
	if got := s.Gateway.Targets(TaskLive); len(got) != 0 {
		t.Fatalf("live must not reuse chat targets: %v", got)
	}
}

func TestBudgetExceededKeepsOnlyFreeTargets(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	if err := s.Usage.Insert(domain.UsageRecord{ProviderID: 1, Provider: "p", Model: "paid", Task: TaskChat, CostUSD: 5, OK: true}); err != nil {
		t.Fatal(err)
	}
	setChatRoute(t, s, "ordered", RouteTarget{1, "paid"}, RouteTarget{1, "cheap:free"})
	if got := s.Gateway.Targets(TaskChat); len(got) != 1 || got[0].Model != "cheap:free" {
		t.Fatalf("budget filter: %v", got)
	}

	setChatRoute(t, s, "ordered", RouteTarget{1, "paid"})
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err == nil || !strings.Contains(err.Error(), "budget") {
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

func TestMeteredModelLogsEveryCall(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{errs: map[string]error{"bad": errors.New("boom")}}
	m := s.Gateway.meterText(fp, usageEntry{ProviderID: 1, Provider: "p", Task: TaskChat})
	if _, err := m.Generate(context.Background(), ai.Request{Model: "ok"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Generate(context.Background(), ai.Request{Model: "bad"}); err == nil {
		t.Fatal("expected error")
	}
	if ok, failed := usageRows(t, s); ok != 1 || failed != 1 {
		t.Fatalf("usage log ok=%d failed=%d", ok, failed)
	}
	if rows, _ := s.Usage.Recent(1); rows[0].OK || rows[0].Error != "boom" || rows[0].InputTokens != 0 {
		t.Fatal("failed call must log its error")
	}
}

func TestStrategiesDoNotModifyConfiguredList(t *testing.T) {
	s := newTestServer(t)
	list := []RouteTarget{{1, "paid"}, {1, "cheap:free"}}
	for name, st := range routingStrategies {
		st.order(list, s.Gateway)
		freeOnly{st}.order(list, s.Gateway)
		if list[0].Model != "paid" {
			t.Fatalf("%s reordered the configured list in place", name)
		}
	}
	if _, ok := strategyFor("unknown").(asConfigured); !ok {
		t.Fatal("unknown strategy must keep the configured order")
	}
}

func TestDefaultRoutePolicies(t *testing.T) {
	gemini := []ai.ModelInfo{{ID: "models/gemini-2.5-flash"}, {ID: "models/gemini-3.1-flash"}, {ID: "models/gemini-3.1-flash-lite"},
		{ID: "gemini-3.1-flash-live-preview", SupportLive: true}, {ID: "gemini-3.1-flash-image"}}
	rt := RoutingSettings{Tasks: map[string][]RouteTarget{TaskJudge: {{7, "old-judge"}}}}
	routePolicyFor(ai.KindGemini)(&rt, 1, gemini)
	if rt.Tasks[TaskChat][0].Model != "gemini-3.1-flash" || rt.Tasks[TaskUtility][0].Model != "gemini-3.1-flash-lite" ||
		rt.Tasks[TaskLive][0].Model != "gemini-3.1-flash-live-preview" || rt.Tasks[TaskJudge][0].Model != "old-judge" {
		t.Fatalf("gemini routes: %+v", rt.Tasks)
	}

	routePolicyFor(ai.KindJev)(&rt, 2, []ai.ModelInfo{{ID: "jev-1.13"}, {ID: "jev-latest"}})
	if j := rt.Tasks[TaskJudge]; len(j) != 2 || j[0] != (RouteTarget{2, "jev-latest"}) || j[1].Model != "old-judge" {
		t.Fatalf("jev must go first for judging: %+v", j)
	}

	rt = RoutingSettings{Tasks: map[string][]RouteTarget{}}
	routePolicyFor(ai.KindOpenAI)(&rt, 3, []ai.ModelInfo{{ID: "paid"}, {ID: "x:free", Free: true}})
	if rt.Tasks[TaskChat][0].Model != "x:free" || rt.Tasks[TaskJudge][0].Model != "x:free" || len(rt.Tasks[TaskLive]) != 0 {
		t.Fatalf("openai routes: %+v", rt.Tasks)
	}
}

func streamChat(t *testing.T, s *Services) (*GenResult, string, error) {
	t.Helper()
	var got strings.Builder
	res, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(d string) error {
		got.WriteString(d)
		return nil
	})
	return res, got.String(), err
}

func TestGenerateFallsBackOnRefusal(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{texts: map[string]string{"prude": "I'm sorry, but I can't role-play as this historical figure."}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "prude"}, RouteTarget{1, "actor"})

	res, got, err := streamChat(t, s)
	if err != nil || res.Model != "actor" || got != "answer from actor" {
		t.Fatalf("the student must only see the second model: %v %+v %q", err, res, got)
	}
	if ok, failed := usageRows(t, s); ok != 1 || failed != 1 {
		t.Fatalf("the refusal must be logged as a failure: ok=%d failed=%d", ok, failed)
	}
}

func TestGenerateFallsBackOnEmptyAnswer(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{texts: map[string]string{"thinker": "  "}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "thinker"}, RouteTarget{1, "talker"})

	if res, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err != nil || res.Model != "talker" {
		t.Fatalf("an empty answer must fall back: %v %+v", err, res)
	}
	if res, got, err := streamChat(t, s); err != nil || res.Model != "talker" || got != "answer from talker" {
		t.Fatalf("an empty stream must fall back: %v %+v %q", err, res, got)
	}
}

func TestGenerateKeepsInCharacterRefusals(t *testing.T) {
	answers := []string{
		"Non posso accettare la tua proposta, giovane: la Francia viene prima di tutto!",
		"Mai! Non cederò a questi argomenti. " + strings.Repeat("La gloria dell'Impero non si discute. ", 6),
		"I cannot accept such an idea, my friend.",
	}
	for _, text := range answers {
		s := newTestServer(t)
		useProvider(s, 1, ai.KindOpenAI, &fakeProvider{texts: map[string]string{"napoleon": text}})
		setChatRoute(t, s, "ordered", RouteTarget{1, "napoleon"}, RouteTarget{1, "other"})
		if res, got, err := streamChat(t, s); err != nil || res.Model != "napoleon" || got != text {
			t.Fatalf("a character refusing in the story is a valid answer: %v %+v %q", err, res, got)
		}
	}
}

func TestGenerateShowsLastRefusalWhenAllRefuse(t *testing.T) {
	s := newTestServer(t)
	refusal := "Mi dispiace, ma come intelligenza artificiale non posso interpretare questo personaggio."
	useProvider(s, 1, ai.KindOpenAI, &fakeProvider{texts: map[string]string{"a": refusal, "b": refusal}})
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"}, RouteTarget{1, "b"})

	if res, got, err := streamChat(t, s); err != nil || res.Model != "b" || got != refusal {
		t.Fatalf("a refusal is better than an error: %v %+v %q", err, res, got)
	}
}

func TestIsRefusal(t *testing.T) {
	refusals := []string{
		"As an AI language model, I cannot portray Hitler.",
		"Mi dispiace, ma non posso impersonare questa figura storica.",
		"Come modello linguistico non posso esprimere opinioni.",
		"Lo siento, pero no puedo interpretar a este personaje.",
		"Je ne peux pas incarner ce personnage.",
		"Als KI kann ich das nicht tun.",
	}
	for _, r := range refusals {
		if !isRefusal(r) {
			t.Errorf("not recognised as a refusal: %q", r)
		}
	}
	for _, ok := range []string{"Non posso permettere che l'Italia resti divisa!", "I can't believe you said that, young man.", "Come Imperatore, io decido."} {
		if isRefusal(ok) {
			t.Errorf("in-character line taken for a refusal: %q", ok)
		}
	}
}

func TestGenerateStartsHistoryWithUser(t *testing.T) {
	s := newTestServer(t)
	var first ai.Message
	useProvider(s, 1, ai.KindAnthropic, firstMessageProvider{&fakeProvider{}, &first})
	setChatRoute(t, s, "ordered", RouteTarget{1, "m"})

	req := ai.Request{Messages: []ai.Message{{Role: "assistant", Content: "Bonjour, je suis Napoléon."}, {Role: "user", Content: "Ciao"}}}
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, req, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if first.Role != "user" {
		t.Fatalf("history must start with the user, got %+v", first)
	}
}

type firstMessageProvider struct {
	*fakeProvider
	first *ai.Message
}

func (f firstMessageProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	*f.first = req.Messages[0]
	return f.fakeProvider.Generate(ctx, req)
}

// failingSpend is a usage store whose spending cannot be read.
type failingSpend struct{ usageStore }

func (failingSpend) SpendSince(string) (float64, error) { return 0, errors.New("db down") }

func TestBudgetFailsClosedWhenSpendingIsUnreadable(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	s.Gateway.usage = failingSpend{s.Gateway.usage}
	if !s.Gateway.BudgetExceeded() {
		t.Fatal("an unreadable spending must block paid models")
	}
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1}); err != nil {
		t.Fatal(err)
	}
	if s.Gateway.BudgetExceeded() {
		t.Fatal("without blocking, the budget never blocks")
	}
}

func TestLiveUsageOnlyAgainstOwnGrant(t *testing.T) {
	s := newTestServer(t)
	now := time.Now().UTC()
	owner, _ := s.Accounts.CreateUser("a@x.it", "", "", domain.RoleStudent, "it")
	other, _ := s.Accounts.CreateUser("b@x.it", "", "", domain.RoleStudent, "it")
	grant := func(id string, user *int64) {
		if err := s.LiveGrants.Create(domain.LiveGrant{ID: id, UserID: user, ProviderID: 1, Model: "live", CreatedAt: now.Format(time.RFC3339), ExpiresAt: now.Add(time.Hour).Format(time.RFC3339)}); err != nil {
			t.Fatal(err)
		}
	}
	grant("mine", &owner)
	if _, err := s.Gateway.RecordLiveUsage(LiveUsage{GrantID: "mine", UserID: &other, InputTokens: 1}); !errors.Is(err, ErrLiveGrant) {
		t.Fatalf("another user's grant: %v", err)
	}
	grant("anon", nil)
	if _, err := s.Gateway.RecordLiveUsage(LiveUsage{GrantID: "anon", UserID: &owner, InputTokens: 1}); !errors.Is(err, ErrLiveGrant) {
		t.Fatalf("an anonymous grant reported by a user: %v", err)
	}
	grant("again", &owner)
	if _, err := s.Gateway.RecordLiveUsage(LiveUsage{GrantID: "again", UserID: &owner, InputTokens: 1}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Gateway.RecordLiveUsage(LiveUsage{GrantID: "again", UserID: &owner, InputTokens: 1}); !errors.Is(err, ErrLiveGrant) {
		t.Fatalf("reported twice: %v", err)
	}
}

// Only character answers are held back for the refusal check: an
// evaluation shows its first words at once.
func TestOnlyChatAnswersAreHeldBack(t *testing.T) {
	for task, wantFirst := range map[string]string{TaskChat: "Hello there, ", TaskEvaluation: "Hello "} {
		m := screenAnswers(wordStream{"Hello ", "there, ", "student."}, task)
		var first string
		if _, err := m.Stream(context.Background(), ai.Request{}, func(d string) error {
			if first == "" {
				first = d
			}
			return nil
		}); err != nil {
			t.Fatal(err)
		}
		// a chat answer shorter than the probe comes out whole, at the end
		if task == TaskChat {
			wantFirst = "Hello there, student."
		}
		if first != wantFirst {
			t.Fatalf("%s: first delta %q, want %q", task, first, wantFirst)
		}
	}
}

// wordStream streams its words one by one.
type wordStream []string

func (w wordStream) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	return &ai.Response{Text: strings.Join(w, "")}, nil
}

func (w wordStream) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	for _, d := range w {
		if err := onDelta(d); err != nil {
			return nil, err
		}
	}
	return &ai.Response{Text: strings.Join(w, "")}, nil
}

func (w wordStream) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }
