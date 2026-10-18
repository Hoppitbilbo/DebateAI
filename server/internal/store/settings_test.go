package store

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "t.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestSettingsRoundTrip(t *testing.T) {
	st := NewSettings(openTestDB(t))
	type doc struct{ A, B int }
	out := doc{A: 9}
	if st.Load("x", &out) || out.A != 9 {
		t.Fatal("missing key must report false and keep dst")
	}
	if err := st.Save("x", doc{A: 1, B: 2}); err != nil {
		t.Fatal(err)
	}
	if err := st.Save("x", doc{A: 3, B: 4}); err != nil {
		t.Fatal(err)
	}
	if !st.Load("x", &out) || out != (doc{3, 4}) {
		t.Fatalf("got %+v", out)
	}
}

func TestSettingsInvalidJSON(t *testing.T) {
	db := openTestDB(t)
	if _, err := db.Exec(`INSERT INTO settings VALUES('x', 'not json')`); err != nil {
		t.Fatal(err)
	}
	var v map[string]int
	if NewSettings(db).Load("x", &v) {
		t.Fatal("invalid JSON must report false")
	}
}
