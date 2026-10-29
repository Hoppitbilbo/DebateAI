package store

import (
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestProvidersAndPrices(t *testing.T) {
	db := openTestDB(t)
	r := NewProviders(db)
	id, err := r.Create("OpenRouter", ai.KindOpenAI, "https://openrouter.ai/api/v1", "enc")
	if err != nil {
		t.Fatal(err)
	}
	if err := r.SetModels(id, []ai.ModelInfo{{ID: "m1", Free: true}}); err != nil {
		t.Fatal(err)
	}
	disabled := false
	name := "OR"
	r.Update(id, domain.ProviderPatch{Enabled: &disabled, Name: &name})
	p, err := r.Get(id)
	if err != nil || p.Name != "OR" || p.Enabled || p.APIKeyEnc != "enc" || len(p.Models) != 1 {
		t.Fatalf("get: %v %+v", err, p)
	}
	if r.Count(false) != 1 || r.Count(true) != 0 || r.Name(id) != "OR" || r.BaseURL(id) != "https://openrouter.ai/api/v1" {
		t.Fatal("lookups")
	}

	prices := NewPrices(db)
	prices.Import(id, "m1", 1, 2)
	prices.Import(id, "m1", 9, 9) // imported prices never override existing ones
	if in, out, ok := prices.Get(id, "m1"); !ok || in != 1 || out != 2 {
		t.Fatalf("import: %v %v %v", in, out, ok)
	}
	prices.Put(id, "m1", 3, 4)
	if list, _ := prices.List(); len(list) != 1 || list[0].ProviderName != "OR" || list[0].InputPerM != 3 {
		t.Fatalf("list: %+v", list)
	}
	prices.Delete(id, "m1")
	if _, _, ok := prices.Get(id, "m1"); ok {
		t.Fatal("price not deleted")
	}
	r.Delete(id)
	if len(r.List()) != 0 {
		t.Fatal("provider not deleted")
	}
}

func TestUsageLog(t *testing.T) {
	db := openTestDB(t)
	uid, _ := NewUsers(db).Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	r := NewUsage(db)
	r.Insert(domain.UsageRecord{UserID: &uid, ProviderID: 1, Provider: "p", Model: "m", Task: "chat", InputTokens: 10, CostUSD: 0.5, OK: true})
	r.Insert(domain.UsageRecord{UserID: &uid, ProviderID: 1, Provider: "p", Model: "m", Task: "judge", CostUSD: 0.25, Error: "x"})
	r.Insert(domain.UsageRecord{ProviderID: 1, Provider: "p", Model: "m2", Task: "chat", CostUSD: 1, OK: true})

	if spent, err := r.SpendSince(""); err != nil || spent != 1.75 {
		t.Fatal("spend")
	}
	if per, err := r.SpendPerUserSince(""); err != nil || per[uid] != 0.75 || len(per) != 1 {
		t.Fatal("spend")
	}
	if r.CountSince("", false) != 3 || r.CountSince("", true) != 1 || mustCount(t)(r.CountUserRequestsSince(uid, "", "judge")) != 1 {
		t.Fatal("counts")
	}
	byUser := r.Aggregate("", domain.UsageByUser, 10)
	// guest calls have key "0" and no label: the name subquery finds no user
	if len(byUser) != 2 || byUser[0].Key != "0" || byUser[0].Label != "" || byUser[1].Label != "Sara" || byUser[1].Errors != 1 {
		t.Fatalf("by user (most expensive first): %+v", byUser)
	}
	if byDay := r.Aggregate("", domain.UsageByDay, 10); len(byDay) != 1 || byDay[0].Requests != 3 {
		t.Fatalf("by day: %+v", byDay)
	}
	if recent, _ := r.Recent(2); len(recent) != 2 || recent[0].Model != "m2" || recent[1].User != "Sara" || recent[1].OK {
		t.Fatalf("recent: %+v", recent)
	}
}

// mustCount unwraps a (count, error) result, failing the test on error.
func mustCount(t *testing.T) func(int, error) int {
	return func(n int, err error) int {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
		return n
	}
}
