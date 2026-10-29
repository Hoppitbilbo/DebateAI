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
	s.score_conversation, s.score_reflection, s.teacher_score, s.cost_usd, s.started_at, s.updated_at, s.completed_at, s.unverified_lines`
const sessionJoins = ` LEFT JOIN users u ON u.id = s.user_id LEFT JOIN assignments a ON a.id = s.assignment_id`
const sessionFrom = ` FROM activity_sessions s` + sessionJoins

// newestFirst orders attempts from the latest started; the id breaks ties
// within the same second.
const newestFirst = `s.started_at DESC, s.id DESC`

// bestFirst orders attempts from the most to the least successful.
const bestFirst = `CASE s.status WHEN 'completed' THEN 0 WHEN 'goal_reached' THEN 1 ELSE 2 END, s.progress DESC, s.updated_at DESC`

func scanSummary(row interface{ Scan(...any) error }, extra ...any) (*domain.SessionSummary, error) {
	var ss domain.SessionSummary
	var uid, aid, sc, sr, ts sql.NullInt64
	var comp sql.NullString
	dest := []any{&ss.ID, &uid, &ss.UserName, &aid, &ss.AssignmentTitle, &ss.AppType, &ss.Title, &ss.Status, &ss.Turns, &ss.Progress, &sc, &sr, &ts, &ss.CostUSD, &ss.StartedAt, &ss.UpdatedAt, &comp, &ss.UnverifiedLines}
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
	ss.TeacherScore = nullIntPtr(ts)
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
	var feedbackAt sql.NullString
	ss, err := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+`, s.context_json, s.transcript_json, s.jev_json, s.reflection, s.evaluation, s.teacher_feedback, s.teacher_feedback_at, s.revision`+sessionFrom+` WHERE s.id = ?`, id),
		&ctx, &tr, &jev, &d.Reflection, &d.Evaluation, &d.TeacherFeedback, &feedbackAt, &d.Revision)
	if err != nil {
		return nil, err
	}
	if feedbackAt.Valid {
		d.TeacherFeedbackAt = &feedbackAt.String
	}
	d.SessionSummary = *ss
	d.Context, d.Transcript, d.Jev = json.RawMessage(ctx), json.RawMessage(tr), json.RawMessage(jev)
	return &d, nil
}

// Latest returns the most recent attempt of a student on an assignment, or nil.
func (r *ActivitySessions) Latest(userID, assignmentID int64) *domain.SessionSummary {
	ss, _ := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ? ORDER BY `+newestFirst+` LIMIT 1`, userID, assignmentID))
	return ss
}

// Best returns the most successful attempt of a student on an assignment, or nil.
func (r *ActivitySessions) Best(userID, assignmentID int64) *domain.SessionSummary {
	ss, _ := scanSummary(r.db.QueryRow(`SELECT `+sessionSummaryCols+sessionFrom+` WHERE s.user_id = ? AND s.assignment_id = ?
		ORDER BY `+bestFirst+` LIMIT 1`, userID, assignmentID))
	return ss
}

// rankedSessions selects the first attempt of each partition in the given
// order, with the partition size, from the attempts matching where (one
// query instead of one per student or assignment).
func (r *ActivitySessions) rankedSessions(partition, order, where string, args ...any) (*sql.Rows, error) {
	return r.db.Query(`WITH ranked AS (SELECT s.id, ROW_NUMBER() OVER (PARTITION BY `+partition+` ORDER BY `+order+`) AS rn,
		COUNT(*) OVER (PARTITION BY `+partition+`) AS n FROM activity_sessions s WHERE `+where+`)
		SELECT `+sessionSummaryCols+`, ranked.n FROM ranked JOIN activity_sessions s ON s.id = ranked.id`+sessionJoins+` WHERE ranked.rn = 1`, args...)
}

// BestPerUser returns, for an assignment, each student's best attempt and
// number of attempts, by user id.
func (r *ActivitySessions) BestPerUser(assignmentID int64) (map[int64]domain.BestAttempt, error) {
	rows, err := r.rankedSessions(`s.user_id`, bestFirst, `s.assignment_id = ? AND s.user_id IS NOT NULL`, assignmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]domain.BestAttempt{}
	for rows.Next() {
		var n int
		if ss, err := scanSummary(rows, &n); err == nil && ss.UserID != nil {
			out[*ss.UserID] = domain.BestAttempt{Session: ss, Attempts: n}
		}
	}
	return out, rows.Err()
}

// LatestPerAssignment returns a user's most recent attempt on each
// assignment, by assignment id.
func (r *ActivitySessions) LatestPerAssignment(userID int64) (map[int64]*domain.SessionSummary, error) {
	rows, err := r.rankedSessions(`s.assignment_id`, newestFirst, `s.user_id = ? AND s.assignment_id IS NOT NULL`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]*domain.SessionSummary{}
	for rows.Next() {
		var n int
		if ss, err := scanSummary(rows, &n); err == nil && ss.AssignmentID != nil {
			out[*ss.AssignmentID] = ss
		}
	}
	return out, rows.Err()
}

// StatsForClass counts, for each assignment of a class, the students who
// started it and those who completed it or reached its goals.
func (r *ActivitySessions) StatsForClass(classID int64) (map[int64]domain.AssignStats, error) {
	rows, err := r.db.Query(`SELECT s.assignment_id, COUNT(DISTINCT s.user_id),
		COUNT(DISTINCT CASE WHEN s.status IN ('completed','goal_reached') THEN s.user_id END)
		FROM activity_sessions s JOIN assignments a ON a.id = s.assignment_id WHERE a.class_id = ? GROUP BY s.assignment_id`, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]domain.AssignStats{}
	for rows.Next() {
		var id int64
		var st domain.AssignStats
		if err := rows.Scan(&id, &st.Started, &st.Completed); err != nil {
			return nil, err
		}
		out[id] = st
	}
	return out, rows.Err()
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
	rows, err := r.db.Query(`SELECT s.assignment_id, s.user_id, s.status, s.progress, s.id, s.score_conversation, s.teacher_score, s.cost_usd FROM activity_sessions s
		JOIN assignments a ON a.id = s.assignment_id WHERE a.class_id = ? ORDER BY `+bestFirst, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	seen := map[string]bool{}
	cells := []domain.ProgressCell{}
	for rows.Next() {
		var c domain.ProgressCell
		var score, teacherScore sql.NullInt64
		if rows.Scan(&c.AssignmentID, &c.UserID, &c.Status, &c.Progress, &c.SessionID, &score, &teacherScore, &c.CostUSD) != nil {
			continue
		}
		k := fmt.Sprintf("%d:%d", c.AssignmentID, c.UserID)
		if seen[k] { // rows come best first
			continue
		}
		seen[k] = true
		c.Score = nullIntPtr(score)
		c.TeacherScore = nullIntPtr(teacherScore)
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

// SaveTranscript stores a new revision of the conversation and returns its
// number. A completed attempt is not rewritten (domain.ErrSessionCompleted);
// with s.BaseRevision set, a save that lost a race is refused
// (domain.ErrStaleRevision).
func (r *ActivitySessions) SaveTranscript(id int64, s domain.TranscriptSave) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var status string
	var revision int64
	if err := tx.QueryRow(`SELECT status, revision FROM activity_sessions WHERE id = ?`, id).Scan(&status, &revision); err != nil {
		return 0, err
	}
	switch {
	case status == domain.SessionCompleted:
		return revision, domain.ErrSessionCompleted
	case s.BaseRevision != nil && *s.BaseRevision != revision:
		return revision, domain.ErrStaleRevision
	}
	// The revision in WHERE keeps the write conditional on remote databases,
	// where the read above does not lock the row.
	res, err := tx.Exec(`UPDATE activity_sessions SET transcript_json = ?, turns = ?, unverified_lines = ?, updated_at = ?, revision = revision + 1, context_json = COALESCE(?, context_json)
		WHERE id = ? AND revision = ? AND status != ?`, s.JSON, s.Turns, s.Unverified, domain.Now(), s.Context, id, revision, domain.SessionCompleted)
	if err != nil {
		return 0, err
	}
	if n, err := res.RowsAffected(); err != nil {
		return 0, err
	} else if n == 0 {
		return revision, domain.ErrStaleRevision
	}
	return revision + 1, tx.Commit()
}

// SaveJudgement stores the judge's verdict on a transcript revision and the
// resulting progress, unless a verdict on a newer revision is already there
// (judges can finish out of order). It reports whether it was stored.
func (r *ActivitySessions) SaveJudgement(id int64, judgementJSON string, progress int, revision int64) (bool, error) {
	res, err := r.db.Exec(`UPDATE activity_sessions SET jev_json = ?, progress = ?, judged_revision = ? WHERE id = ? AND judged_revision < ?`,
		judgementJSON, progress, revision, id, revision)
	return affected(res, err)
}

// SetStatus moves the attempt from status from to status to, and reports
// whether it did: a request that loaded an older status changes nothing.
func (r *ActivitySessions) SetStatus(id int64, from, to string) (bool, error) {
	res, err := r.db.Exec(`UPDATE activity_sessions SET status = ?, updated_at = ? WHERE id = ? AND status = ?`, to, domain.Now(), id, from)
	return affected(res, err)
}

func affected(res sql.Result, err error) (bool, error) {
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n > 0, err
}

// Complete marks the attempt completed with the student's reflection and evaluation.
// It happens once: a completed attempt gets domain.ErrSessionCompleted.
func (r *ActivitySessions) Complete(id int64, c domain.SessionCompletion) error {
	now := domain.Now()
	res, err := r.db.Exec(`UPDATE activity_sessions SET status = 'completed', reflection = ?, evaluation = ?, score_conversation = ?, score_reflection = ?, completed_at = ?, updated_at = ?
		WHERE id = ? AND status != 'completed'`, c.Reflection, c.Evaluation, c.ScoreConversation, c.ScoreReflection, now, now, id)
	if ok, err := affected(res, err); err != nil {
		return err
	} else if !ok {
		return domain.ErrSessionCompleted
	}
	return nil
}

// SetTeacherFeedback stores (or replaces) the teacher's feedback on an attempt.
func (r *ActivitySessions) SetTeacherFeedback(id int64, f domain.TeacherFeedback) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET teacher_feedback = ?, teacher_score = ?, teacher_feedback_at = ? WHERE id = ?`,
		f.Text, f.Score, domain.Now(), id)
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

// Import stores a finished copy of an attempt (from a room export) for a
// student; its timestamps and scores are kept as they were.
func (r *ActivitySessions) Import(userID int64, assignmentID *int64, d domain.SessionDetail) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO activity_sessions(user_id, assignment_id, app_type, title, context_json, status, transcript_json, turns, progress, jev_json,
		reflection, evaluation, score_conversation, score_reflection, cost_usd, started_at, updated_at, completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		userID, assignmentID, d.AppType, d.Title, jsonOr(d.Context, "{}"), d.Status, jsonOr(d.Transcript, "[]"), d.Turns, d.Progress, jsonOr(d.Jev, "{}"),
		d.Reflection, d.Evaluation, d.ScoreConversation, d.ScoreReflection, d.CostUSD, d.StartedAt, d.UpdatedAt, d.CompletedAt)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// jsonOr returns raw as text, or def when it is empty.
func jsonOr(raw json.RawMessage, def string) string {
	if len(raw) == 0 {
		return def
	}
	return string(raw)
}
