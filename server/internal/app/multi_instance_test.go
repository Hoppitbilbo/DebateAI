package app

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/Hoppitbilbo/DebateAI/server/internal/store"
)

// Each service has its own connection pool, caches and gateway. The local
// case always runs; LIBSQL_TEST_URL must point at a disposable libSQL server,
// shared with the existing store remote tests, never a production database.
func TestMultiInstanceConcurrency(t *testing.T) {
	for _, backend := range []string{"SQLite", "LibSQL"} {
		t.Run(backend, func(t *testing.T) {
			url := os.Getenv("LIBSQL_TEST_URL")
			if backend == "LibSQL" && url == "" {
				t.Skip("LIBSQL_TEST_URL not set; requires a disposable database")
			}
			path := filepath.Join(t.TempDir(), "shared.db")
			var peers []*Services
			for range 4 {
				var db *sql.DB
				var err error
				if backend == "LibSQL" {
					db, err = store.OpenRemote(url, "")
				} else {
					db, err = store.Open(path)
				}
				if err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() { db.Close() })
				peers = append(peers, NewServices(Config{Secret: "multi-instance-test"}, db))
			}
			t.Run("RejoinPIN", func(t *testing.T) { checkMultiInstancePIN(t, peers) })
			t.Run("Admission", func(t *testing.T) { checkMultiInstanceAdmission(t, peers) })
			t.Run("Budget", func(t *testing.T) { checkMultiInstanceBudget(t, peers) })
			t.Run("Settings", func(t *testing.T) { checkMultiInstanceSettings(t, peers) })
		})
	}
}

func checkMultiInstancePIN(t *testing.T, peers []*Services) {
	s := peers[0]
	opened, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := s.RoomSvc.End(opened.Room); err != nil {
			t.Error(err)
		}
	})
	guest := joinRoom(t, s, opened.Room.Code, "Anna")
	pin, err := s.RoomSvc.IssueRejoinPIN(opened.Room, guest.ID)
	if err != nil {
		t.Fatal(err)
	}
	originalHash, _, err := s.Rooms.RejoinPIN(guest.ID)
	if err != nil {
		t.Fatal(err)
	}
	results := make(chan error, 40)
	runOnPeers(peers, 40, func(s *Services, _ int) {
		login, err := s.RoomSvc.Rejoin(RejoinRequest{Code: opened.Room.Code, Nickname: "Anna", PIN: pin})
		if err == nil {
			if login == nil || login.UserID != guest.ID || peers[1].Accounts.UserForToken(login.Token) == nil {
				t.Error("the winner must receive a login usable on another instance")
			}
		}
		results <- err
	})
	close(results)
	winners := 0
	for err := range results {
		if err == nil {
			winners++
		} else if !errors.Is(err, ErrBadRejoinPIN) {
			t.Errorf("rejoin: %v", err)
		}
	}
	if winners != 1 {
		t.Fatalf("PIN issued %d logins across independent instances, want 1", winners)
	}
	// A delayed request using the old snapshot must not erase a replacement
	// issued by a different instance. Fixed hashes avoid random PIN collisions.
	expires := time.Now().Add(time.Minute).UTC().Format(time.RFC3339)
	if err := peers[2].Rooms.SetRejoinPIN(guest.ID, "replacement-hash", &expires); err != nil {
		t.Fatal(err)
	}
	if ok, err := peers[3].Rooms.ConsumeRejoinPIN(guest.ID, originalHash, domain.Now()); err != nil || ok {
		t.Fatalf("old snapshot consumed replacement: %v, %v", ok, err)
	}
	if hash, _, err := peers[1].Rooms.RejoinPIN(guest.ID); err != nil || hash != "replacement-hash" {
		t.Fatalf("replacement was lost: %q, %v", hash, err)
	}
}

func checkMultiInstanceAdmission(t *testing.T, peers []*Services) {
	const attempts, limit = 24, 5
	// A refused request has already taken its own slot when it discovers
	// that the shared room is full. Every one of those slots must be freed.
	releases := make(chan func(), attempts)
	runOnPeers(peers, attempts, func(s *Services, i int) {
		release, err := s.Gateway.Admit([]Admission{{fmt.Sprintf("multi:user:%d", i), 1}, {"multi:room", limit}})
		if err == nil {
			releases <- release
		} else if !errors.Is(err, ErrTooManyGenerations) {
			t.Errorf("admit: %v", err)
		}
	})
	close(releases)
	accepted := len(releases)
	for release := range releases {
		release()
	}
	if accepted != limit {
		t.Errorf("admitted %d requests, want %d", accepted, limit)
	}
	// The full capacity must be reusable after completion/cancellation;
	// acquiring every user scope also detects partial-admission leaks.
	var scopes []Admission
	for i := range attempts {
		scopes = append(scopes, Admission{fmt.Sprintf("multi:user:%d", i), 1})
	}
	for _, s := range peers {
		release, err := s.Gateway.Admit(scopes)
		if err != nil {
			t.Fatalf("user slot leaked: %v", err)
		}
		release()
	}
	var held []func()
	defer func() {
		for _, release := range held {
			release()
		}
	}()
	for i := range limit {
		release, err := peers[i%len(peers)].Gateway.Admit([]Admission{{"multi:room", limit}})
		if err != nil {
			t.Fatalf("room capacity not restored: %v", err)
		}
		held = append(held, release)
	}
}

func checkMultiInstanceBudget(t *testing.T, peers []*Services) {
	s := peers[0]
	if err := s.Settings.SaveBudget(BudgetSettings{MonthlyUSD: 1, BlockPaidWhenExceeded: true}); err != nil {
		t.Fatal(err)
	}
	id, err := s.Gateway.insertProvider("multi-instance-paid", ai.KindOpenAI, "", "test-key")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Prices.Put(id, "paid", 0, 250); err != nil {
		t.Fatal(err)
	}
	if err := s.Usage.Insert(domain.UsageRecord{Model: "paid", CostUSD: 0.25, OK: true}); err != nil {
		t.Fatal(err)
	}
	target := RouteTarget{id, "paid"}
	reservations := make(chan int64, 24)
	runOnPeers(peers, 24, func(s *Services, _ int) {
		id, err := s.Gateway.reserveTokens(target, 0, 1000, time.Minute)
		if err == nil {
			reservations <- id
		} else if !errors.Is(err, errBudgetReserved) {
			t.Errorf("reserve: %v", err)
		}
	})
	close(reservations)
	var held []int64
	for id := range reservations {
		held = append(held, id)
	}
	defer func() {
		for _, id := range held {
			s.Gateway.releaseReservation(id)
		}
	}()
	if len(held) != 3 {
		t.Fatalf("$0.25 spent leaves three $0.25 reservations, got %d", len(held))
	}
	// Cancellation frees a reservation without recording usage.
	s.Gateway.releaseReservation(held[0])
	held[0], err = peers[1].Gateway.reserveTokens(target, 0, 1000, time.Minute)
	if err != nil {
		t.Fatalf("cancelled reservation leaked: %v", err)
	}
	// Completion records spending before releasing its reservation.
	for _, id := range held {
		if err := s.Usage.Insert(domain.UsageRecord{Model: "paid", CostUSD: 0.25, OK: true}); err != nil {
			t.Fatal(err)
		}
		s.Gateway.releaseReservation(id)
	}
	if got, err := peers[2].Inflight.Reserved(); err != nil || got != 0 {
		t.Fatalf("reservations leaked: %v, %v", got, err)
	}
	for _, s := range peers {
		id, err := s.Gateway.reserveTokens(target, 0, 1000, time.Minute)
		if err == nil {
			s.Gateway.releaseReservation(id)
		}
		if !errors.Is(err, errBudgetReserved) {
			t.Errorf("spent budget admitted another paid call: %v", err)
		}
	}
}

type pausedSettingsRead struct {
	settingsStore
	read    chan struct{}
	release chan struct{}
}

func (s *pausedSettingsRead) Load(key string, dst any) bool {
	ok := s.settingsStore.Load(key, dst)
	select {
	case s.read <- struct{}{}:
	default:
	}
	<-s.release
	return ok
}

func checkMultiInstanceSettings(t *testing.T, peers []*Services) {
	const key = "multi-instance-cache-test"
	paused := &pausedSettingsRead{peers[0].SettingsStore, make(chan struct{}, 1), make(chan struct{})}
	a := newCachedSettings(paused, settingsCacheTTL)
	b := newCachedSettings(peers[1].SettingsStore, settingsCacheTTL)
	clockA, clockB := time.Now(), time.Now()
	a.now = func() time.Time { return clockA }
	b.now = func() time.Time { return clockB }
	if err := a.Save(key, 1); err != nil {
		t.Fatal(err)
	}
	assertValue := func(c *cachedSettings, want int) {
		t.Helper()
		var got int
		if !c.Load(key, &got) || got != want {
			t.Fatalf("setting = %d, want %d", got, want)
		}
	}
	assertValue(b, 1)
	oldRead := make(chan int, 1)
	go func() {
		var got int
		a.Load(key, &got)
		oldRead <- got
	}()
	<-paused.read // real database snapshot captured before the save
	err := a.Save(key, 2)
	close(paused.release)
	old := <-oldRead
	if err != nil || old != 1 {
		t.Fatalf("save: %v, old snapshot: %d", err, old)
	}
	assertValue(a, 2) // a late read cannot republish the stale snapshot
	assertValue(b, 1) // another instance retains its snapshot until TTL
	clockB = clockB.Add(settingsCacheTTL)
	assertValue(b, 2)
	if err := b.Save(key, 3); err != nil {
		t.Fatal(err)
	}
	assertValue(b, 3)
	assertValue(a, 2)
	clockA = clockA.Add(settingsCacheTTL)
	assertValue(a, 3)
}

func runOnPeers(peers []*Services, n int, f func(*Services, int)) {
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			<-start
			f(peers[i%len(peers)], i)
		})
	}
	close(start)
	wg.Wait()
}
