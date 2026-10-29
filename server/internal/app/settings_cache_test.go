package app

import (
	"encoding/json"
	"testing"
	"time"
)

// countingSettings is an in-memory settingsStore that counts the reads.
type countingSettings struct {
	values map[string]any
	loads  int
}

func (c *countingSettings) Load(key string, dst any) bool {
	c.loads++
	v, ok := c.values[key]
	if !ok {
		return false
	}
	return remarshal(v, dst) == nil
}

func (c *countingSettings) Save(key string, v any) error {
	c.values[key] = v
	return nil
}

func remarshal(v, dst any) error {
	b := mustJSON(v)
	return json.Unmarshal([]byte(b), dst)
}

func TestCachedSettingsReadOnceUntilSavedOrExpired(t *testing.T) {
	inner := &countingSettings{values: map[string]any{"k": map[string]int{"a": 1}}}
	clock := time.Unix(0, 0)
	c := newCachedSettings(inner, 5*time.Second)
	c.now = func() time.Time { return clock }

	var got map[string]int
	for range 3 {
		if !c.Load("k", &got) || got["a"] != 1 {
			t.Fatalf("load: %v", got)
		}
	}
	if inner.loads != 1 {
		t.Fatalf("cached reads: %d", inner.loads)
	}
	got["a"] = 99 // a caller changing its copy does not change the cache
	var again map[string]int
	c.Load("k", &again)
	if again["a"] != 1 {
		t.Fatal("callers must get their own copy")
	}

	_ = c.Save("k", map[string]int{"a": 2})
	c.Load("k", &got)
	if got["a"] != 2 || inner.loads != 2 {
		t.Fatalf("a save invalidates: %v %d", got, inner.loads)
	}
	clock = clock.Add(5 * time.Second)
	c.Load("k", &got)
	if inner.loads != 3 {
		t.Fatal("an expired entry is read again (another instance may have changed it)")
	}
	if c.Load("missing", &got) || c.Load("missing", &got) || inner.loads != 4 {
		t.Fatalf("a missing key is reported missing and cached too: %d", inner.loads)
	}
}

type countingPrices struct{ asked int }

func (c *countingPrices) priceFor(int64, string) price {
	c.asked++
	return price{}
}

func TestStrategiesAskEachPriceOnce(t *testing.T) {
	book := &countingPrices{}
	list := []RouteTarget{{1, "a"}, {1, "b"}, {2, "c"}, {2, "d"}, {3, "e"}}
	cheapest{}.order(list, memoize(book))
	if book.asked != len(list) {
		t.Fatalf("each target priced once, not per comparison: %d", book.asked)
	}
}
