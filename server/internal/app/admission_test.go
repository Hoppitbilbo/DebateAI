package app

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// blockingProvider holds every call until release is closed, so that
// several requests are in flight at once.
type blockingProvider struct {
	*fakeProvider
	started chan struct{}
	release chan struct{}
}

func (b blockingProvider) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	b.started <- struct{}{}
	<-b.release
	return &ai.Response{Text: "ok", Usage: ai.Usage{InputTokens: 1000, OutputTokens: 1000}}, nil
}

// Concurrent paid calls cannot all pass the budget: each reserves its
// estimated cost before dispatch, and the ones that do not fit fall back to
// the free model.
func TestConcurrentPaidCallsRespectTheReservedBudget(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	// 1000 output tokens at $400/M reserve $0.40: two fit in $1, the third does not.
	if _, err := s.Gateway.insertProvider("paid", ai.KindOpenAI, "", "key"); err != nil {
		t.Fatal(err)
	}
	if err := s.Prices.Put(1, "paid", 0, 400); err != nil {
		t.Fatal(err)
	}
	bp := blockingProvider{&fakeProvider{}, make(chan struct{}, 3), make(chan struct{})}
	useProvider(s, 1, ai.KindOpenAI, bp)
	free := &fakeProvider{}
	useProvider(s, 2, ai.KindOpenAI, free)
	setChatRoute(t, s, "ordered", RouteTarget{1, "paid"}, RouteTarget{2, "cheap:free"})

	req := chatRequest()
	req.MaxTokens = 1000
	var wg sync.WaitGroup
	models := make(chan string, 3)
	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := s.Gateway.Generate(context.Background(), TaskChat, req, nil, nil, nil)
			if err != nil {
				t.Error(err)
				return
			}
			models <- res.Model
		}()
	}
	<-bp.started
	<-bp.started
	if s.Gateway.BudgetExceeded() {
		t.Fatal("$0.80 reserved of $1 is not yet exceeded")
	}
	res, err := s.Gateway.Generate(context.Background(), TaskChat, req, nil, nil, nil)
	if err != nil || res.Model != "cheap:free" {
		t.Fatalf("third call should use the free model: %v %+v", err, res)
	}
	close(bp.release)
	wg.Wait()
	close(models)
	for m := range models {
		if m != "paid" {
			t.Fatalf("the first two calls fit the budget: %s", m)
		}
	}
	if reserved, _ := s.Inflight.Reserved(); reserved != 0 {
		t.Fatalf("reservations must be released after the call: %v", reserved)
	}
}

func TestReservationsCountTowardsTheBudget(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := s.Inflight.ReserveBudget(1, 1, MonthStart(), "9999-01-01T00:00:00Z"); err != nil || !ok {
		t.Fatalf("reserve: %v %v", ok, err)
	}
	if !s.Gateway.BudgetExceeded() {
		t.Fatal("a full reservation must block paid models")
	}
}

func TestAdmitLimitsConcurrentGenerations(t *testing.T) {
	s := newTestServer(t)
	scopes := []Admission{{Scope: "user:1", Limit: 1}, {Scope: "room:1", Limit: 5}}
	release, err := s.Gateway.Admit(scopes)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Gateway.Admit(scopes); !errors.Is(err, ErrTooManyGenerations) {
		t.Fatalf("second generation of the same user: %v", err)
	}
	// The refused request must not keep the room slot it took.
	for range 4 {
		if _, err := s.Gateway.Admit([]Admission{{Scope: "room:1", Limit: 5}}); err != nil {
			t.Fatalf("room slots leaked: %v", err)
		}
	}
	release()
	if _, err := s.Gateway.Admit([]Admission{{Scope: "user:1", Limit: 1}}); err != nil {
		t.Fatalf("after release: %v", err)
	}
}

// A stream that breaks after sending text is logged with estimated tokens.
func TestInterruptedStreamLogsEstimatedUsage(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, failAfterDelta{&fakeProvider{}})
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"})
	_, _ = s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(string) error { return nil })
	rows, err := s.Usage.Recent(1)
	if err != nil || len(rows) != 1 {
		t.Fatal(err)
	}
	if !rows[0].Estimated || rows[0].OutputTokens == 0 {
		t.Fatalf("expected an estimated usage row: %+v", rows[0])
	}
}

// A paid model without a price is logged as unpriced, not as free.
func TestUnknownPriceIsLoggedAsUnpriced(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, &fakeProvider{})
	setChatRoute(t, s, "ordered", RouteTarget{1, "mystery"})
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	rows, _ := s.Usage.Recent(1)
	if !rows[0].Unpriced || rows[0].CostUSD != 0 {
		t.Fatalf("expected unpriced: %+v", rows[0])
	}
}

func TestUnpricedPaidModelIsReservedAtTheHighEnd(t *testing.T) {
	s := newTestServer(t)
	// $0.10 cannot cover 4096 tokens at the unpriced reserve.
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 0.1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	useProvider(s, 1, ai.KindOpenAI, &fakeProvider{})
	setChatRoute(t, s, "ordered", RouteTarget{1, "mystery"})
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, nil); err == nil || !strings.Contains(err.Error(), "budget") {
		t.Fatalf("expected the reservation to refuse: %v", err)
	}
}

// A voice conversation on a paid model holds part of the budget from the
// token until its usage is reported; then the real cost replaces it.
func TestLiveReservationLastsUntilTheUsageIsReported(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Gateway.insertProvider("live", ai.KindGemini, "", "key"); err != nil {
		t.Fatal(err)
	}
	if err := s.Prices.Put(1, "voice", 10, 10); err != nil {
		t.Fatal(err)
	}
	target := RouteTarget{1, "voice"}
	id, err := s.Gateway.reserveTokens(target, liveReservedTokens, liveReservedTokens, liveGrantTTL)
	if err != nil || id == 0 {
		t.Fatalf("reserve: %d %v", id, err)
	}
	want := 2 * liveReservedTokens * 10 / 1e6
	if got, _ := s.Inflight.Reserved(); got < want*0.99 || got > want*1.01 {
		t.Fatalf("reserved %.4f, want %.4f", got, want)
	}
	// Another one does not fit in what is left of $1.
	for range 3 {
		if _, err = s.Gateway.reserveTokens(target, liveReservedTokens, liveReservedTokens, liveGrantTTL); err != nil {
			break
		}
	}
	if !errors.Is(err, errBudgetReserved) {
		t.Fatalf("the budget should run out: %v", err)
	}

	grant := domain.LiveGrant{ID: "g1", ProviderID: 1, Model: "voice", CreatedAt: domain.Now(), ExpiresAt: "9999-01-01T00:00:00Z", ReservationID: id}
	if err := s.LiveGrants.Create(grant); err != nil {
		t.Fatal(err)
	}
	before, _ := s.Inflight.Reserved()
	if _, err := s.Gateway.RecordLiveUsage(LiveUsage{GrantID: "g1", InputTokens: 100, OutputTokens: 100}); err != nil {
		t.Fatal(err)
	}
	if after, _ := s.Inflight.Reserved(); after > before-want*0.99 {
		t.Fatalf("the grant's reservation is released: %.4f → %.4f", before, after)
	}
}

func TestFreeLiveModelReservesNothing(t *testing.T) {
	s := newTestServer(t)
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Gateway.insertProvider("live", ai.KindGemini, "", "key"); err != nil {
		t.Fatal(err)
	}
	if err := s.Prices.Put(1, "free-voice", 0, 0); err != nil {
		t.Fatal(err)
	}
	if id, err := s.Gateway.reserveTokens(RouteTarget{1, "free-voice"}, liveReservedTokens, liveReservedTokens, liveGrantTTL); id != 0 || err != nil {
		t.Fatalf("free: %d %v", id, err)
	}
}
