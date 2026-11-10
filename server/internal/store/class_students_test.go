package store

import (
	"database/sql"
	"errors"
	"path/filepath"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestCreateStudentInClass(t *testing.T) {
	db := openTestDB(t)
	users, classes := NewUsers(db), NewClasses(db)
	teacher, _ := users.Create("prof@x.it", "Prof", "", domain.RoleTeacher, "it")
	open, err := classes.Create("3A", "", teacher, domain.EnrollUsername)
	if err != nil {
		t.Fatal(err)
	}
	standard, _ := classes.Create("3B", "", teacher, domain.EnrollStandard)
	c, _ := classes.Get(open)
	s, _ := classes.Get(standard)
	if len(c.JoinCode) != 39 || len(s.JoinCode) != 6 || c.EnrollmentMode != domain.EnrollUsername {
		t.Fatalf("codes: %+v %+v", c, s)
	}
	n := domain.NewClassStudent{Code: c.JoinCode, Username: "mario.rossi", Name: "mario.rossi", PasswordHash: "h", Locale: "it"}
	uid, cid, err := users.CreateStudentInClass(n)
	if err != nil || cid != open || !classes.IsMember(open, uid) {
		t.Fatalf("enroll: %d %d %v", uid, cid, err)
	}
	u, err := users.GetByUsername("mario.rossi")
	if err != nil || u.ID != uid || u.Email != "" || u.Role != domain.RoleStudent {
		t.Fatalf("by username: %v %+v", err, u)
	}
	if _, err := users.GetByEmail(""); err == nil {
		t.Fatal("an empty e-mail matched an account without e-mail")
	}
	if m := classes.Members(open); len(m) != 2 || m[1].Username != "mario.rossi" || m[1].Email != "" {
		t.Fatalf("members: %+v", m)
	}
	if st, err := classes.Students(open); err != nil || len(st) != 1 || st[0].Username != "mario.rossi" {
		t.Fatalf("students: %v %+v", err, st)
	}
	if found, _ := users.Search("mario", "", 10); len(found) != 1 {
		t.Fatalf("search by username: %+v", found)
	}

	before := users.Count("")
	dup := n
	dup.Username = "MARIO.ROSSI"
	if _, _, err := users.CreateStudentInClass(dup); !errors.Is(err, domain.ErrUsernameTaken) {
		t.Fatalf("duplicate username: %v", err)
	}
	other := n
	other.Username = "anna"
	other.Code = s.JoinCode
	if _, _, err := users.CreateStudentInClass(other); !errors.Is(err, domain.ErrEnrollmentClosed) {
		t.Fatalf("standard class code: %v", err)
	}
	if err := classes.SetJoinCode(open, domain.NewEnrollmentCode()); err != nil {
		t.Fatal(err)
	}
	other.Code = c.JoinCode
	if _, _, err := users.CreateStudentInClass(other); !errors.Is(err, domain.ErrEnrollmentClosed) {
		t.Fatalf("regenerated code: %v", err)
	}
	archived := true
	c, _ = classes.Get(open)
	classes.Update(open, domain.ClassPatch{Archived: &archived})
	other.Code = c.JoinCode
	if _, _, err := users.CreateStudentInClass(other); !errors.Is(err, domain.ErrEnrollmentClosed) {
		t.Fatalf("archived class: %v", err)
	}
	if users.Count("") != before {
		t.Fatal("a refused enrollment left an account behind")
	}
}

func TestCreateStudentInClassSameUsernameAtOnce(t *testing.T) {
	db := openTestDB(t)
	users, classes := NewUsers(db), NewClasses(db)
	teacher, _ := users.Create("prof@x.it", "Prof", "", domain.RoleTeacher, "it")
	id, _ := classes.Create("3A", "", teacher, domain.EnrollUsername)
	c, _ := classes.Get(id)
	var wg sync.WaitGroup
	results := make([]error, 8)
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, results[i] = users.CreateStudentInClass(domain.NewClassStudent{Code: c.JoinCode, Username: "luca", Name: "luca", PasswordHash: "h", Locale: "it"})
		}(i)
	}
	wg.Wait()
	ok := 0
	for _, err := range results {
		switch {
		case err == nil:
			ok++
		case !errors.Is(err, domain.ErrUsernameTaken):
			t.Fatalf("unexpected: %v", err)
		}
	}
	if ok != 1 || classes.CountStudents(id) != 1 {
		t.Fatalf("%d accounts created, %d students", ok, classes.CountStudents(id))
	}
}

// A database from before the username classes is refused at start, not
// half used: it must be recreated.
func TestOpenRefusesOldDatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")
	raw, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := raw.Exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
		password_hash TEXT NOT NULL DEFAULT '', role TEXT NOT NULL, locale TEXT NOT NULL DEFAULT 'it', active INTEGER NOT NULL DEFAULT 1,
		created_at TEXT NOT NULL, last_login_at TEXT)`); err != nil {
		t.Fatal(err)
	}
	raw.Close()
	if db, err := Open(path); !errors.Is(err, errOldDatabase) {
		if db != nil {
			db.Close()
		}
		t.Fatalf("old database opened: %v", err)
	}
}
