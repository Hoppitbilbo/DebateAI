package store

import "testing"

func TestOutboxClaimsEachMailOnce(t *testing.T) {
	r := NewOutbox(openTestDB(t))
	if err := r.Enqueue("a@x.it", "s", "b"); err != nil {
		t.Fatal(err)
	}
	got, err := r.Claim(10, farFuture)
	if err != nil || len(got) != 1 || got[0].To != "a@x.it" {
		t.Fatalf("claim: %v %+v", err, got)
	}
	if again, _ := r.Claim(10, farFuture); len(again) != 0 {
		t.Fatal("a claimed mail is not due until its lease ends")
	}
	retry := "2000-01-01T00:00:00Z"
	if err := r.MarkFailed(got[0].ID, 1, "down", &retry); err != nil {
		t.Fatal(err)
	}
	if due, _ := r.Claim(10, farFuture); len(due) != 1 || due[0].Attempts != 1 {
		t.Fatalf("due again for the retry: %+v", due)
	}
	if err := r.MarkSent(got[0].ID); err != nil {
		t.Fatal(err)
	}
	if n, _ := r.CountPending(); n != 0 {
		t.Fatalf("pending: %d", n)
	}
}
