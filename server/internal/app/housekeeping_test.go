package app

import "testing"

func TestHousekeepingRunsAtMostOncePerInterval(t *testing.T) {
	runs := 0
	h := &housekeeping{tasks: []housekeepingTask{{"x", func() error { runs++; return nil }}}}
	h.Tidy()
	h.Tidy()
	if runs != 1 {
		t.Fatalf("two requests in the same minute purge once, got %d", runs)
	}
	h.Force()
	if runs != 2 {
		t.Fatalf("the cron always purges, got %d", runs)
	}
}
