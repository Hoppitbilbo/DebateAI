package store

import (
	"context"
	"database/sql"
	"fmt"
)

// usersTable is the current shape of users. An account has an e-mail, a
// username or both; recovery_class_id is the class whose owner may reset
// the password of an account without e-mail.
const usersTable = `CREATE TABLE %s (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE COLLATE NOCASE,
  username TEXT UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  locale TEXT NOT NULL DEFAULT 'it',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  recovery_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  CHECK (email IS NOT NULL OR username IS NOT NULL)
)`

// oldUserCols are the columns every older users table has.
const oldUserCols = `id, email, name, password_hash, role, locale, active, created_at, last_login_at`

// makeEmailOptional rebuilds a users table created before usernames, whose
// email is NOT NULL: SQLite cannot drop a constraint in place. It is the
// documented rebuild (new table, copy, drop, rename) in one transaction,
// with foreign keys off on this connection, so dropping users neither
// cascades nor breaks the references of the other tables. IDs, hashes and
// the AUTOINCREMENT counter are kept. Concurrent starts are safe: the first
// write takes the lock, and the check is repeated under it.
func makeEmailOptional(db *sql.DB) error {
	ctx := context.Background()
	if old, err := emailRequired(db); err != nil || !old {
		return err
	}
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	var fk int
	if err := conn.QueryRowContext(ctx, `PRAGMA foreign_keys`).Scan(&fk); err != nil {
		return err
	}
	if fk == 1 {
		if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = OFF`); err != nil {
			return err
		}
		defer conn.ExecContext(ctx, `PRAGMA foreign_keys = ON`)
	}
	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(fmt.Sprintf(usersTable, "users_new")); err != nil {
		return fmt.Errorf("migrate users: %w", err)
	}
	if old, err := emailRequired(tx); err != nil || !old {
		return err // another instance has just done it; the rollback drops users_new
	}
	before, err := foreignKeyProblems(tx)
	if err != nil {
		return err
	}
	var seq sql.NullInt64
	if err := tx.QueryRow(`SELECT seq FROM sqlite_sequence WHERE name = 'users'`).Scan(&seq); err != nil && err != sql.ErrNoRows {
		return err
	}
	steps := []string{
		`INSERT INTO users_new(` + oldUserCols + `) SELECT ` + oldUserCols + ` FROM users`,
		`DROP TABLE users`,
		`ALTER TABLE users_new RENAME TO users`,
	}
	for _, s := range steps {
		if _, err := tx.Exec(s); err != nil {
			return fmt.Errorf("migrate users %q: %w", s, err)
		}
	}
	if seq.Valid {
		if _, err := tx.Exec(`UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'users'`, seq.Int64); err != nil {
			return err
		}
	}
	after, err := foreignKeyProblems(tx)
	if err != nil {
		return err
	}
	if after > before {
		return fmt.Errorf("migrate users: %d broken references after the rebuild (were %d)", after, before)
	}
	return tx.Commit()
}

type queryRower interface {
	QueryRow(query string, args ...any) *sql.Row
}

// emailRequired reports whether users still has the old NOT NULL email.
func emailRequired(q queryRower) (bool, error) {
	var notNull int
	err := q.QueryRow(`SELECT "notnull" FROM pragma_table_info('users') WHERE name = 'email'`).Scan(&notNull)
	return notNull == 1, err
}

// foreignKeyProblems counts the rows whose references are broken. Databases
// without enforced foreign keys may have some already: the rebuild must not
// add any.
func foreignKeyProblems(tx *sql.Tx) (int, error) {
	rows, err := tx.Query(`PRAGMA foreign_key_check`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	n := 0
	for rows.Next() {
		n++
	}
	return n, rows.Err()
}
