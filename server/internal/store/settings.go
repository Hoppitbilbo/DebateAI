// Package store holds the SQLite repositories: the only code that writes SQL.
// The application depends on small interfaces it defines itself; these
// types implement them.
package store

import (
	"database/sql"
	"encoding/json"
)

// Settings keeps JSON documents by key in the settings table.
type Settings struct{ db *sql.DB }

func NewSettings(db *sql.DB) *Settings { return &Settings{db: db} }

// Load decodes the value stored under key into dst. It reports false, leaving
// dst untouched, when the key is missing or the stored JSON is invalid.
func (s *Settings) Load(key string, dst any) bool {
	var raw string
	if err := s.db.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&raw); err != nil {
		return false
	}
	return json.Unmarshal([]byte(raw), dst) == nil
}

// Save stores v as JSON under key, replacing any previous value.
func (s *Settings) Save(key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, string(b))
	return err
}
