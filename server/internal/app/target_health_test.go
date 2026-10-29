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
