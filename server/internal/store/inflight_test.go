package store

import (
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

const farFuture = "9999-01-01T00:00:00Z"

func TestInflightSlotsAreLimitedAndExpire(t *testing.T) {
	r := NewInflight(openTestDB(t))
	id, ok, err := r.Acquire("user:1", 1, farFuture)
	if err != nil || !ok {
		t.Fatalf("first slot: %v %v", ok, err)
	}
	if _, ok, _ := r.Acquire("user:1", 1, farFuture); ok {
		t.Fatal("the only slot is taken")
	}
	if _, ok, _ := r.Acquire("user:2", 1, farFuture); !ok {
		t.Fatal("scopes are independent")
	}
	if err := r.Release(id); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := r.Acquire("user:1", 1, "2000-01-01T00:00:00Z"); !ok {
		t.Fatal("slot not freed by Release")
	}
	// The slot above has already expired: it does not count.
	if _, ok, _ := r.Acquire("user:1", 1, farFuture); !ok {
		t.Fatal("an expired slot must not count")
	}
}

func TestReserveBudgetCountsSpendingAndReservations(t *testing.T) {
	db := openTestDB(t)
	r, usage := NewInflight(db), NewUsage(db)
	if err := usage.Insert(domain.UsageRecord{Model: "m", CostUSD: 0.5, OK: true}); err != nil {
		t.Fatal(err)
	}
	since := "2000-01-01T00:00:00Z"
	if _, ok, err := r.ReserveBudget(0.3, 1, since, farFuture); err != nil || !ok {
		t.Fatalf("0.5 spent + 0.3 fits in 1: %v %v", ok, err)
	}
	if _, ok, _ := r.ReserveBudget(0.3, 1, since, farFuture); ok {
		t.Fatal("0.5 + 0.3 + 0.3 exceeds 1")
	}
	if v, _ := r.Reserved(); v != 0.3 {
		t.Fatalf("reserved: %v", v)
	}
}
