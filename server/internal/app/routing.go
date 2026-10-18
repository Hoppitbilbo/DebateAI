package app

import "sort"

// Routing strategies (Strategy pattern): given the configured targets of a
// task, decide the order in which the fallback chain tries them. A new
// strategy is a new type registered in routingStrategies; targets() does not
// change.

// priceBook answers what a provider/model costs; Server implements it.
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

// targets returns the candidate list for a task according to the routing
// strategy and the budget state. This is the "decide which API" half of JEV.
func (s *Server) targets(task string) []RouteTarget {
	rt := s.settingsSvc.Routing()
	list := rt.Tasks[task]
	if len(list) == 0 && task != TaskChat && task != TaskLive {
		list = rt.Tasks[TaskChat] // sensible fallback
	}
	strategy := strategyFor(rt.Strategy)
	if s.budgetExceeded() {
		strategy = freeOnly{strategy}
	}
	return strategy.order(list, s)
}
