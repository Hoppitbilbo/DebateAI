package store

import (
	"database/sql"
	"encoding/json"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Assignments is the repository of assignments (assignments table).
type Assignments struct{ db *sql.DB }

func NewAssignments(db *sql.DB) *Assignments { return &Assignments{db: db} }

const assignSelect = `SELECT a.id, a.class_id, c.name, a.title, a.instructions, a.app_type, a.config_json, a.goals_json,
	a.min_turns, a.max_turns, a.auto_end, a.require_reflection, a.allow_live, a.published, a.due_at, a.created_at, a.updated_at
	FROM assignments a JOIN classes c ON c.id = a.class_id`

func scanAssignment(row interface{ Scan(...any) error }) (*domain.Assignment, error) {
	var a domain.Assignment
	var cfg, goals string
	var autoEnd, reqRefl, allowLive, pub int
	var due sql.NullString
	if err := row.Scan(&a.ID, &a.ClassID, &a.ClassName, &a.Title, &a.Instructions, &a.AppType, &cfg, &goals,
		&a.MinTurns, &a.MaxTurns, &autoEnd, &reqRefl, &allowLive, &pub, &due, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return nil, err
	}
	a.Config = json.RawMessage(cfg)
	_ = json.Unmarshal([]byte(goals), &a.Goals)
	if a.Goals == nil {
		a.Goals = []string{}
	}
	a.AutoEnd, a.RequireReflection, a.AllowLive, a.Published = autoEnd == 1, reqRefl == 1, allowLive == 1, pub == 1
	if due.Valid && due.String != "" {
		a.DueAt = &due.String
	}
	return &a, nil
}

func (r *Assignments) list(where string, args ...any) ([]*domain.Assignment, error) {
	rows, err := r.db.Query(assignSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.Assignment{}
	for rows.Next() {
		if a, err := scanAssignment(rows); err == nil {
			out = append(out, a)
		}
	}
	return out, rows.Err()
}

func (r *Assignments) Get(id int64) (*domain.Assignment, error) {
	return scanAssignment(r.db.QueryRow(assignSelect+` WHERE a.id = ?`, id))
}

// ListForClass returns all assignments of a class, newest first.
func (r *Assignments) ListForClass(classID int64) ([]*domain.Assignment, error) {
	return r.list(` WHERE a.class_id = ? ORDER BY a.created_at DESC`, classID)
}

// ListForStudent returns the published assignments of the student's active
// classes: those with a due date first (soonest first), then the newest.
func (r *Assignments) ListForStudent(userID int64) ([]*domain.Assignment, error) {
	return r.list(` WHERE a.published = 1 AND c.archived = 0 AND a.class_id IN (SELECT class_id FROM class_members WHERE user_id = ? AND role = 'student')
		ORDER BY CASE WHEN a.due_at IS NULL THEN 1 ELSE 0 END, a.due_at, a.created_at DESC`, userID)
}

func (r *Assignments) Create(n domain.NewAssignment) (int64, error) {
	goals, _ := json.Marshal(n.Goals)
	var due any
	if n.DueAt != nil && *n.DueAt != "" {
		due = *n.DueAt
	}
	now := domain.Now()
	res, err := r.db.Exec(`INSERT INTO assignments(class_id, title, instructions, app_type, config_json, goals_json, min_turns, max_turns, auto_end, require_reflection, allow_live, published, due_at, created_by, created_at, updated_at)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		n.ClassID, n.Title, n.Instructions, n.AppType, n.Config, string(goals), n.MinTurns, n.MaxTurns,
		boolInt(n.AutoEnd), boolInt(n.RequireReflection), boolInt(n.AllowLive), boolInt(n.Published), due, n.CreatedBy, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// Update applies the non-nil fields of p in one transaction and refreshes updated_at.
func (r *Assignments) Update(id int64, p domain.AssignmentPatch) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := domain.Now()
	set := func(col string, v any) {
		if err == nil {
			_, err = tx.Exec(`UPDATE assignments SET `+col+` = ?, updated_at = ? WHERE id = ?`, v, now, id)
		}
	}
	if p.Title != nil {
		set("title", *p.Title)
	}
	if p.Instructions != nil {
		set("instructions", *p.Instructions)
	}
	if p.AppType != nil {
		set("app_type", *p.AppType)
	}
	if p.Config != nil {
		set("config_json", *p.Config)
	}
	if p.Goals != nil {
		goals, _ := json.Marshal(*p.Goals)
		set("goals_json", string(goals))
	}
	if p.MinTurns != nil {
		set("min_turns", *p.MinTurns)
	}
	if p.MaxTurns != nil {
		set("max_turns", *p.MaxTurns)
	}
	if p.AutoEnd != nil {
		set("auto_end", boolInt(*p.AutoEnd))
	}
	if p.RequireReflection != nil {
		set("require_reflection", boolInt(*p.RequireReflection))
	}
	if p.AllowLive != nil {
		set("allow_live", boolInt(*p.AllowLive))
	}
	if p.Published != nil {
		set("published", boolInt(*p.Published))
	}
	if p.DueAt != nil {
		if *p.DueAt == "" {
			set("due_at", nil)
		} else {
			set("due_at", *p.DueAt)
		}
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Assignments) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM assignments WHERE id = ?`, id)
	return err
}

func (r *Assignments) Count() int { return count(r.db, `SELECT COUNT(*) FROM assignments`) }
