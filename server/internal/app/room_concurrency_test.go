package app

import (
	"errors"
	"sync"
	"testing"
)

// Force every request to validate the same snapshot before any can consume
// it, as can happen across several server instances sharing a database.
type rejoinSnapshotBarrier struct {
	roomStore
	readers sync.WaitGroup
}

func (r *rejoinSnapshotBarrier) RejoinPIN(userID int64) (string, string, error) {
	hash, expires, err := r.roomStore.RejoinPIN(userID)
	r.readers.Done()
	r.readers.Wait()
	return hash, expires, err
}

func TestRoomRejoinPINOnlyOneConcurrentLogin(t *testing.T) {
	const attempts = 16
	s := newTestServer(t)
	opened, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	guest := joinRoom(t, s, opened.Room.Code, "Anna")
	pin, err := s.RoomSvc.IssueRejoinPIN(opened.Room, guest.ID)
	if err != nil {
		t.Fatal(err)
	}
	barrier := &rejoinSnapshotBarrier{roomStore: s.RoomSvc.rooms}
	barrier.readers.Add(attempts)
	s.RoomSvc.rooms = barrier
	results := make(chan error, attempts)
	var wg sync.WaitGroup
	for range attempts {
		wg.Add(1)
		go func() {
			defer wg.Done()
			login, err := s.RoomSvc.Rejoin(RejoinRequest{Code: opened.Room.Code, Nickname: "Anna", PIN: pin})
			if err == nil && (login == nil || login.UserID != guest.ID || s.Accounts.UserForToken(login.Token) == nil) {
				t.Error("the winning request must receive a working guest login")
			}
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	accepted := 0
	for err := range results {
		if err == nil {
			accepted++
		} else if !errors.Is(err, ErrBadRejoinPIN) {
			t.Errorf("losing request: %v, want ErrBadRejoinPIN", err)
		}
	}
	if accepted != 1 {
		t.Fatalf("a one-use PIN issued %d guest logins, want 1", accepted)
	}
}
