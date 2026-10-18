package store

import (
	"database/sql"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Invites is the repository of one-time links (invites table).
type Invites struct{ db *sql.DB }

func NewInvites(db *sql.DB) *Invites { return &Invites{db: db} }

const inviteSelect = `SELECT i.id, i.kind, i.email, i.role, i.class_id, COALESCE(c.name,''), COALESCE(u.name,''), i.locale, i.created_at, i.expires_at, i.accepted_at, i.email_sent
	FROM invites i LEFT JOIN classes c ON c.id = i.class_id LEFT JOIN users u ON u.id = i.invited_by `

func scanInvite(row interface{ Scan(...any) error }) (*domain.Invite, error) {
	var inv domain.Invite
	var cid sql.NullInt64
	var acc sql.NullString
	var sent int
	if err := row.Scan(&inv.ID, &inv.Kind, &inv.Email, &inv.Role, &cid, &inv.ClassName, &inv.InvitedBy, &inv.Locale, &inv.CreatedAt, &inv.ExpiresAt, &acc, &sent); err != nil {
		return nil, err
	}
	if cid.Valid {
		inv.ClassID = &cid.Int64
	}
	if acc.Valid {
		inv.AcceptedAt = &acc.String
	}
	inv.EmailSent = sent == 1
	return &inv, nil
}

func (r *Invites) list(where string, args ...any) []domain.Invite {
	out := []domain.Invite{}
	rows, err := r.db.Query(inviteSelect+where, args...)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		if inv, err := scanInvite(rows); err == nil {
			out = append(out, *inv)
		}
	}
	return out
}

// ListAll returns the newest invitations (not reset links).
func (r *Invites) ListAll(limit int) []domain.Invite {
	return r.list(`WHERE i.kind = 'invite' ORDER BY i.created_at DESC LIMIT ?`, limit)
}

// ListByInviter returns the newest invitations sent by a user.
func (r *Invites) ListByInviter(userID int64, limit int) []domain.Invite {
	return r.list(`WHERE i.kind = 'invite' AND i.invited_by = ? ORDER BY i.created_at DESC LIMIT ?`, userID, limit)
}

// ListPendingForClass returns the class invitations not accepted yet.
func (r *Invites) ListPendingForClass(classID int64) []domain.Invite {
	return r.list(`WHERE i.kind = 'invite' AND i.class_id = ? AND i.accepted_at IS NULL`, classID)
}

// Get returns an invitation by id (not reset links).
func (r *Invites) Get(id int64) (*domain.Invite, error) {
	return scanInvite(r.db.QueryRow(inviteSelect+`WHERE i.id = ? AND i.kind = 'invite'`, id))
}

// FindByToken returns the invite of a kind with this token hash, used or not.
func (r *Invites) FindByToken(tokenHash, kind string) (*domain.Invite, error) {
	return scanInvite(r.db.QueryRow(inviteSelect+`WHERE i.token_hash = ? AND i.kind = ?`, tokenHash, kind))
}

func (r *Invites) Create(n domain.NewInvite) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO invites(token_hash, kind, email, role, class_id, invited_by, locale, created_at, expires_at) VALUES(?,?,?,?,?,?,?,?,?)`,
		n.TokenHash, n.Kind, n.Email, n.Role, n.ClassID, n.InvitedBy, n.Locale, domain.Now(), n.ExpiresAt)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (r *Invites) MarkAccepted(id int64) error {
	_, err := r.db.Exec(`UPDATE invites SET accepted_at = ? WHERE id = ?`, domain.Now(), id)
	return err
}

func (r *Invites) MarkSent(id int64) error {
	_, err := r.db.Exec(`UPDATE invites SET email_sent = 1 WHERE id = ?`, id)
	return err
}

func (r *Invites) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM invites WHERE id = ?`, id)
	return err
}

// CountPending counts invitations neither accepted nor expired.
func (r *Invites) CountPending() int {
	var n int
	_ = r.db.QueryRow(`SELECT COUNT(*) FROM invites WHERE kind='invite' AND accepted_at IS NULL AND expires_at > ?`, domain.Now()).Scan(&n)
	return n
}
