package store

import (
	"path/filepath"
	"testing"
)

// Investigation 11/11, E2: an instance that finds the schema already
// applied (same version) skips it after one read; a different version runs
// it again.
func TestSchemaRunsOnlyWhenItChanged(t *testing.T) {
	path := filepath.Join(t.TempDir(), "t.db")
	hasIndex := func() bool {
		db, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		return count(db, `SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_rooms_expires'`) == 1
	}
	exec := func(q string) {
		db, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		if _, err := db.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	if !hasIndex() {
		t.Fatal("a new database gets the schema")
	}
	exec(`DROP INDEX idx_rooms_expires`)
	if hasIndex() {
		t.Fatal("same version: the schema is not run again")
	}
	exec(`UPDATE settings SET value = 'older' WHERE key = '` + schemaVersionKey + `'`)
	if !hasIndex() {
		t.Fatal("another version: the schema runs again")
	}
}
