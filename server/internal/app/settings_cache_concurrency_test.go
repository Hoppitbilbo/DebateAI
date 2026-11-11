package app

import (
	"errors"
	"sync"
	"testing"
	"testing/synctest"
	"time"
)

// gatedSettings captures the database value before pausing a slow read.
// This makes a read finishing after a save reproducible without sockets.
type gatedSettings struct {
	mu       sync.Mutex
	values   map[string]int
	loads    map[string]int
	slowKey  string
	readGate <-chan struct{}
	saveErr  error
}

func (s *gatedSettings) Load(key string, dst any) bool {
	s.mu.Lock()
	v, found := s.values[key]
	s.loads[key]++
	s.mu.Unlock()
	if key == s.slowKey {
		<-s.readGate
	}
	return found && remarshal(v, dst) == nil
}

func (s *gatedSettings) Save(key string, v any) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.saveErr != nil {
		return s.saveErr
	}
	s.values[key] = v.(int)
	return nil
}

func (s *gatedSettings) loadCount(key string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loads[key]
}

func TestCachedSettingsCoalescesConcurrentReads(t *testing.T) {
	for _, found := range []bool{true, false} {
		name := "present"
		if !found {
			name = "missing"
		}
		t.Run(name, func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				gate := make(chan struct{})
				inner := &gatedSettings{values: map[string]int{}, loads: map[string]int{}, slowKey: "k", readGate: gate}
				if found {
					inner.values["k"] = 7
				}
				c := newCachedSettings(inner, 5*time.Second)
				for wave := range 2 { // both an empty cache and an expired snapshot
					if wave > 0 {
						time.Sleep(5 * time.Second)
						gate = make(chan struct{})
						inner.readGate = gate
					}
					for range 100 {
						go func() {
							var got int
							if ok := c.Load("k", &got); ok != found || (ok && got != 7) {
								t.Errorf("load = %d, %v; want found=%v", got, ok, found)
							}
						}()
					}
					synctest.Wait() // every reader is waiting for the database result
					loads := inner.loadCount("k")
					close(gate)
					synctest.Wait()
					if loads != wave+1 {
						t.Fatalf("wave %d: database reads = %d, want %d", wave, loads, wave+1)
					}
				}
			})
		})
	}
}

func TestCachedSettingsSaveCannotBeUndoneByAnOlderRead(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		gate := make(chan struct{})
		inner := &gatedSettings{values: map[string]int{"k": 1}, loads: map[string]int{}, slowKey: "k", readGate: gate}
		c := newCachedSettings(inner, 5*time.Second)
		go func() {
			var old int
			c.Load("k", &old)
		}()
		synctest.Wait() // the old value was captured but has not returned
		if err := c.Save("k", 2); err != nil {
			t.Fatal(err)
		}
		close(gate)
		synctest.Wait() // the stale read finishes after Save invalidates the key
		var got int
		if !c.Load("k", &got) || got != 2 {
			t.Fatalf("a completed save must stay visible: got %d, want 2", got)
		}
	})
}

func TestCachedSettingsSlowKeyDoesNotBlockOtherKeys(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		gate := make(chan struct{})
		inner := &gatedSettings{values: map[string]int{"slow": 1, "fast": 2}, loads: map[string]int{}, slowKey: "slow", readGate: gate}
		c := newCachedSettings(inner, 5*time.Second)
		go func() {
			var got int
			c.Load("slow", &got)
		}()
		synctest.Wait()
		var got int
		if !c.Load("fast", &got) || got != 2 {
			t.Errorf("unrelated key: got %d, want 2", got)
		}
		close(gate)
	})
}

func TestCachedSettingsFailedSaveStillInvalidates(t *testing.T) {
	wantErr := errors.New("database unavailable")
	inner := &gatedSettings{values: map[string]int{"k": 1}, loads: map[string]int{}, saveErr: wantErr}
	c := newCachedSettings(inner, 5*time.Second)
	var got int
	c.Load("k", &got)
	if err := c.Save("k", 2); !errors.Is(err, wantErr) {
		t.Fatalf("save error = %v, want %v", err, wantErr)
	}
	if !c.Load("k", &got) || got != 1 || inner.loadCount("k") != 2 {
		t.Fatalf("failed save must invalidate and reload the stored value: got %d, loads %d", got, inner.loadCount("k"))
	}
}
