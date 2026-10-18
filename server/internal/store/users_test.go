package store

import (
	"errors"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestUsersLifecycle(t *testing.T) {
	r := NewUsers(openTestDB(t))
	id, err := r.Create("a@x.it", "Anna", "hash", domain.RoleTeacher, "it")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.Create("A@x.it", "Dup", "", domain.RoleStudent, "it"); !errors.Is(err, domain.ErrEmailTaken) {
		t.Fatalf("duplicate e-mail (case-insensitive): %v", err)
	}
	u, err := r.GetByEmail(" a@x.it ")
	if err != nil || u.ID != id || !u.Active || u.LastLoginAt != nil {
		t.Fatalf("get by email: %v %+v", err, u)
	}

	name, active := "Anna B", false
	if err := r.Update(id, domain.UserPatch{Name: &name, Active: &active}); err != nil {
		t.Fatal(err)
	}
	if err := r.RecordLogin(id); err != nil {
		t.Fatal(err)
	}
	u, _ = r.Get(id)
	if u.Name != "Anna B" || u.Active || u.Role != domain.RoleTeacher || u.LastLoginAt == nil {
		t.Fatalf("after update: %+v", u)
	}
	if err := r.SetPasswordHash(id, "h2"); err != nil {
		t.Fatal(err)
	}
	if h, _ := r.PasswordHash(id); h != "h2" {
		t.Fatalf("hash %q", h)
	}

	r.Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	if r.Count("") != 2 || r.Count(domain.RoleStudent) != 1 {
		t.Fatal("count")
	}
	if found, _ := r.Search("sar", "", 10); len(found) != 1 || found[0].Name != "Sara" {
		t.Fatalf("search: %+v", found)
	}
	if found, _ := r.Search("", domain.RoleTeacher, 10); len(found) != 1 {
		t.Fatalf("search by role: %+v", found)
	}
	if err := r.Delete(id); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Get(id); err == nil {
		t.Fatal("deleted user still found")
	}
}

func TestAuthSessions(t *testing.T) {
	db := openTestDB(t)
	uid, _ := NewUsers(db).Create("a@x.it", "A", "", domain.RoleStudent, "it")
	r := NewAuthSessions(db)
	past := time.Now().Add(-time.Hour).UTC().Format(time.RFC3339)
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	r.Create("old", uid, past)
	r.Create("new", uid, future)
	if err := r.PurgeExpired(); err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.Lookup("old"); err == nil {
		t.Fatal("expired session not purged")
	}
	if got, exp, err := r.Lookup("new"); err != nil || got != uid || exp != future {
		t.Fatalf("lookup: %v %d %s", err, got, exp)
	}
	r.DeleteForUser(uid)
	if _, _, err := r.Lookup("new"); err == nil {
		t.Fatal("sessions of the user not deleted")
	}
}

func TestInvites(t *testing.T) {
	db := openTestDB(t)
	inviter, _ := NewUsers(db).Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	r := NewInvites(db)
	future := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	id, err := r.Create(domain.NewInvite{TokenHash: "h1", Kind: domain.InviteKindInvite, Email: "s@x.it", Role: domain.RoleStudent, InvitedBy: &inviter, Locale: "it", ExpiresAt: future})
	if err != nil {
		t.Fatal(err)
	}
	r.Create(domain.NewInvite{TokenHash: "h2", Kind: domain.InviteKindReset, Email: "t@x.it", Role: domain.RoleTeacher, Locale: "it", ExpiresAt: future})

	inv, err := r.FindByToken("h1", domain.InviteKindInvite)
	if err != nil || inv.ID != id || inv.InvitedBy != "Prof" || !inv.Usable(time.Now()) {
		t.Fatalf("find: %v %+v", err, inv)
	}
	if _, err := r.FindByToken("h2", domain.InviteKindInvite); err == nil {
		t.Fatal("kind must match")
	}
	if len(r.ListAll(10)) != 1 || len(r.ListByInviter(inviter, 10)) != 1 || r.CountPending() != 1 {
		t.Fatal("lists must contain only invitations")
	}
	r.MarkSent(id)
	r.MarkAccepted(id)
	inv, _ = r.Get(id)
	if !inv.EmailSent || inv.AcceptedAt == nil || inv.Usable(time.Now()) || r.CountPending() != 0 {
		t.Fatalf("after accept: %+v", inv)
	}
	r.Delete(id)
	if _, err := r.Get(id); err == nil {
		t.Fatal("deleted invite still found")
	}
}
