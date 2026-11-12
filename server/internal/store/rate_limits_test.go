package store

import (
	"fmt"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestAuthRateLimitsCountWithinTheWindow(t *testing.T) {
	r := NewAuthRateLimits(openTestDB(t))
	for i := 0; i < 3; i++ {
		if ok, err := r.Hit("k", 3, time.Hour); err != nil || !ok {
			t.Fatalf("hit %d: %v %v", i, ok, err)
		}
	}
	if ok, err := r.Hit("k", 3, time.Hour); err != nil || ok {
		t.Fatalf("fourth hit must be refused: %v %v", ok, err)
	}
	if ok, _ := r.Hit("other", 3, time.Hour); !ok {
		t.Fatal("keys are independent")
	}
}

func TestAuthRateLimitsRestartAfterExpiryAndPurge(t *testing.T) {
	db := openTestDB(t)
	r := NewAuthRateLimits(db)
	if ok, _ := r.Hit("k", 1, -time.Second); !ok { // already expired window
		t.Fatal("first hit")
	}
	if ok, _ := r.Hit("k", 1, time.Hour); !ok {
		t.Fatal("an expired window must start again")
	}
	if ok, _ := r.Hit("k", 1, time.Hour); ok {
		t.Fatal("the new window counts")
	}
	if _, err := db.Exec(`INSERT INTO auth_rate_limits(key, count, expires_at) VALUES('old', 5, '2000-01-01T00:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	if err := r.PurgeExpired(); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := db.QueryRow(`SELECT COUNT(*) FROM auth_rate_limits WHERE key = 'old'`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("expired rows must be purged: %d %v", n, err)
	}
}

func TestAuthRateLimitsAreAtomic(t *testing.T) {
	r := NewAuthRateLimits(openTestDB(t))
	var passed atomic.Int32
	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ok, err := r.Hit("k", 10, time.Hour)
			if err != nil {
				t.Error(err)
			}
			if ok {
				passed.Add(1)
			}
		}()
	}
	wg.Wait()
	if passed.Load() != 10 {
		t.Fatalf("passed %d, want 10", passed.Load())
	}
}

// The conditional upsert on a libSQL server, as on Turso (see
// TestRemoteSchema for LIBSQL_TEST_URL).
func TestRemoteAuthRateLimits(t *testing.T) {
	url := os.Getenv("LIBSQL_TEST_URL")
	if url == "" {
		t.Skip("LIBSQL_TEST_URL not set")
	}
	db, err := OpenRemote(url, "")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewAuthRateLimits(db)
	key := fmt.Sprintf("remote-%d", time.Now().UnixNano())
	for i := 0; i < 2; i++ {
		if ok, err := r.Hit(key, 2, time.Hour); err != nil || !ok {
			t.Fatalf("hit %d: %v %v", i, ok, err)
		}
	}
	if ok, err := r.Hit(key, 2, time.Hour); err != nil || ok {
		t.Fatalf("third hit must be refused: %v %v", ok, err)
	}
}

func TestAuthRateLimitsRefundGivesOneAttemptBack(t *testing.T) {
	r := NewAuthRateLimits(openTestDB(t))
	if err := r.Refund("none"); err != nil {
		t.Fatal("refunding an unknown key does nothing")
	}
	for range 2 {
		r.Hit("k", 2, time.Hour)
	}
	if ok, _ := r.Hit("k", 2, time.Hour); ok {
		t.Fatal("full")
	}
	if err := r.Refund("k"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := r.Hit("k", 2, time.Hour); !ok {
		t.Fatal("a refunded attempt can be used again")
	}
}
