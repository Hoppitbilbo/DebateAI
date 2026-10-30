package store

import (
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// oldUsersTable is users as created before usernames.
const oldUsersTable = `CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  locale TEXT NOT NULL DEFAULT 'it',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
)`

// oldDatabase writes a database with the old users table and data in every
// table that references users, with foreign keys on as Open has them.
func oldDatabase(t *testing.T) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "old.db")
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	fillOldDatabase(t, db)
	return path
}

// fillOldDatabase creates the old schema and its data in an empty database.
func fillOldDatabase(t *testing.T, db *sql.DB) {
	t.Helper()
	rest := strings.SplitN(schema, ";", 2)[1]
	steps := []string{oldUsersTable, rest,
		`INSERT INTO users(id, email, name, password_hash, role, created_at) VALUES
			(1, 'prof@x.it', 'Prof', 'hash-prof', 'teacher', 't'), (2, 'Sara@x.it', 'Sara', 'hash-sara', 'student', 't'),
			(3, 'guest-1@room.invalid', 'Guest', '', 'student', 't'), (4, 'gone@x.it', 'Gone', '', 'student', 't')`,
		`DELETE FROM users WHERE id = 4`, // the next id must stay 5, as before
		`INSERT INTO auth_sessions(token_hash, user_id, created_at, expires_at) VALUES('tok', 2, 't', '9999')`,
		`INSERT INTO classes(id, name, join_code, owner_id, created_at) VALUES(1, '3A', 'ABCDEF', 1, 't')`,
		`INSERT INTO class_members(class_id, user_id, role, joined_at) VALUES(1, 1, 'teacher', 't'), (1, 2, 'student', 't')`,
		`INSERT INTO invites(token_hash, kind, email, role, class_id, invited_by, created_at, expires_at) VALUES('inv', 'invite', 'n@x.it', 'student', 1, 1, 't', '9999')`,
		`INSERT INTO activity_sessions(user_id, app_type, started_at, updated_at) VALUES(2, 'wiki-chatbot', 't', 't')`,
		`INSERT INTO rooms(id, host_token_hash, teacher_id, app_type, code, max_guests, expires_at, created_at) VALUES(1, 'h', 1, 'wiki-chatbot', 'ROOM01', 30, '9999', 't')`,
		`INSERT INTO room_guests(user_id, room_id, nickname, avatar) VALUES(3, 1, 'Guest', 'a')`,
	}
	for _, s := range steps {
		if _, err := db.Exec(s); err != nil {
			t.Fatalf("%s: %v", s, err)
		}
	}
}

func TestOpenMakesEmailOptionalKeepingEverything(t *testing.T) {
	path := oldDatabase(t)
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	checkMigratedUsers(t, db)
	db.Close()

	// Opening again finds nothing to do.
	if db, err = Open(path); err != nil {
		t.Fatal(err)
	}
	db.Close()
}

// Several instances starting together (Vercel) rebuild users only once.
func TestConcurrentRebuildsRunOnce(t *testing.T) {
	path := oldDatabase(t)
	var wg sync.WaitGroup
	errs := make([]error, 4)
	for i := range errs {
		db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
		if err != nil {
			t.Fatal(err)
		}
		db.SetMaxOpenConns(1)
		defer db.Close()
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			errs[i] = makeEmailOptional(db)
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if n := count(db, `SELECT COUNT(*) FROM users`); n != 3 {
		t.Fatalf("users after concurrent starts: %d", n)
	}
	if n := count(db, `SELECT COUNT(*) FROM sqlite_master WHERE name = 'users_new'`); n != 0 {
		t.Fatal("a concurrent start left users_new behind")
	}
}

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

// checkMigratedUsers verifies a database migrated from oldDatabase.
func checkMigratedUsers(t *testing.T, db *sql.DB) {
	t.Helper()
	if old, err := emailRequired(db); err != nil || old {
		t.Fatalf("email still required: %v", err)
	}
	for table, want := range map[string]int{"users": 3, "auth_sessions": 1, "class_members": 2, "invites": 1, "activity_sessions": 1, "room_guests": 1} {
		if n := count(db, `SELECT COUNT(*) FROM `+table); n != want {
			t.Errorf("%s: %d rows, want %d", table, n, want)
		}
	}
	users := NewUsers(db)
	sara, err := users.GetByEmail("sara@x.it")
	if err != nil || sara.ID != 2 || sara.Username != "" {
		t.Fatalf("e-mail login after migration: %v %+v", err, sara)
	}
	if h, _ := users.PasswordHash(2); h != "hash-sara" {
		t.Fatalf("hash lost: %q", h)
	}
	if guest, err := users.Get(3); err != nil || guest.RoomID == nil {
		t.Fatalf("guest lost its room: %v %+v", err, guest)
	}
	rows, err := db.Query(`PRAGMA foreign_key_check`)
	if err != nil {
		t.Fatal(err)
	}
	if rows.Next() {
		t.Error("broken references after the rebuild")
	}
	rows.Close()
	var fk int
	if err := db.QueryRow(`PRAGMA foreign_keys`).Scan(&fk); err != nil || fk != 1 {
		t.Fatalf("foreign keys must be on again: %d %v", fk, err)
	}

	// Cascades still point at the new users table.
	if err := users.Delete(2); err != nil {
		t.Fatal(err)
	}
	if n := count(db, `SELECT COUNT(*) FROM auth_sessions`) + count(db, `SELECT COUNT(*) FROM class_members WHERE user_id = 2`); n != 0 {
		t.Fatalf("delete no longer cascades: %d rows left", n)
	}
	id, err := users.Create("new@x.it", "New", "", domain.RoleStudent, "it")
	if err != nil || id != 5 {
		t.Fatalf("ids must not be reused: %d %v", id, err)
	}
}
