package store

import (
	"database/sql"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// AuthRateLimits is the repository of the login and enrollment counters
// (auth_rate_limits table): one row per key and window. Each hit is a single
// conditional upsert, so concurrent requests, also from other instances
// sharing the database, cannot all pass the same limit. Keys are opaque:
// the caller hashes them.
type AuthRateLimits struct{ db *sql.DB }

func NewAuthRateLimits(db *sql.DB) *AuthRateLimits { return &AuthRateLimits{db: db} }

// Hit counts one attempt for key and reports whether it is within limit
// attempts per window. An expired window starts again from this attempt.
func (r *AuthRateLimits) Hit(key string, limit int, window time.Duration) (bool, error) {
	now := domain.Now()
	if _, err := r.db.Exec(`DELETE FROM auth_rate_limits WHERE expires_at < ?`, now); err != nil {
		return false, err
	}
	expires := time.Now().Add(window).UTC().Format(time.RFC3339)
	res, err := r.db.Exec(`INSERT INTO auth_rate_limits(key, count, expires_at) VALUES(?, 1, ?)
		ON CONFLICT(key) DO UPDATE SET
			count = CASE WHEN expires_at < ? THEN 1 ELSE count + 1 END,
			expires_at = CASE WHEN expires_at < ? THEN excluded.expires_at ELSE expires_at END
		WHERE expires_at < ? OR count < ?`,
		key, expires, now, now, now, limit)
	return affected(res, err)
}

// Refund gives back one attempt counted by Hit, for an attempt that turned
// out right: callers that count only failures hit first (so parallel
// requests cannot all pass the check) and refund on success.
func (r *AuthRateLimits) Refund(key string) error {
	_, err := r.db.Exec(`UPDATE auth_rate_limits SET count = count - 1 WHERE key = ? AND count > 0`, key)
	return err
}
