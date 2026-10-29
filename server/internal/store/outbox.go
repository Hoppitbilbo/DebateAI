package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Outbox is the repository of the e-mails waiting to be sent (mail_outbox
// table). A mail is due while next_at is set and past; it is sent when
// sent_at is set, and given up when both are empty.
type Outbox struct{ db *sql.DB }

func NewOutbox(db *sql.DB) *Outbox { return &Outbox{db: db} }

// Enqueue stores a mail, due at once.
func (r *Outbox) Enqueue(to, subject, body string) error {
	now := domain.Now()
	_, err := r.db.Exec(`INSERT INTO mail_outbox(to_addr, subject, body, created_at, next_at) VALUES(?,?,?,?,?)`, to, subject, body, now, now)
	return err
}

// Claim takes up to limit due mails, oldest first, moving their next_at to
// leaseUntil: if the process stops while sending, they are due again then.
// A row is claimed only if nobody else claimed it meanwhile.
func (r *Outbox) Claim(limit int, leaseUntil string) ([]domain.OutboxMail, error) {
	now := domain.Now()
	rows, err := r.db.Query(`SELECT id, to_addr, subject, body, attempts, next_at FROM mail_outbox
		WHERE next_at IS NOT NULL AND next_at <= ? AND sent_at IS NULL ORDER BY id LIMIT ?`, now, limit)
	if err != nil {
		return nil, err
	}
	type due struct {
		m      domain.OutboxMail
		nextAt string
	}
	var found []due
	for rows.Next() {
		var d due
		if err := rows.Scan(&d.m.ID, &d.m.To, &d.m.Subject, &d.m.Body, &d.m.Attempts, &d.nextAt); err != nil {
			rows.Close()
			return nil, err
		}
		found = append(found, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}
	out := []domain.OutboxMail{}
	for _, d := range found {
		res, err := r.db.Exec(`UPDATE mail_outbox SET next_at = ? WHERE id = ? AND next_at = ? AND sent_at IS NULL`, leaseUntil, d.m.ID, d.nextAt)
		if ok, err := affected(res, err); err != nil {
			return out, err
		} else if ok {
			out = append(out, d.m)
		}
	}
	return out, nil
}

// MarkSent records a delivered mail.
func (r *Outbox) MarkSent(id int64) error {
	_, err := r.db.Exec(`UPDATE mail_outbox SET sent_at = ?, next_at = NULL, last_error = '' WHERE id = ?`, domain.Now(), id)
	return err
}

// MarkFailed records a failed attempt; retryAt nil gives the mail up.
func (r *Outbox) MarkFailed(id int64, attempts int, errText string, retryAt *string) error {
	_, err := r.db.Exec(`UPDATE mail_outbox SET attempts = ?, last_error = ?, next_at = ? WHERE id = ?`, attempts, errText, retryAt, id)
	return err
}

// CountPending counts the mails not sent yet and not given up.
func (r *Outbox) CountPending() (int, error) {
	return countErr(r.db, `SELECT COUNT(*) FROM mail_outbox WHERE sent_at IS NULL AND next_at IS NOT NULL`)
}
