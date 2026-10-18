package store

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ActivitySessions is the repository of activity attempts (activity_sessions table).
type ActivitySessions struct{ db *sql.DB }

func NewActivitySessions(db *sql.DB) *ActivitySessions { return &ActivitySessions{db: db} }

const sessionSummaryCols = `s.id, s.user_id, COALESCE(u.name,''), s.assignment_id, COALESCE(a.title,''), s.app_type, s.title, s.status, s.turns, s.progress,
	s.score_conversation, s.score_reflection, s.cost_usd, s.started_at, s.updated_at, s.completed_at`
const sessionFrom = ` FROM activity_sessions s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN assignments a ON a.id = s.assignment_id`

// bestFirst orders attempts from the most to the least successful.
const bestFirst = `CASE s.status WHEN 'completed' THEN 0 WHEN 'goal_reached' THEN 1 ELSE 2 END, s.progress DESC, s.updated_at DESC`

func scanSummary(row interface{ Scan(...any) error }, extra ...any) (*domain.SessionSummary, error) {
	var ss domain.SessionSummary
	var uid, aid, sc, sr sql.NullInt64
	var comp sql.NullString
	dest := []any{&ss.ID, &uid, &ss.UserName, &aid, &ss.AssignmentTitle, &ss.AppType, &ss.Title, &ss.Status, &ss.Turns, &ss.Progress, &sc, &sr, &ss.CostUSD, &ss.StartedAt, &ss.UpdatedAt, &comp}
	if err := row.Scan(append(dest, extra...)...); err != nil {
		return nil, err
	}
	if uid.Valid {
		ss.UserID = &uid.Int64
	}
	if aid.Valid {
		ss.AssignmentID = &aid.Int64
	}
	ss.ScoreConversation = nullIntPtr(sc)
	ss.ScoreReflection = nullIntPtr(sr)
	if comp.Valid {
		ss.CompletedAt = &comp.String
	}
	return &ss, nil
}

func nullIntPtr(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	v := int(n.Int64)
	return &v
}

func (r *ActivitySessions) Summary(id int64) (*domain.SessionSummary, error) {
	return scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.id = ?`, id))
}

// Detail returns the summary plus the stored transcript, context and judgement.
func (r *ActivitySessions) Detail(id int64) (*domain.SessionDetail, error) {
	var d domain.SessionDetail
	var ctx, tr, jev string
	ss, err := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+`, s.context_json, s.transcript_json, s.jev_json, s.reflection, s.evaluation`+sessionFrom+` WHERE s.id = ?`, id),
		&ctx, &tr, &jev, &d.Reflection, &d.Evaluation)
	if err != nil {
		return nil, err
	}
	d.SessionSummary = *ss
	d.Context, d.Transcript, d.Jev = json.RawMessage(ctx), json.RawMessage(tr), json.RawMessage(jev)
	return &d, nil
}

// Latest returns the most recent attempt of a student on an assignment, or nil.
func (r *ActivitySessions) Latest(userID, assignmentID int64) *domain.SessionSummary {
	ss, _ := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ? ORDER BY s.started_at DESC LIMIT 1`, userID, assignmentID))
	return ss
}

// Best returns the most successful attempt of a student on an assignment, or nil.
func (r *ActivitySessions) Best(userID, assignmentID int64) *domain.SessionSummary {
	ss, _ := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ?
		ORDER BY `+bestFirst+` LIMIT 1`, userID, assignmentID))
	return ss
}

// ListForUser returns a user's attempts, newest first, without empty abandoned ones.
func (r *ActivitySessions) ListForUser(userID int64, limit int) ([]*domain.SessionSummary, error) {
	rows, err := r.db.Query(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND (s.turns > 0 OR s.status != 'abandoned') ORDER BY s.started_at DESC LIMIT ?`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.SessionSummary{}
	for rows.Next() {
		if ss, err := scanSummary(rows); err == nil {
			out = append(out, ss)
		}
	}
	return out, rows.Err()
}

// BestPerStudent returns, for a class, the best attempt of each student on each assignment.
func (r *ActivitySessions) BestPerStudent(classID int64) ([]domain.ProgressCell, error) {
	rows, err := r.db.Query(`SELECT s.assignment_id, s.user_id, s.status, s.progress, s.id, s.score_conversation, s.cost_usd FROM activity_sessions s
		JOIN assignments a ON a.id = s.assignment_id WHERE a.class_id = ? ORDER BY `+bestFirst, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]bool{}
	cells := []domain.ProgressCell{}
	for rows.Next() {
		var c domain.ProgressCell
		var score sql.NullInt64
		if rows.Scan(&c.AssignmentID, &c.UserID, &c.Status, &c.Progress, &c.SessionID, &score, &c.CostUSD) != nil {
			continue
		}
		k := fmt.Sprintf("%d:%d", c.AssignmentID, c.UserID)
		if seen[k] { // rows come best first
			continue
		}
		seen[k] = true
		c.Score = nullIntPtr(score)
		cells = append(cells, c)
	}
	return cells, rows.Err()
}

// Owner returns who started a session and its status.
func (r *ActivitySessions) Owner(id int64) (userID *int64, status string, err error) {
	var owner sql.NullInt64
	if err = r.db.QueryRow(`SELECT user_id, status FROM activity_sessions WHERE id = ?`, id).Scan(&owner, &status); err != nil {
		return nil, "", err
	}
	if owner.Valid {
		userID = &owner.Int64
	}
	return userID, status, nil
}

func (r *ActivitySessions) Create(n domain.NewSession) (int64, error) {
	now := domain.Now()
	res, err := r.db.Exec(`INSERT INTO activity_sessions(user_id, assignment_id, app_type, title, context_json, started_at, updated_at) VALUES(?,?,?,?,?,?,?)`,
		n.UserID, n.AssignmentID, n.AppType, n.Title, n.Context, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// AbandonEmpty closes the student's active attempts on an assignment that
// never got a turn.
func (r *ActivitySessions) AbandonEmpty(userID, assignmentID int64) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET status = 'abandoned', updated_at = ? WHERE user_id = ? AND assignment_id = ? AND status = 'active' AND turns = 0`,
		domain.Now(), userID, assignmentID)
	return err
}

// SaveTranscript stores the conversation and its turn count; context
// replaces the stored activity setup when not nil.
func (r *ActivitySessions) SaveTranscript(id int64, transcriptJSON string, turns int, context *string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`UPDATE activity_sessions SET transcript_json = ?, turns = ?, updated_at = ? WHERE id = ?`, transcriptJSON, turns, domain.Now(), id); err != nil {
		return err
	}
	if context != nil {
		if _, err := tx.Exec(`UPDATE activity_sessions SET context_json = ? WHERE id = ?`, *context, id); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// SaveJudgement stores the judge's verdict and the resulting progress.
func (r *ActivitySessions) SaveJudgement(id int64, judgementJSON string, progress int) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET jev_json = ?, progress = ? WHERE id = ?`, judgementJSON, progress, id)
	return err
}

func (r *ActivitySessions) SetStatus(id int64, status string) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET status = ?, updated_at = ? WHERE id = ?`, status, domain.Now(), id)
	return err
}

// Complete marks the attempt completed with the student's reflection and evaluation.
func (r *ActivitySessions) Complete(id int64, c domain.SessionCompletion) error {
	now := domain.Now()
	_, err := r.db.Exec(`UPDATE activity_sessions SET status = 'completed', reflection = ?, evaluation = ?, score_conversation = ?, score_reflection = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
		c.Reflection, c.Evaluation, c.ScoreConversation, c.ScoreReflection, now, now, id)
	return err
}

// AddCost adds the cost of an AI call to the session total.
func (r *ActivitySessions) AddCost(id int64, usd float64) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET cost_usd = cost_usd + ? WHERE id = ?`, usd, id)
	return err
}

// CountWithTurns counts the attempts where the student wrote at least once.
func (r *ActivitySessions) CountWithTurns() int {
	return count(r.db, `SELECT COUNT(*) FROM activity_sessions WHERE turns > 0`)
}

// CountStarted counts the students who started an assignment.
func (r *ActivitySessions) CountStarted(assignmentID int64) int {
	return count(r.db, `SELECT COUNT(DISTINCT user_id) FROM activity_sessions WHERE assignment_id = ?`, assignmentID)
}

// CountFinished counts the students who completed an assignment or reached its goals.
func (r *ActivitySessions) CountFinished(assignmentID int64) int {
	return count(r.db, `SELECT COUNT(DISTINCT user_id) FROM activity_sessions WHERE assignment_id = ? AND status IN ('completed','goal_reached')`, assignmentID)
}

// CountAttempts counts a student's attempts on an assignment.
func (r *ActivitySessions) CountAttempts(userID, assignmentID int64) int {
	return count(r.db, `SELECT COUNT(*) FROM activity_sessions WHERE user_id = ? AND assignment_id = ?`, userID, assignmentID)
}
