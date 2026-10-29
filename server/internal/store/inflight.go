package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// budgetScope is the scope of the rows that reserve part of the monthly
// budget for a paid call in flight.
const budgetScope = "budget"

// Inflight is the repository of the AI calls in progress (ai_inflight
// table): one row per generation slot of a user, room or network, and one
// per budget reservation of a paid call. Each check-and-insert is a single
// statement, so concurrent requests, also from other instances sharing the
// database, cannot all pass the same limit. Rows expire, so a crashed
// process does not hold a slot or a reservation forever.
type Inflight struct{ db *sql.DB }

func NewInflight(db *sql.DB) *Inflight { return &Inflight{db: db} }

// Acquire takes one of the limit slots of scope until expiresAt. It
// returns ok=false when all of them are taken.
func (r *Inflight) Acquire(scope string, limit int, expiresAt string) (id int64, ok bool, err error) {
	now := domain.Now()
	if _, err := r.db.Exec(`DELETE FROM ai_inflight WHERE expires_at < ?`, now); err != nil {
		return 0, false, err
	}
	return r.insertIf(`INSERT INTO ai_inflight(scope, cost_usd, expires_at)
		SELECT ?, 0, ? WHERE (SELECT COUNT(*) FROM ai_inflight WHERE scope = ? AND expires_at >= ?) < ?`,
		scope, expiresAt, scope, now, limit)
}

// ReserveBudget sets aside cost until expiresAt, if the spending since
// monthStart plus the reservations in flight plus cost stays within budget.
func (r *Inflight) ReserveBudget(cost, budget float64, monthStart, expiresAt string) (id int64, ok bool, err error) {
	return r.insertIf(`INSERT INTO ai_inflight(scope, cost_usd, expires_at)
		SELECT ?, ?, ? WHERE COALESCE((SELECT SUM(cost_usd) FROM usage_log WHERE created_at >= ?), 0)
			+ COALESCE((SELECT SUM(cost_usd) FROM ai_inflight WHERE scope = ? AND expires_at >= ?), 0) + ? <= ?`,
		budgetScope, cost, expiresAt, monthStart, budgetScope, domain.Now(), cost, budget)
}

// Reserved sums the budget reservations in flight.
func (r *Inflight) Reserved() (float64, error) {
	var v sql.NullFloat64
	err := r.db.QueryRow(`SELECT SUM(cost_usd) FROM ai_inflight WHERE scope = ? AND expires_at >= ?`, budgetScope, domain.Now()).Scan(&v)
	return v.Float64, err
}

// Release frees a slot or a reservation.
func (r *Inflight) Release(id int64) error {
	_, err := r.db.Exec(`DELETE FROM ai_inflight WHERE id = ?`, id)
	return err
}

func (r *Inflight) insertIf(query string, args ...any) (int64, bool, error) {
	res, err := r.db.Exec(query, args...)
	if ok, err := affected(res, err); err != nil || !ok {
		return 0, false, err
	}
	id, err := res.LastInsertId()
	return id, err == nil, err
}
