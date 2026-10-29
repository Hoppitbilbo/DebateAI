package app

import (
	"context"
	"sort"
)

// Routing strategies (Strategy pattern): given the configured targets of a
// task, decide the order in which the fallback chain tries them. A new
// strategy is a new type registered in routingStrategies; targets() does not
// change.

// priceBook answers what a provider/model costs; aiGateway implements it.
type priceBook interface {
	priceFor(providerID int64, model string) price
}

func isFreeTarget(prices priceBook, t RouteTarget) bool {
	p := prices.priceFor(t.ProviderID, t.Model)
	return p.Known && p.In == 0 && p.Out == 0
}

type routingStrategy interface {
	// order returns the targets in the order to try them; it must not modify list.
	order(list []RouteTarget, prices priceBook) []RouteTarget
}

// Strategy names as stored in RoutingSettings.Strategy.
const (
	StrategyOrdered   = "ordered"
	StrategyFreeFirst = "free_first"
	StrategyCheapest  = "cheapest"
)

var routingStrategies = map[string]routingStrategy{
	StrategyOrdered:   asConfigured{},
	StrategyFreeFirst: freeFirst{},
	StrategyCheapest:  cheapest{},
}

// strategyFor returns the named strategy; unknown names keep the configured order.
func strategyFor(name string) routingStrategy {
	if st, ok := routingStrategies[name]; ok {
		return st
	}
	return asConfigured{}
}

// asConfigured tries targets in the order the admin configured.
type asConfigured struct{}

func (asConfigured) order(list []RouteTarget, _ priceBook) []RouteTarget {
	return append([]RouteTarget(nil), list...)
}

// freeFirst moves free targets before paid ones, keeping the configured order
// within each group.
type freeFirst struct{}

func (freeFirst) order(list []RouteTarget, prices priceBook) []RouteTarget {
	out := append([]RouteTarget(nil), list...)
	sort.SliceStable(out, func(i, j int) bool { return isFreeTarget(prices, out[i]) && !isFreeTarget(prices, out[j]) })
	return out
}

// cheapest sorts by known price (input + output per 1M tokens); targets with
// an unknown price go last.
type cheapest struct{}

func (cheapest) order(list []RouteTarget, prices priceBook) []RouteTarget {
	cost := func(t RouteTarget) float64 {
		p := prices.priceFor(t.ProviderID, t.Model)
		if !p.Known {
			return 1e9
		}
		return p.In + p.Out
	}
	out := append([]RouteTarget(nil), list...)
	sort.SliceStable(out, func(i, j int) bool { return cost(out[i]) < cost(out[j]) })
	return out
}

// freeOnly decorates a strategy for when the monthly budget is exhausted:
// paid targets are dropped after ordering.
type freeOnly struct{ routingStrategy }

func (f freeOnly) order(list []RouteTarget, prices priceBook) []RouteTarget {
	free := []RouteTarget{}
	for _, t := range f.routingStrategy.order(list, prices) {
		if isFreeTarget(prices, t) {
			free = append(free, t)
		}
	}
	return free
}

// taskTargets returns the configured targets of a task; text tasks without
// targets fall back to the chat ones.
func taskTargets(tasks map[string][]RouteTarget, task string) []RouteTarget {
	list := tasks[task]
	if len(list) == 0 && task != TaskChat && task != TaskLive {
		list = tasks[TaskChat] // sensible fallback
	}
	return list
}

// targets returns the candidate list for a task according to the routing
// strategy and the budget state. This is the "decide which API" half of JEV.
func (g *aiGateway) Targets(task string) []RouteTarget {
	rt := g.settings.Routing()
	strategy := strategyFor(rt.Strategy)
	if g.BudgetExceeded() {
		strategy = freeOnly{strategy}
	}
	return strategy.order(taskTargets(rt.Tasks, task), g)
}

// roomRoutingKey marks a context whose AI calls come from a room guest.
type roomRoutingKey struct{}

// WithRoomRouting makes the AI calls made with ctx use the room models.
func WithRoomRouting(ctx context.Context) context.Context {
	return context.WithValue(ctx, roomRoutingKey{}, true)
}

func isRoomRouting(ctx context.Context) bool {
	on, _ := ctx.Value(roomRoutingKey{}).(bool)
	return on
}

// TargetsFor is Targets for a request: room guests use the models the
// admin chose for rooms (or the main ones when none is set), free only
// when so configured. Live voice is never available in rooms.
func (g *aiGateway) TargetsFor(ctx context.Context, task string) []RouteTarget {
	if !isRoomRouting(ctx) {
		return g.Targets(task)
	}
	if task == TaskLive {
		return nil
	}
	rs := g.settings.Rooms()
	list := taskTargets(rs.Tasks, task)
	if len(list) == 0 {
		list = taskTargets(g.settings.Routing().Tasks, task)
	}
	strategy := strategyFor(g.settings.Routing().Strategy)
	if rs.FreeOnly || g.BudgetExceeded() {
		strategy = freeOnly{strategy}
	}
	return strategy.order(list, g)
}

// RoomTargets returns, for each task rooms may use, the targets a room
// guest would really get: the admin page shows which configured models are
// left out (e.g. not free while FreeOnly is on).
func (g *aiGateway) RoomTargets() map[string][]RouteTarget {
	ctx := WithRoomRouting(context.Background())
	out := map[string][]RouteTarget{}
	for _, task := range RoomTasks {
		out[task] = g.TargetsFor(ctx, task)
	}
	return out
}

// RoomChatReady tells whether room guests have a model to chat with.
func (g *aiGateway) RoomChatReady() bool {
	return len(g.TargetsFor(WithRoomRouting(context.Background()), TaskChat)) > 0
}
