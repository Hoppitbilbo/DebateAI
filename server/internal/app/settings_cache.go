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
// fresh copy, so callers never share maps or slices.
type cachedSettings struct {
	settingsStore
	ttl time.Duration
	now func() time.Time

	mu      sync.Mutex
	entries map[string]cachedSetting
}

type cachedSetting struct {
	raw   json.RawMessage // nil when the key is missing
	found bool
	at    time.Time
}

func newCachedSettings(inner settingsStore, ttl time.Duration) *cachedSettings {
	return &cachedSettings{settingsStore: inner, ttl: ttl, now: time.Now, entries: map[string]cachedSetting{}}
}

func (c *cachedSettings) Load(key string, dst any) bool {
	c.mu.Lock()
	e, ok := c.entries[key]
	c.mu.Unlock()
	if !ok || c.now().Sub(e.at) >= c.ttl {
		var raw json.RawMessage
		found := c.settingsStore.Load(key, &raw)
		e = cachedSetting{raw: raw, found: found, at: c.now()}
		c.mu.Lock()
		c.entries[key] = e
		c.mu.Unlock()
	}
	return e.found && json.Unmarshal(e.raw, dst) == nil
}

func (c *cachedSettings) Save(key string, v any) error {
	err := c.settingsStore.Save(key, v)
	c.mu.Lock()
	delete(c.entries, key)
	c.mu.Unlock()
	return err
}
