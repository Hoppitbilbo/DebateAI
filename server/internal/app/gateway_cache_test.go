package app

import (
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

type countingPriceStore struct {
	priceStore
	gets int
}

func (c *countingPriceStore) Get(providerID int64, model string) (float64, float64, bool) {
	c.gets++
	return c.priceStore.Get(providerID, model)
}

type countingUsage struct {
	usageStore
	sums int
}

func (c *countingUsage) SpendSince(since string) (float64, error) {
	c.sums++
	return c.usageStore.SpendSince(since)
}

// Investigation 11/11, E1: prices and the budget state are read once per
// short interval, not on every AI call; a change made here is seen at once.
func TestPricesAreCachedAndInvalidated(t *testing.T) {
	s := newTestServer(t)
	clock := time.Now()
	s.Gateway.provNow = func() time.Time { return clock }
	cp := &countingPriceStore{priceStore: s.Gateway.prices}
	s.Gateway.prices = cp
	pid, err := s.Providers.Create("paid", "openai", "https://api.example", "")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Prices.Put(pid, "m", 1, 2); err != nil {
		t.Fatal(err)
	}
	for range 3 {
		if p := s.Gateway.priceFor(pid, "m"); p.In != 1 || p.Out != 2 {
			t.Fatalf("price %+v", p)
		}
	}
	if cp.gets != 1 {
		t.Fatalf("three lookups read the store %d times", cp.gets)
	}
	if err := s.Prices.Put(pid, "m", 3, 4); err != nil {
		t.Fatal(err)
	}
	s.Gateway.InvalidatePrices()
	if p := s.Gateway.priceFor(pid, "m"); p.In != 3 {
		t.Fatalf("after an admin change: %+v", p)
	}
	clock = clock.Add(providerCacheTTL)
	s.Gateway.priceFor(pid, "m")
	if cp.gets != 3 {
		t.Fatalf("an expired entry is read again: %d reads", cp.gets)
	}
}

func TestBudgetStateIsCachedBriefly(t *testing.T) {
	s := newTestServer(t)
	clock := time.Now()
	s.Gateway.provNow = func() time.Time { return clock }
	cu := &countingUsage{usageStore: s.Gateway.usage}
	s.Gateway.usage = cu
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	for range 3 {
		if s.Gateway.BudgetExceeded() {
			t.Fatal("nothing spent")
		}
	}
	if cu.sums != 1 {
		t.Fatalf("three checks summed the month %d times", cu.sums)
	}
	s.Gateway.logUsage(usageEntry{ProviderID: 1, Model: "m", Task: TaskChat, OK: true, Usage: ai.Usage{CostUSD: ptr(2.0)}})
	if !s.Gateway.BudgetExceeded() {
		t.Fatal("a call logged here is seen at once")
	}
}
