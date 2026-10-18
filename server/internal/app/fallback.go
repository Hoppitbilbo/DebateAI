package app

import (
	"errors"
	"fmt"
	"log"
)

// Fallback chain (Chain of Responsibility): the route targets of a task are
// tried in order; each one either handles the request or passes it on.

// errSkipTarget tells the chain that a target cannot serve this kind of
// request (e.g. Jev for chat); it is passed on without counting as a failure.
var errSkipTarget = errors.New("target cannot serve this request")

// stopFallback decides, after a failed attempt, that no other target should
// be tried (e.g. the student already saw part of the answer).
type stopFallback func(err error) bool

// runFallbackChain calls attempt for each target until one succeeds. It
// returns nil on success, otherwise the last failure prefixed with the
// provider and model, or ErrNoTargets when no target was tried.
func (g *aiGateway) runFallbackChain(label string, targets []RouteTarget, attempt func(t RouteTarget, cp *cachedProvider) error, stop stopFallback) error {
	var lastErr error
	for _, t := range targets {
		cp, err := g.provider(t.ProviderID)
		if err != nil {
			lastErr = err
			continue
		}
		err = attempt(t, cp)
		if err == nil {
			return nil
		}
		if errors.Is(err, errSkipTarget) {
			continue
		}
		lastErr = fmt.Errorf("%s/%s: %w", cp.name, t.Model, err)
		log.Printf("%s via %s/%s failed: %v", label, cp.name, t.Model, err)
		if stop != nil && stop(err) {
			return lastErr
		}
	}
	if lastErr == nil {
		return ErrNoTargets
	}
	return lastErr
}
