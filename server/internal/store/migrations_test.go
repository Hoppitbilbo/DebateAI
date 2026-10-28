package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	_ "modernc.org/sqlite"
)

// A database created by an older version gets the new columns on Open.
func TestOpenMigratesOldDatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "old.db")
	old, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`CREATE TABLE activity_sessions (id INTEGER PRIMARY KEY, user_id INTEGER, assignment_id INTEGER, app_type TEXT NOT NULL,
		title TEXT NOT NULL DEFAULT '', context_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', transcript_json TEXT NOT NULL DEFAULT '[]',
		turns INTEGER NOT NULL DEFAULT 0, progress INTEGER NOT NULL DEFAULT 0, jev_json TEXT NOT NULL DEFAULT '{}', reflection TEXT NOT NULL DEFAULT '',
		evaluation TEXT NOT NULL DEFAULT '', score_conversation INTEGER, score_reflection INTEGER, cost_usd REAL NOT NULL DEFAULT 0,
		started_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT)`); err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`INSERT INTO activity_sessions(id, app_type, started_at, updated_at) VALUES(1, 'wiki-chatbot', '', '')`); err != nil {
		t.Fatal(err)
	}
	old.Close()

	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	r := NewActivitySessions(db)
	score := 9
	if err := r.SetTeacherFeedback(1, domain.TeacherFeedback{Text: "Bravo", Score: &score}); err != nil {
		t.Fatal(err)
	}
	d, err := r.Detail(1)
	if err != nil || d.TeacherFeedback != "Bravo" || *d.TeacherScore != 9 || d.TeacherFeedbackAt == nil {
		t.Fatalf("after migration: %v %+v", err, d)
	}
	// Opening again must not fail on the already added columns.
	db.Close()
	if db, err = Open(path); err != nil {
		t.Fatal(err)
	}
}

// The rooms table of the first release gets the column of its own class.
func TestOpenMigratesFirstRoomsTable(t *testing.T) {
	path := filepath.Join(t.TempDir(), "rooms.db")
	old, err := sql.Open("sqlite", "file:"+path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := old.Exec(`CREATE TABLE rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, host_token_hash TEXT NOT NULL UNIQUE,
		teacher_id INTEGER, assignment_id INTEGER, title TEXT NOT NULL DEFAULT '', instructions TEXT NOT NULL DEFAULT '', app_type TEXT NOT NULL,
		locked INTEGER NOT NULL DEFAULT 0, max_guests INTEGER NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`); err != nil {
		t.Fatal(err)
	}
	old.Close()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`SELECT own_class_id FROM rooms`); err != nil {
		t.Fatalf("own_class_id missing: %v", err)
	}
}
