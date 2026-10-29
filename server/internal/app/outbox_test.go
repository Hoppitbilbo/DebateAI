package app

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestOutboxRetriesAFailedMailOnlyAfterItsDelay(t *testing.T) {
	s := newTestServer(t)
	var sent []string
	fail := true
	s.Outbox.send = func(to, subject, body string) error {
		if fail {
			return errors.New("smtp down")
		}
		sent = append(sent, to)
		return nil
	}
	clock := time.Now()
	s.Outbox.now = func() time.Time { return clock }
	s.Outbox.enqueue("a@x.it", "s", "b")

	if n := s.Outbox.Deliver(context.Background()); n != 0 {
		t.Fatal("first attempt fails")
	}
	if pending, _ := s.Outbox.store.CountPending(); pending != 1 {
		t.Fatal("a failed mail waits for its retry")
	}
	// Due again only after the retry delay: nothing happens now.
	fail = false
	if n := s.Outbox.Deliver(context.Background()); n != 0 {
		t.Fatal("not due yet")
	}
	if pending, _ := s.Outbox.store.CountPending(); pending != 1 {
		t.Fatal("still pending")
	}
}

func TestOutboxDeliversQueuedMail(t *testing.T) {
	s := newTestServer(t)
	var sent []string
	s.Outbox.send = func(to, subject, body string) error {
		sent = append(sent, to)
		return nil
	}
	for _, to := range []string{"a@x.it", "b@x.it"} {
		s.Outbox.enqueue(to, "s", "b")
	}
	if n := s.Outbox.Deliver(context.Background()); n != 2 || len(sent) != 2 {
		t.Fatalf("delivered %d: %v", n, sent)
	}
	if pending, _ := s.Outbox.store.CountPending(); pending != 0 {
		t.Fatal("nothing left")
	}
}

func TestOutboxGivesUpAfterTheLastRetry(t *testing.T) {
	s := newTestServer(t)
	s.Outbox.send = func(string, string, string) error { return errors.New("bad address") }
	clock := time.Now()
	s.Outbox.now = func() time.Time { return clock }
	s.Outbox.enqueue("a@x.it", "s", "b")
	mails, _ := s.Outbox.store.Claim(1, clock.Add(time.Minute).UTC().Format(time.RFC3339))
	m := mails[0]
	m.Attempts = len(outboxRetries) // the last retry
	s.Outbox.deliver(m)
	if pending, _ := s.Outbox.store.CountPending(); pending != 0 {
		t.Fatal("given up after the last retry")
	}
}
