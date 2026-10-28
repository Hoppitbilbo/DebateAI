package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Usage is the repository of the AI usage log (usage_log table).
type Usage struct{ db *sql.DB }

func NewUsage(db *sql.DB) *Usage { return &Usage{db: db} }

func (r *Usage) Insert(u domain.UsageRecord) error {
	_, err := r.db.Exec(`INSERT INTO usage_log(created_at, user_id, session_id, provider_id, provider_name, model, task, input_tokens, output_tokens, cost_usd, ok, latency_ms, error)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, domain.Now(), u.UserID, u.SessionID, u.ProviderID, u.Provider, u.Model, u.Task,
		u.InputTokens, u.OutputTokens, u.CostUSD, boolInt(u.OK), u.LatencyMs, u.Error)
	return err
}

// SpendSince sums the cost of all calls since a timestamp.
func (r *Usage) SpendSince(since string) float64 {
	var v sql.NullFloat64
	_ = r.db.QueryRow(`SELECT SUM(cost_usd) FROM usage_log WHERE created_at >= ?`, since).Scan(&v)
	return v.Float64
}

// UserSpendSince sums the cost of a user's calls since a timestamp.
func (r *Usage) UserSpendSince(userID int64, since string) float64 {
	var v sql.NullFloat64
	_ = r.db.QueryRow(`SELECT SUM(cost_usd) FROM usage_log WHERE user_id = ? AND created_at >= ?`, userID, since).Scan(&v)
	return v.Float64
}

// CountSince counts the calls since a timestamp, only failed ones when onlyErrors.
func (r *Usage) CountSince(since string, onlyErrors bool) int {
	if onlyErrors {
		return count(r.db, `SELECT COUNT(*) FROM usage_log WHERE created_at >= ? AND ok = 0`, since)
	}
	return count(r.db, `SELECT COUNT(*) FROM usage_log WHERE created_at >= ?`, since)
}

// CountUserRequestsSince counts a user's calls since a timestamp, except
// those of excludedTask (e.g. the judge, which the student does not trigger).
func (r *Usage) CountUserRequestsSince(userID int64, since, excludedTask string) int {
	return count(r.db, `SELECT COUNT(*) FROM usage_log WHERE user_id = ? AND created_at >= ? AND task != ?`, userID, since, excludedTask)
}

// usageGroups maps each grouping to its key and label expressions.
var usageGroups = map[domain.UsageGrouping]struct{ key, label string }{
	domain.UsageByDay:      {`substr(created_at, 1, 10)`, `''`},
	domain.UsageByModel:    {`provider_name || ' / ' || model`, `MAX(model)`},
	domain.UsageByTask:     {`task`, `''`},
	domain.UsageByProvider: {`provider_name`, `''`},
	domain.UsageByUser:     {`CAST(COALESCE(user_id, 0) AS TEXT)`, `(SELECT COALESCE(name, 'guest') FROM users WHERE id = l.user_id)`},
	domain.UsageByClass: {`CAST(COALESCE((SELECT a.class_id FROM activity_sessions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = l.session_id), 0) AS TEXT)`,
		`(SELECT c.name FROM activity_sessions s JOIN assignments a ON a.id = s.assignment_id JOIN classes c ON c.id = a.class_id WHERE s.id = l.session_id)`},
}

// Aggregate sums the calls since a timestamp per group: days in date order,
// the other groupings by cost, most expensive first.
func (r *Usage) Aggregate(since string, by domain.UsageGrouping, limit int) []domain.UsageAggregate {
	g := usageGroups[by]
	order := `SUM(cost_usd) DESC, COUNT(*) DESC`
	if by == domain.UsageByDay {
		order = `1`
	}
	out := []domain.UsageAggregate{}
	rows, err := r.db.Query(`SELECT `+g.key+`, `+g.label+`, COUNT(*), SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END), SUM(input_tokens), SUM(output_tokens), SUM(cost_usd)
		FROM usage_log l WHERE created_at >= ? GROUP BY 1 ORDER BY `+order+` LIMIT ?`, since, limit)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var a domain.UsageAggregate
		var key, lbl sql.NullString
		if rows.Scan(&key, &lbl, &a.Requests, &a.Errors, &a.InputTokens, &a.OutputTokens, &a.CostUSD) == nil {
			a.Key, a.Label = key.String, lbl.String
			out = append(out, a)
		}
	}
	return out
}

// Recent returns the latest calls, newest first.
func (r *Usage) Recent(limit int) ([]domain.UsageLogRow, error) {
	rows, err := r.db.Query(`SELECT l.id, l.created_at, COALESCE(u.name,''), l.session_id, l.provider_name, l.model, l.task, l.input_tokens, l.output_tokens, l.cost_usd, l.ok, l.latency_ms, l.error
		FROM usage_log l LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.UsageLogRow{}
	for rows.Next() {
		var x domain.UsageLogRow
		var sid sql.NullInt64
		var ok int
		if rows.Scan(&x.ID, &x.CreatedAt, &x.User, &sid, &x.Provider, &x.Model, &x.Task, &x.InputTokens, &x.OutputTokens, &x.CostUSD, &ok, &x.LatencyMs, &x.Error) == nil {
			if sid.Valid {
				x.SessionID = &sid.Int64
			}
			x.OK = ok == 1
			out = append(out, x)
		}
	}
	return out, rows.Err()
}

// CountRoomRequestsSince counts the calls of a room's guests since a
// timestamp, except those of excludedTask.
func (r *Usage) CountRoomRequestsSince(roomID int64, since, excludedTask string) int {
	return count(r.db, `SELECT COUNT(*) FROM usage_log WHERE user_id IN (SELECT user_id FROM room_guests WHERE room_id = ?) AND created_at >= ? AND task != ?`, roomID, since, excludedTask)
}
