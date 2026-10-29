package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Replies is the register of the AI lines the server produced for each
// attempt (ai_replies table): a saved transcript is checked against it, so a
// conversation that never happened cannot be handed in for a grade.
type Replies struct{ db *sql.DB }

func NewReplies(db *sql.DB) *Replies { return &Replies{db: db} }

// Record notes a reply sent to the student of a session.
func (r *Replies) Record(sessionID int64, text string) error {
	_, err := r.db.Exec(`INSERT INTO ai_replies(session_id, text, created_at) VALUES(?,?,?)`, sessionID, text, domain.Now())
	return err
}

// ForSession returns the replies produced for a session, oldest first.
func (r *Replies) ForSession(sessionID int64) ([]string, error) {
	rows, err := r.db.Query(`SELECT text FROM ai_replies WHERE session_id = ? ORDER BY id`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
