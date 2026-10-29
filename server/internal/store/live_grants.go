package store

import (
	"database/sql"
	"errors"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ErrGrantUsed: the grant is unknown, expired or its usage was already reported.
var ErrGrantUsed = errors.New("unknown or already reported live session")

// LiveGrants is the repository of the voice conversations the server
// allowed (live_grants table).
type LiveGrants struct{ db *sql.DB }

func NewLiveGrants(db *sql.DB) *LiveGrants { return &LiveGrants{db: db} }

// Create stores a grant and drops the expired ones.
func (r *LiveGrants) Create(g domain.LiveGrant) error {
	if _, err := r.db.Exec(`DELETE FROM live_grants WHERE expires_at < ?`, domain.Now()); err != nil {
		return err
	}
	_, err := r.db.Exec(`INSERT INTO live_grants(id, user_id, session_id, provider_id, model, created_at, expires_at) VALUES(?,?,?,?,?,?,?)`,
		g.ID, g.UserID, g.SessionID, g.ProviderID, g.Model, g.CreatedAt, g.ExpiresAt)
	return err
}

// Consume marks a grant as reported and returns it, once: a second report,
// or one after expiry, gets ErrGrantUsed.
func (r *LiveGrants) Consume(id string) (*domain.LiveGrant, error) {
	res, err := r.db.Exec(`UPDATE live_grants SET used_at = ? WHERE id = ? AND used_at IS NULL AND expires_at >= ?`, domain.Now(), id, domain.Now())
	if ok, err := affected(res, err); err != nil {
		return nil, err
	} else if !ok {
		return nil, ErrGrantUsed
	}
	var g domain.LiveGrant
	var uid, sid sql.NullInt64
	if err := r.db.QueryRow(`SELECT id, user_id, session_id, provider_id, model, created_at, expires_at FROM live_grants WHERE id = ?`, id).
		Scan(&g.ID, &uid, &sid, &g.ProviderID, &g.Model, &g.CreatedAt, &g.ExpiresAt); err != nil {
		return nil, err
	}
	if uid.Valid {
		g.UserID = &uid.Int64
	}
	if sid.Valid {
		g.SessionID = &sid.Int64
	}
	return &g, nil
}

// UsedBySession tells whether a voice conversation was granted for a session.
func (r *LiveGrants) UsedBySession(sessionID int64) (bool, error) {
	n, err := countErr(r.db, `SELECT COUNT(*) FROM live_grants WHERE session_id = ?`, sessionID)
	return n > 0, err
}
