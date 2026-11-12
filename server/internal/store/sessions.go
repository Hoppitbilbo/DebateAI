package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// AuthSessions is the repository of login sessions (auth_sessions table).
// Only the hash of the cookie token is stored.
type AuthSessions struct{ db *sql.DB }

func NewAuthSessions(db *sql.DB) *AuthSessions { return &AuthSessions{db: db} }

func (r *AuthSessions) Create(tokenHash string, userID int64, expiresAt string) error {
	_, err := r.db.Exec(`INSERT INTO auth_sessions(token_hash, user_id, created_at, expires_at) VALUES(?,?,?,?)`,
		tokenHash, userID, domain.Now(), expiresAt)
	return err
}

// UserForSession returns the account of an unexpired session in one query
// (it runs on every authenticated request); sql.ErrNoRows otherwise.
func (r *AuthSessions) UserForSession(tokenHash string) (*domain.User, error) {
	return scanUser(r.db.QueryRow(`SELECT `+userCols("u")+` FROM auth_sessions s JOIN users u ON u.id = s.user_id
		WHERE s.token_hash = ? AND s.expires_at > ?`, tokenHash, domain.Now()))
}

func (r *AuthSessions) Delete(tokenHash string) error {
	_, err := r.db.Exec(`DELETE FROM auth_sessions WHERE token_hash = ?`, tokenHash)
	return err
}

// DeleteForUser logs the user out everywhere.
func (r *AuthSessions) DeleteForUser(userID int64) error {
	_, err := r.db.Exec(`DELETE FROM auth_sessions WHERE user_id = ?`, userID)
	return err
}

func (r *AuthSessions) PurgeExpired() error {
	_, err := r.db.Exec(`DELETE FROM auth_sessions WHERE expires_at < ?`, domain.Now())
	return err
}
