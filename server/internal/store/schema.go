package store

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/tursodatabase/libsql-client-go/libsql"
	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  locale TEXT NOT NULL DEFAULT 'it',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'invite',
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  locale TEXT NOT NULL DEFAULT 'it',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  email_sent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  join_code TEXT NOT NULL UNIQUE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS class_members (
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (class_id, user_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  app_type TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  goals_json TEXT NOT NULL DEFAULT '[]',
  min_turns INTEGER NOT NULL DEFAULT 0,
  max_turns INTEGER NOT NULL DEFAULT 0,
  auto_end INTEGER NOT NULL DEFAULT 1,
  require_reflection INTEGER NOT NULL DEFAULT 1,
  allow_live INTEGER NOT NULL DEFAULT 1,
  due_at TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  app_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  context_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  turns INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  jev_json TEXT NOT NULL DEFAULT '{}',
  reflection TEXT NOT NULL DEFAULT '',
  evaluation TEXT NOT NULL DEFAULT '',
  score_conversation INTEGER,
  score_reflection INTEGER,
  teacher_feedback TEXT NOT NULL DEFAULT '',
  teacher_score INTEGER,
  teacher_feedback_at TEXT,
  cost_usd REAL NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  judged_revision INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON activity_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_assignment ON activity_sessions(assignment_id);

CREATE TABLE IF NOT EXISTS live_grants (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES activity_sessions(id) ON DELETE SET NULL,
  provider_id INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  base_url TEXT NOT NULL DEFAULT '',
  api_key_enc TEXT NOT NULL DEFAULT '',
  models_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_prices (
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  input_per_m REAL NOT NULL DEFAULT 0,
  output_per_m REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, model)
);

CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  user_id INTEGER,
  session_id INTEGER,
  provider_id INTEGER,
  provider_name TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL DEFAULT '',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  estimated INTEGER NOT NULL DEFAULT 0,
  unpriced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_log(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_log(user_id);

CREATE TABLE IF NOT EXISTS ai_inflight (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  cost_usd REAL NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inflight_scope ON ai_inflight(scope, expires_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  host_token_hash TEXT NOT NULL UNIQUE,
  teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  own_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  instructions TEXT NOT NULL DEFAULT '',
  app_type TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  max_guests INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rooms_expires ON rooms(expires_at);

CREATE TABLE IF NOT EXISTS room_guests (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL COLLATE NOCASE,
  avatar TEXT NOT NULL,
  rejoin_pin_hash TEXT NOT NULL DEFAULT '',
  rejoin_expires_at TEXT,
  UNIQUE (room_id, nickname)
);
CREATE INDEX IF NOT EXISTS idx_room_guests_room ON room_guests(room_id);
`

// Open opens the SQLite database at path and applies the schema.
func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", "file:"+path+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	// SQLite allows one writer: a single connection avoids SQLITE_BUSY storms.
	db.SetMaxOpenConns(1)
	return prepare(db)
}

// OpenRemote opens a libSQL database over the network (Turso: a libsql://
// URL and its auth token; a local sqld: an http:// URL and no token) and
// applies the schema. It is the same SQL as Open, for hosts without a
// persistent disk such as Vercel.
func OpenRemote(url, authToken string) (*sql.DB, error) {
	var opts []libsql.Option
	if authToken != "" {
		opts = append(opts, libsql.WithAuthToken(authToken))
	}
	connector, err := libsql.NewConnector(url, opts...)
	if err != nil {
		return nil, err
	}
	return prepare(sql.OpenDB(connector))
}

// prepare applies the schema and the migrations to a freshly opened database.
func prepare(db *sql.DB) (*sql.DB, error) {
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	if err := applyMigrations(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// migrations add columns to databases created by older versions; schema
// above already has them for new databases. Append only, never edit.
var migrations = []string{
	`ALTER TABLE activity_sessions ADD COLUMN teacher_feedback TEXT NOT NULL DEFAULT ''`,
	`ALTER TABLE activity_sessions ADD COLUMN teacher_score INTEGER`,
	`ALTER TABLE activity_sessions ADD COLUMN teacher_feedback_at TEXT`,
	`ALTER TABLE rooms ADD COLUMN own_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL`,
	`ALTER TABLE activity_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE activity_sessions ADD COLUMN judged_revision INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE usage_log ADD COLUMN estimated INTEGER NOT NULL DEFAULT 0`,
	`ALTER TABLE usage_log ADD COLUMN unpriced INTEGER NOT NULL DEFAULT 0`,
}

func applyMigrations(db *sql.DB) error {
	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil && !strings.Contains(err.Error(), "duplicate column") {
			return fmt.Errorf("migrate %q: %w", m, err)
		}
	}
	return nil
}
