package store

import (
	"database/sql"
	"errors"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// resettableStudent holds when the account s may get an assisted reset
// from class c: an active student without e-mail, not a room guest, still
// a student of its recovery class c, which is active.
const resettableStudent = `s.active = 1 AND s.role = 'student' AND COALESCE(s.email, '') = '' AND s.recovery_class_id = c.id AND c.archived = 0
	AND NOT EXISTS (SELECT 1 FROM room_guests g WHERE g.user_id = s.id)
	AND EXISTS (SELECT 1 FROM class_members m WHERE m.class_id = c.id AND m.user_id = s.id AND m.role = 'student')`

// resetIssuer holds when the account i may issue that link: an active
// admin, or the active teacher who owns class c (co-teachers may not).
const resetIssuer = `i.active = 1 AND (i.role = 'admin' OR (i.role = 'teacher' AND c.owner_id = i.id))`

// resetStillAllowed is checked when a link is used: the account is active
// and, for an assisted link, student, class and issuer still qualify.
const resetStillAllowed = `EXISTS (SELECT 1 FROM users s WHERE s.id = password_resets.user_id AND s.active = 1 AND (
		(password_resets.issued_by IS NULL AND password_resets.class_id IS NULL)
		OR EXISTS (SELECT 1 FROM classes c, users i WHERE c.id = password_resets.class_id AND i.id = password_resets.issued_by
			AND ` + resettableStudent + ` AND ` + resetIssuer + `)))`

// PasswordResets is the repository of password reset links
// (password_resets table). Only the hash of a token is stored; a link is
// used at most once.
type PasswordResets struct{ db *sql.DB }

func NewPasswordResets(db *sql.DB) *PasswordResets { return &PasswordResets{db: db} }

// Issue stores a new link and invalidates the previous ones of the same
// account, in one transaction. An assisted link (IssuedBy and ClassID set)
// is stored only if the rules above hold at this moment; otherwise, or for
// a missing or disabled account, it returns domain.ErrResetNotAllowed and
// nothing changes.
func (r *PasswordResets) Issue(n domain.NewPasswordReset) error {
	if (n.IssuedBy == nil) != (n.ClassID == nil) {
		return errors.New("an assisted reset needs both issuer and class")
	}
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := domain.Now()
	if _, err := tx.Exec(`DELETE FROM password_resets WHERE expires_at <= ?`, now); err != nil {
		return err
	}
	if err := invalidateResets(tx, n.UserID, now); err != nil {
		return err
	}
	var res sql.Result
	if n.IssuedBy == nil {
		res, err = tx.Exec(`INSERT INTO password_resets(token_hash, user_id, created_at, expires_at)
			SELECT ?, id, ?, ? FROM users WHERE id = ? AND active = 1`, n.TokenHash, now, n.ExpiresAt, n.UserID)
	} else {
		res, err = tx.Exec(`INSERT INTO password_resets(token_hash, user_id, created_at, expires_at, issued_by, class_id)
			SELECT ?, s.id, ?, ?, i.id, c.id FROM users s, classes c, users i
			WHERE s.id = ? AND c.id = ? AND i.id = ? AND `+resettableStudent+` AND `+resetIssuer,
			n.TokenHash, now, n.ExpiresAt, n.UserID, *n.ClassID, *n.IssuedBy)
	}
	if err != nil {
		return err
	}
	if inserted, err := res.RowsAffected(); err != nil || inserted == 0 {
		return errors.Join(err, domain.ErrResetNotAllowed)
	}
	return tx.Commit()
}

// Consume uses a link once: in one transaction it marks the link used
// (only if unused, unexpired and still allowed), stores the new password
// hash, invalidates the other links of the account and ends all its logins.
// Of two concurrent calls with the same token one fails with
// domain.ErrResetLinkInvalid.
func (r *PasswordResets) Consume(tokenHash, passwordHash string) (userID int64, err error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	now := domain.Now()
	res, err := tx.Exec(`UPDATE password_resets SET consumed_at = ?
		WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND `+resetStillAllowed, now, tokenHash, now)
	if err != nil {
		return 0, err
	}
	if used, err := res.RowsAffected(); err != nil || used != 1 {
		return 0, errors.Join(err, domain.ErrResetLinkInvalid)
	}
	if err := tx.QueryRow(`SELECT user_id FROM password_resets WHERE token_hash = ?`, tokenHash).Scan(&userID); err != nil {
		return 0, err
	}
	if err := setPasswordRevokingAccess(tx, userID, passwordHash); err != nil {
		return 0, err
	}
	return userID, tx.Commit()
}

// Invalidate makes every pending link of the account unusable.
func (r *PasswordResets) Invalidate(userID int64) error {
	_, err := r.db.Exec(`UPDATE password_resets SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`, domain.Now(), userID)
	return err
}

func invalidateResets(tx *sql.Tx, userID int64, now string) error {
	_, err := tx.Exec(`UPDATE password_resets SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`, now, userID)
	return err
}

// Resettable returns the members of the class that may get an assisted
// reset from it (the student side of the rules; the issuer is checked
// separately), by user id.
func (r *PasswordResets) Resettable(classID int64) (map[int64]bool, error) {
	rows, err := r.db.Query(`SELECT s.id FROM class_members m JOIN users s ON s.id = m.user_id JOIN classes c ON c.id = m.class_id
		WHERE m.class_id = ? AND `+resettableStudent, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]bool{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out[id] = true
	}
	return out, rows.Err()
}
