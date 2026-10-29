package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

func TestFailingTargetsAreTriedLastForAWhile(t *testing.T) {
	h := newTargetHealth()
	clock := time.Unix(0, 0)
	h.now = func() time.Time { return clock }
	a, b := RouteTarget{1, "a"}, RouteTarget{1, "b"}
	down := &ai.HTTPError{Status: 503}
	for range failuresBeforeCooldown - 1 {
		h.record(a, down)
	}
	h.record(a, context.Canceled) // says nothing about the target
	h.record(a, errRefusal)
	if got := h.order([]RouteTarget{a, b}); got[0] != a {
		t.Fatalf("not yet cooling: %v", got)
	}
	h.record(a, down)
	if got := h.order([]RouteTarget{a, b}); got[0] != b || got[1] != a {
		t.Fatalf("a cooling target goes last, not away: %v", got)
	}
	clock = clock.Add(targetCooldown)
	if got := h.order([]RouteTarget{a, b}); got[0] != a {
		t.Fatalf("after the cooldown it is back in place: %v", got)
	}
	h.record(a, nil)
	if _, ok := h.state[a]; ok {
		t.Fatal("a success clears the failures")
	}
}

func TestFallbackStopsWhenTheFirstTextBudgetIsUsedUp(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{slow: map[string]time.Duration{"a": time.Second}}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"}, RouteTarget{1, "b"})
	old := firstTokenTimeout
	firstTokenTimeout = 50 * time.Millisecond
	t.Cleanup(func() { firstTokenTimeout = old })

	call := genCall{task: TaskChat, req: chatRequest(), onDelta: func(string) error { return nil }, firstTextBy: time.Now().Add(-time.Second)}
	cp, _ := s.Gateway.provider(1)
	if _, err := s.Gateway.tryTarget(context.Background(), call, RouteTarget{1, "b"}, cp); !errors.Is(err, errNoTimeForFallback) {
		t.Fatalf("no time left: %v", err)
	}
	if len(fp.calls) != 0 {
		t.Fatalf("the model must not be called: %v", fp.calls)
	}
}

// The log keeps when the provider sent its first text and when the student
// saw it: the refusal check holds a chat answer back in between.
func TestStreamLogsProviderAndVisibleFirstText(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, &fakeProvider{slow: map[string]time.Duration{"a": 30 * time.Millisecond}})
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"})
	if _, err := s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(string) error { return nil }); err != nil {
		t.Fatal(err)
	}
	rows, _ := s.Usage.Recent(1)
	if rows[0].FirstDeltaMs < 30 || rows[0].FirstTextMs < rows[0].FirstDeltaMs {
		t.Fatalf("timings: provider %d ms, visible %d ms", rows[0].FirstDeltaMs, rows[0].FirstTextMs)
	}
}

// A chat answer stopped while its opening was still held back for the
// refusal check is logged with the usage estimated from what the provider wrote.
func TestStoppedHeldBackStreamIsEstimatedFromTheProviderText(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, stoppedEarly{&fakeProvider{}})
	setChatRoute(t, s, "ordered", RouteTarget{1, "a"})
	_, _ = s.Gateway.Generate(context.Background(), TaskChat, chatRequest(), nil, nil, func(string) error { return nil })
	rows, _ := s.Usage.Recent(1)
	if !rows[0].Estimated || rows[0].OutputTokens == 0 {
		t.Fatalf("expected an estimate from the provider's text: %+v", rows[0])
	}
}

// stoppedEarly writes a few words, then the request is cancelled (Stop).
type stoppedEarly struct{ *fakeProvider }

func (stoppedEarly) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	_ = onDelta("I was born in a small town ")
	return nil, context.Canceled
}
