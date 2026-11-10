package store

import (
	"database/sql"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func inOneHour() string { return time.Now().Add(time.Hour).UTC().Format(time.RFC3339) }

// resetFixture is a username class owned by a teacher, with a co-teacher,
// an admin and a student created from the class link.
type resetFixture struct {
	db                                *sql.DB
	users                             *Users
	classes                           *Classes
	resets                            *PasswordResets
	class, owner, coTeacher, admin, s int64
}

func newResetFixture(t *testing.T) *resetFixture {
	t.Helper()
	db := openTestDB(t)
	f := &resetFixture{db: db, users: NewUsers(db), classes: NewClasses(db), resets: NewPasswordResets(db)}
	f.owner, _ = f.users.Create("prof@x.it", "Prof", "h", domain.RoleTeacher, "it")
	f.coTeacher, _ = f.users.Create("co@x.it", "Co", "h", domain.RoleTeacher, "it")
	f.admin, _ = f.users.Create("admin@x.it", "Admin", "h", domain.RoleAdmin, "it")
	var err error
	if f.class, err = f.classes.Create("3A", "", f.owner, domain.EnrollUsername); err != nil {
		t.Fatal(err)
	}
	if err := f.classes.AddMember(f.class, f.coTeacher, domain.RoleTeacher); err != nil {
		t.Fatal(err)
	}
	c, _ := f.classes.Get(f.class)
	if f.s, _, err = f.users.CreateStudentInClass(domain.NewClassStudent{Code: c.JoinCode, Username: "anna", Name: "anna", PasswordHash: "old", Locale: "it"}); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *resetFixture) assisted(token string, issuer int64) domain.NewPasswordReset {
	return domain.NewPasswordReset{TokenHash: token, UserID: f.s, ExpiresAt: inOneHour(), IssuedBy: &issuer, ClassID: &f.class}
}

func TestEmailResetIsUsedOnceAndRevokesAccess(t *testing.T) {
	db := openTestDB(t)
	users, resets, logins := NewUsers(db), NewPasswordResets(db), NewAuthSessions(db)
	id, _ := users.Create("a@x.it", "Anna", "old", domain.RoleStudent, "it")
	logins.Create("s1", id, inOneHour())
	if err := resets.Issue(domain.NewPasswordReset{TokenHash: "t1", UserID: id, ExpiresAt: inOneHour()}); err != nil {
		t.Fatal(err)
	}
	if err := resets.Issue(domain.NewPasswordReset{TokenHash: "t2", UserID: id, ExpiresAt: inOneHour()}); err != nil {
		t.Fatal(err)
	}
	if _, err := resets.Consume("t1", "new"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("a newer link replaces the older one: %v", err)
	}
	uid, err := resets.Consume("t2", "new")
	if err != nil || uid != id {
		t.Fatalf("consume: %d %v", uid, err)
	}
	if h, _ := users.PasswordHash(id); h != "new" {
		t.Fatalf("hash %q", h)
	}
	if _, _, err := logins.Lookup("s1"); err == nil {
		t.Fatal("logins must end")
	}
	if _, err := resets.Consume("t2", "again"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("reuse: %v", err)
	}
	if h, _ := users.PasswordHash(id); h != "new" {
		t.Fatal("a refused link changed the password")
	}
}

func TestResetLinkExpiresAndInvalidates(t *testing.T) {
	db := openTestDB(t)
	users, resets := NewUsers(db), NewPasswordResets(db)
	id, _ := users.Create("a@x.it", "Anna", "old", domain.RoleStudent, "it")
	past := time.Now().Add(-time.Minute).UTC().Format(time.RFC3339)
	resets.Issue(domain.NewPasswordReset{TokenHash: "old", UserID: id, ExpiresAt: past})
	if _, err := resets.Consume("old", "new"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("expired: %v", err)
	}
	resets.Issue(domain.NewPasswordReset{TokenHash: "t", UserID: id, ExpiresAt: inOneHour()})
	if err := resets.Invalidate(id); err != nil {
		t.Fatal(err)
	}
	if _, err := resets.Consume("t", "new"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("invalidated: %v", err)
	}
	off := false
	users.Update(id, domain.UserPatch{Active: &off})
	if err := resets.Issue(domain.NewPasswordReset{TokenHash: "t3", UserID: id, ExpiresAt: inOneHour()}); !errors.Is(err, domain.ErrResetNotAllowed) {
		t.Fatalf("disabled account: %v", err)
	}
	if h, _ := users.PasswordHash(id); h != "old" {
		t.Fatal("password changed")
	}
}

func TestAssistedResetRules(t *testing.T) {
	f := newResetFixture(t)
	if err := f.resets.Issue(f.assisted("co", f.coTeacher)); !errors.Is(err, domain.ErrResetNotAllowed) {
		t.Fatalf("co-teacher: %v", err)
	}
	if err := f.resets.Issue(f.assisted("adm", f.admin)); err != nil {
		t.Fatalf("admin: %v", err)
	}
	if err := f.resets.Issue(f.assisted("own", f.owner)); err != nil {
		t.Fatalf("owner: %v", err)
	}
	if got, err := f.resets.Resettable(f.class); err != nil || len(got) != 1 || !got[f.s] {
		t.Fatalf("resettable: %v %v", got, err)
	}
	// The owner changes between issue and use: the link stops working.
	if _, err := f.db.Exec(`UPDATE classes SET owner_id = ? WHERE id = ?`, f.coTeacher, f.class); err != nil {
		t.Fatal(err)
	}
	if _, err := f.resets.Consume("own", "new"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("owner changed: %v", err)
	}
	if h, _ := f.users.PasswordHash(f.s); h != "old" {
		t.Fatal("password changed")
	}
}

func TestAssistedResetStopsWhenTheStudentOrClassChanges(t *testing.T) {
	for name, change := range map[string]func(f *resetFixture){
		"student removed": func(f *resetFixture) { f.classes.RemoveMember(f.class, f.s) },
		"class archived":  func(f *resetFixture) { f.classes.Update(f.class, domain.ClassPatch{Archived: ptrTo(true)}) },
		"class deleted":   func(f *resetFixture) { f.classes.Delete(f.class) },
		"issuer demoted":  func(f *resetFixture) { f.users.Update(f.owner, domain.UserPatch{Role: ptrTo(domain.RoleStudent)}) },
		"issuer deleted":  func(f *resetFixture) { f.users.Delete(f.owner) },
		"student off":     func(f *resetFixture) { f.users.Update(f.s, domain.UserPatch{Active: ptrTo(false)}) },
	} {
		t.Run(name, func(t *testing.T) {
			f := newResetFixture(t)
			if err := f.resets.Issue(f.assisted("tok", f.owner)); err != nil {
				t.Fatal(err)
			}
			change(f)
			if _, err := f.resets.Consume("tok", "new"); !errors.Is(err, domain.ErrResetLinkInvalid) {
				t.Fatalf("want ErrResetLinkInvalid, got %v", err)
			}
		})
	}
}

func TestAssistedResetRefusesAccountsWithEmail(t *testing.T) {
	f := newResetFixture(t)
	mail, _ := f.users.Create("m@x.it", "Marco", "h", domain.RoleStudent, "it")
	f.classes.AddMember(f.class, mail, domain.RoleStudent)
	if _, err := f.db.Exec(`UPDATE users SET recovery_class_id = ? WHERE id = ?`, f.class, mail); err != nil {
		t.Fatal(err)
	}
	n := f.assisted("tok", f.owner)
	n.UserID = mail
	if err := f.resets.Issue(n); !errors.Is(err, domain.ErrResetNotAllowed) {
		t.Fatalf("account with e-mail: %v", err)
	}
}

func TestConcurrentConsumeSucceedsOnce(t *testing.T) {
	f := newResetFixture(t)
	if err := f.resets.Issue(f.assisted("tok", f.owner)); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make([]error, 8)
	for i := range errs {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, errs[i] = f.resets.Consume("tok", "new")
		}(i)
	}
	wg.Wait()
	ok := 0
	for _, err := range errs {
		switch {
		case err == nil:
			ok++
		case !errors.Is(err, domain.ErrResetLinkInvalid):
			t.Fatal(err)
		}
	}
	if ok != 1 {
		t.Fatalf("%d consumes succeeded", ok)
	}
}

func TestChangePasswordIsAtomic(t *testing.T) {
	db := openTestDB(t)
	users, resets, logins := NewUsers(db), NewPasswordResets(db), NewAuthSessions(db)
	id, _ := users.Create("a@x.it", "Anna", "old", domain.RoleStudent, "it")
	logins.Create("s1", id, inOneHour())
	resets.Issue(domain.NewPasswordReset{TokenHash: "t", UserID: id, ExpiresAt: inOneHour()})
	if err := users.ChangePassword(id, domain.UserPatch{Name: ptrTo("Anna B"), Role: ptrTo("boss")}, "new"); err == nil {
		t.Fatal("an invalid role must fail")
	}
	if u, _ := users.Get(id); u.Name != "Anna" {
		t.Fatalf("partial write: %+v", u)
	}
	if h, _ := users.PasswordHash(id); h != "old" {
		t.Fatal("partial write of the password")
	}
	if err := users.ChangePassword(id, domain.UserPatch{Name: ptrTo("Anna B")}, "new"); err != nil {
		t.Fatal(err)
	}
	if u, _ := users.Get(id); u.Name != "Anna B" {
		t.Fatal("name not saved")
	}
	if _, _, err := logins.Lookup("s1"); err == nil {
		t.Fatal("logins must end")
	}
	if _, err := resets.Consume("t", "x"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatal("reset links must be invalidated")
	}
}

func TestJoinByCodeChecksTheCodeInTheInsert(t *testing.T) {
	db := openTestDB(t)
	users, classes := NewUsers(db), NewClasses(db)
	teacher, _ := users.Create("prof@x.it", "Prof", "", domain.RoleTeacher, "it")
	stud, _ := users.Create("s@x.it", "S", "", domain.RoleStudent, "it")
	id, _ := classes.Create("3A", "", teacher, domain.EnrollStandard)
	c, _ := classes.Get(id)
	if got, err := classes.JoinByCode(c.JoinCode, stud); err != nil || got != id || !classes.IsMember(id, stud) {
		t.Fatalf("join: %d %v", got, err)
	}
	if got, err := classes.JoinByCode(c.JoinCode, teacher); err != nil || got != id || !classes.Teaches(id, teacher) {
		t.Fatalf("an existing member keeps its role: %v", err)
	}
	classes.SetJoinCode(id, "NEWONE")
	other, _ := users.Create("o@x.it", "O", "", domain.RoleStudent, "it")
	if _, err := classes.JoinByCode(c.JoinCode, other); !errors.Is(err, sql.ErrNoRows) || classes.IsMember(id, other) {
		t.Fatalf("replaced code: %v", err)
	}
	classes.Update(id, domain.ClassPatch{Archived: ptrTo(true)})
	if _, err := classes.JoinByCode("NEWONE", other); !errors.Is(err, sql.ErrNoRows) || classes.IsMember(id, other) {
		t.Fatalf("archived class: %v", err)
	}
}

func ptrTo[T any](v T) *T { return &v }
