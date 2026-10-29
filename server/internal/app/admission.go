package app

import (
	"errors"
	"log"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Admission control: before a call is dispatched, a slot of each scope it
// belongs to (user, room, network) and, for a paid model under an enforced
// budget, an estimate of its cost are taken in the database. Completed usage
// alone cannot stop concurrent requests that all pass the check before any
// of them finishes.

// ErrTooManyGenerations: the user (or room, or network) already has as many
// answers being generated as allowed.
var ErrTooManyGenerations = errors.New("too many answers are being generated at once, wait for one to finish")

// errBudgetReserved: reserving this call's estimated cost would exceed the
// monthly budget, so this (paid) target is passed over.
var errBudgetReserved = errors.New("the monthly AI budget has no room for this call")

// Admission is one concurrency limit a request is subject to.
type Admission struct {
	Scope string // e.g. "user:12", "room:3", "ip:10.0.0.1"
	Limit int
}

// Admit takes a slot of every scope, or none: when one is full it releases
// the others and returns ErrTooManyGenerations. A database error also
// refuses (ErrUsageUnavailable). release must be called when the request ends.
func (g *aiGateway) Admit(scopes []Admission) (release func(), err error) {
	expires := time.Now().Add(inflightTTL).UTC().Format(time.RFC3339)
	var ids []int64
	release = func() {
		for _, id := range ids {
			logIfErr("release generation slot", g.inflight.Release(id))
		}
	}
	for _, a := range scopes {
		if a.Limit <= 0 {
			continue
		}
		id, ok, err := g.inflight.Acquire(a.Scope, a.Limit, expires)
		if err != nil {
			release()
			log.Printf("admission: cannot take a slot of %s: %v", a.Scope, err)
			return nil, ErrUsageUnavailable
		}
		if !ok {
			release()
			return nil, ErrTooManyGenerations
		}
		ids = append(ids, id)
	}
	return release, nil
}

// budgetEnforced reports whether paid calls must fit in the monthly budget.
func (g *aiGateway) budgetEnforced() (float64, bool) {
	b := g.settings.Budget()
	return b.MonthlyUSD, b.MonthlyUSD > 0 && b.BlockPaidWhenExceeded
}

// reserve sets aside the estimated cost of calling target t with about
// inputChars of input and at most maxOutputTokens of output (0: unknown),
// when the budget is enforced and the model is not free. A model without a
// price is reserved at unpricedReserve, as its real cost is unknown.
func (g *aiGateway) reserve(t RouteTarget, inputChars, maxOutputTokens int) (release func(), err error) {
	if maxOutputTokens <= 0 {
		maxOutputTokens = reservedOutputTokens
	}
	id, err := g.reserveTokens(t, float64(inputChars)/reserveCharsPerToken, float64(maxOutputTokens), inflightTTL)
	if err != nil {
		return nil, err
	}
	return func() { g.releaseReservation(id) }, nil
}

// reserveTokens sets aside, for ttl, the cost of about inputTokens and
// outputTokens on target t. It returns 0 when nothing needs reserving (budget
// not enforced, free model) and errBudgetReserved when the budget has no room.
func (g *aiGateway) reserveTokens(t RouteTarget, inputTokens, outputTokens float64, ttl time.Duration) (id int64, err error) {
	budget, on := g.budgetEnforced()
	if !on {
		return 0, nil
	}
	p := g.priceFor(t.ProviderID, t.Model)
	if p.Known && p.In == 0 && p.Out == 0 {
		return 0, nil
	}
	if !p.Known {
		p = unpricedReserve
	}
	cost := (inputTokens*p.In + outputTokens*p.Out) / 1e6
	expires := time.Now().Add(ttl).UTC().Format(time.RFC3339)
	id, ok, err := g.inflight.ReserveBudget(cost, budget, MonthStart(), expires)
	if err != nil {
		log.Printf("budget: cannot reserve, passing over the paid model: %v", err)
		return 0, errBudgetReserved
	}
	if !ok {
		return 0, errBudgetReserved
	}
	return id, nil
}

// releaseReservation frees a reservation of reserveTokens (0: none).
func (g *aiGateway) releaseReservation(id int64) {
	if id != 0 {
		logIfErr("release budget reservation", g.inflight.Release(id))
	}
}

// requestChars is the size of a request's input, to estimate its tokens.
func requestChars(r ai.Request) int {
	n := len(r.System)
	for _, m := range r.Messages {
		n += len(m.Content)
	}
	return n
}
