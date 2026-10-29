package app

import (
	"context"
	"errors"
	"sync"
	"time"
)

// targetHealth remembers which route targets keep failing (e.g. a free
// model queued for minutes, a provider down): after failuresBeforeCooldown
// failures in a row a target is tried after the others for targetCooldown.
// It is never dropped, so a route with one target still works.
type targetHealth struct {
	mu    sync.Mutex
	now   func() time.Time
	state map[RouteTarget]healthState
}

type healthState struct {
	failures int
	until    time.Time // tried last until then
}

func newTargetHealth() *targetHealth {
	return &targetHealth{now: time.Now, state: map[RouteTarget]healthState{}}
}

// order puts the cooling targets after the others, keeping each group's order.
func (h *targetHealth) order(targets []RouteTarget) []RouteTarget {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := h.now()
	healthy := make([]RouteTarget, 0, len(targets))
	var cooling []RouteTarget
	for _, t := range targets {
		if now.Before(h.state[t].until) {
			cooling = append(cooling, t)
		} else {
			healthy = append(healthy, t)
		}
	}
	return append(healthy, cooling...)
}

// record notes the outcome of an attempt. Only failures that say something
// about the target count: not a cancelled request, a refusal or a target
// that cannot serve the task.
func (h *targetHealth) record(t RouteTarget, err error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	switch {
	case err == nil:
		delete(h.state, t)
	case errors.Is(err, context.Canceled), errors.Is(err, errSkipTarget), errors.Is(err, errRefusal), errors.Is(err, errBudgetReserved):
	default:
		s := h.state[t]
		s.failures++
		if s.failures >= failuresBeforeCooldown {
			s.until = h.now().Add(targetCooldown)
		}
		h.state[t] = s
	}
}

// errNoTimeForFallback: the time to show a first text is used up by the
// targets already tried.
var errNoTimeForFallback = errors.New("no model answered in time")

// firstTextTimeout is the first-token timeout of the next target: at most
// firstTokenTimeout, and never past the deadline of the whole chain.
func firstTextTimeout(deadline time.Time) (time.Duration, error) {
	left := time.Until(deadline)
	if left <= 0 {
		return 0, errNoTimeForFallback
	}
	return min(firstTokenTimeout, left), nil
}
