package app

import (
	"sync/atomic"
	"time"
)

// housekeeping deletes rows that expired: generation slots and budget
// reservations, rate-limit counters, login sessions. Every check already
// ignores expired rows, so this is cleanup only, kept off each request's
// statements (investigation 11/11, E1): it runs at most once per
// housekeepingInterval per instance, and from the cron.
type housekeeping struct {
	last  atomic.Int64
	tasks []housekeepingTask
}

type housekeepingTask struct {
	name  string
	purge func() error
}

// Tidy runs the purges unless another call did within the interval.
func (h *housekeeping) Tidy() {
	now := time.Now().Unix()
	last := h.last.Load()
	if now-last < int64(housekeepingInterval.Seconds()) || !h.last.CompareAndSwap(last, now) {
		return
	}
	h.run()
}

// Force runs the purges now (the cron).
func (h *housekeeping) Force() {
	h.last.Store(time.Now().Unix())
	h.run()
}

func (h *housekeeping) run() {
	for _, t := range h.tasks {
		logIfErr("purge expired "+t.name, t.purge())
	}
}
