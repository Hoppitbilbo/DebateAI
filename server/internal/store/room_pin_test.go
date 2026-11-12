package store

import (
	"sync"
	"testing"
	"time"
)

func TestConsumeRejoinPINOnlyOnceAcrossRepositories(t *testing.T) {
	db := openTestDB(t)
	r := NewRooms(db)
	room := newTestRoom(t, r, "host", nil, time.Now().Add(time.Hour), 1)
	guest, err := r.AddGuest(room.ID, "Anna", "fox", "it")
	if err != nil {
		t.Fatal(err)
	}
	expires := "2030-01-01T00:00:00Z"
	if err := r.SetRejoinPIN(guest, "hash", &expires); err != nil {
		t.Fatal(err)
	}
	const attempts = 40
	results := make(chan bool, attempts)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for range attempts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			ok, err := NewRooms(db).ConsumeRejoinPIN(guest, "hash", "2026-11-11T00:00:00Z")
			if err != nil {
				t.Error(err)
			}
			results <- ok
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	consumed := 0
	for ok := range results {
		if ok {
			consumed++
		}
	}
	if consumed != 1 {
		t.Fatalf("PIN consumed %d times, want 1", consumed)
	}
	if hash, expires, err := r.RejoinPIN(guest); err != nil || hash != "" || expires != "" {
		t.Fatalf("used PIN must be cleared: %q %q %v", hash, expires, err)
	}
}

func TestConsumeRejoinPINRejectsInvalidSnapshots(t *testing.T) {
	r := NewRooms(openTestDB(t))
	room := newTestRoom(t, r, "host", nil, time.Now().Add(time.Hour), 1)
	guest, err := r.AddGuest(room.ID, "Anna", "fox", "it")
	if err != nil {
		t.Fatal(err)
	}
	const now = "2026-11-11T00:00:00Z"
	for _, tc := range []struct {
		name, stored, expires, candidate string
	}{
		{"replaced", "new", "2030-01-01T00:00:00Z", "old"},
		{"wrong", "new", "2030-01-01T00:00:00Z", "wrong"},
		{"expired", "new", "2000-01-01T00:00:00Z", "new"},
		{"empty", "", "2030-01-01T00:00:00Z", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := r.SetRejoinPIN(guest, tc.stored, &tc.expires); err != nil {
				t.Fatal(err)
			}
			if ok, err := r.ConsumeRejoinPIN(guest, tc.candidate, now); err != nil || ok {
				t.Fatalf("invalid PIN consumed: %v, %v", ok, err)
			}
			if hash, expires, err := r.RejoinPIN(guest); err != nil || hash != tc.stored || expires != tc.expires {
				t.Fatalf("rejected snapshot changed the stored PIN: %q %q %v", hash, expires, err)
			}
		})
	}
}
