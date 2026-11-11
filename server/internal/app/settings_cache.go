package app

import (
	"encoding/json"
	"sync"
	"time"
)

// cachedSettings keeps the settings documents in memory for a short time
// (Decorator over settingsStore): routing and budget checks read them on
// every AI call, and on a remote database each read is a network round
// trip. A Save through this process invalidates its key at once; another
// instance sees the change within settingsCacheTTL. Each Load decodes a
// fresh copy, so callers never share maps or slices. Concurrent reads of
// one key share a pending result without blocking reads of other keys.
type cachedSettings struct {
	settingsStore
	ttl time.Duration
	now func() time.Time

	mu      sync.Mutex
	entries map[string]*cachedSetting
}

type cachedSetting struct {
	ready chan struct{}   // closed once the snapshot below is immutable
	raw   json.RawMessage // nil when the key is missing
	found bool
	at    time.Time
}

func newCachedSettings(inner settingsStore, ttl time.Duration) *cachedSettings {
	return &cachedSettings{settingsStore: inner, ttl: ttl, now: time.Now, entries: map[string]*cachedSetting{}}
}

func (c *cachedSettings) Load(key string, dst any) bool {
	c.mu.Lock()
	e := c.entries[key]
	if e != nil {
		select {
		case <-e.ready:
			if c.now().Sub(e.at) >= c.ttl {
				e = nil
			}
		default: // join the read already in progress
		}
	}
	load := e == nil
	if load {
		e = &cachedSetting{ready: make(chan struct{})}
		c.entries[key] = e
	}
	c.mu.Unlock()
	if load {
		e.found = c.settingsStore.Load(key, &e.raw)
		e.at = c.now()
		// Save may have removed this entry while the database read was
		// pending. Complete its waiters, but never put it back in the map.
		close(e.ready)
	}
	<-e.ready
	return e.found && json.Unmarshal(e.raw, dst) == nil
}

func (c *cachedSettings) Save(key string, v any) error {
	err := c.settingsStore.Save(key, v)
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
	return err
}
