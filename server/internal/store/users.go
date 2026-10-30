package store

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Users is the repository of accounts (users table).
type Users struct{ db *sql.DB }

func NewUsers(db *sql.DB) *Users { return &Users{db: db} }

// userCols lists the columns scanUser reads, of the users table named or
// aliased t. Accounts may lack an e-mail or a username: both read as "".
func userCols(t string) string {
	return t + `.id, COALESCE(` + t + `.email, ''), COALESCE(` + t + `.username, ''), ` +
		t + `.name, ` + t + `.role, ` + t + `.locale, ` + t + `.active, ` + t + `.created_at, ` + t + `.last_login_at, ` + t + `.recovery_class_id, ` + userRoomCol(t)
}

// userRoomCol selects the room of a guest account (NULL for real accounts);
// table is the name or alias of the users table in the query.
func userRoomCol(table string) string {
	return `(SELECT g.room_id FROM room_guests g WHERE g.user_id = ` + table + `.id)`
}

// userSelect is the column list scanUser reads.
var userSelect = userCols("users")

// notGuest filters room guests out of the account lists.
const notGuest = ` AND id NOT IN (SELECT user_id FROM room_guests)`

func scanUser(row interface{ Scan(...any) error }) (*domain.User, error) {
	var u domain.User
	var active int
	var last sql.NullString
	var recovery, room sql.NullInt64
	if err := row.Scan(&u.ID, &u.Email, &u.Username, &u.Name, &u.Role, &u.Locale, &active, &u.CreatedAt, &last, &recovery, &room); err != nil {
		return nil, err
	}
	u.Active = active == 1
	if last.Valid {
		u.LastLoginAt = &last.String
	}
	if recovery.Valid {
		u.RecoveryClassID = &recovery.Int64
	}
	if room.Valid {
		u.RoomID = &room.Int64
	}
	return &u, nil
}

func (r *Users) Get(id int64) (*domain.User, error) {
	return scanUser(r.db.QueryRow(`SELECT `+userSelect+` FROM users WHERE id = ?`, id))
}

// GetByEmail finds an account by e-mail; "" never matches an account
// without e-mail.
func (r *Users) GetByEmail(email string) (*domain.User, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return nil, sql.ErrNoRows
	}
	return scanUser(r.db.QueryRow(`SELECT `+userSelect+` FROM users WHERE email = ?`, email))
}

// GetByUsername finds an account by its normalized username.
func (r *Users) GetByUsername(username string) (*domain.User, error) {
	if username == "" {
		return nil, sql.ErrNoRows
	}
	return scanUser(r.db.QueryRow(`SELECT `+userSelect+` FROM users WHERE username = ?`, username))
}

// Search lists users whose name, e-mail or username contains q, newest first;
// role filters when not empty. Room guests are not listed.
func (r *Users) Search(q, role string, limit int) ([]domain.User, error) {
	like := "%" + q + "%"
	query := `SELECT ` + userSelect + ` FROM users WHERE (name LIKE ? OR email LIKE ? OR username LIKE ?)` + notGuest
	args := []any{like, like, like}
	if role != "" {
		query += ` AND role = ?`
		args = append(args, role)
	}
	rows, err := r.db.Query(query+` ORDER BY created_at DESC LIMIT ?`, append(args, limit)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.User{}
	for rows.Next() {
		if u, err := scanUser(rows); err == nil {
			out = append(out, *u)
		}
	}
	return out, rows.Err()
}

// Create inserts an account; passwordHash may be empty (invite pending).
func (r *Users) Create(email, name, passwordHash, role, locale string) (int64, error) {
	res, err := r.db.Exec(`INSERT INTO users(email, name, password_hash, role, locale, created_at) VALUES(?,?,?,?,?,?)`,
		email, name, passwordHash, role, locale, domain.Now())
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return 0, domain.ErrEmailTaken
		}
		return 0, err
	}
	return res.LastInsertId()
}

// CreateStudentInClass creates the account and its student membership in
// one transaction, checking under it that the code still opens an active
// username class: a regenerated code or an archived class never leaves an
// account without its class. The class becomes the recovery class.
func (r *Users) CreateStudentInClass(n domain.NewClassStudent) (userID, classID int64, err error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()
	err = tx.QueryRow(`SELECT id FROM classes WHERE join_code = ? AND enrollment_mode = ? AND archived = 0`, n.Code, domain.EnrollUsername).Scan(&classID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, domain.ErrEnrollmentClosed
	}
	if err != nil {
		return 0, 0, err
	}
	now := domain.Now()
	res, err := tx.Exec(`INSERT INTO users(username, name, password_hash, role, locale, created_at, recovery_class_id) VALUES(?,?,?,?,?,?,?)`,
		n.Username, n.Name, n.PasswordHash, domain.RoleStudent, n.Locale, now, classID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return 0, 0, domain.ErrUsernameTaken
		}
		return 0, 0, err
	}
	if userID, err = res.LastInsertId(); err != nil {
		return 0, 0, err
	}
	if _, err := tx.Exec(`INSERT INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, classID, userID, domain.RoleStudent, now); err != nil {
		return 0, 0, err
	}
	return userID, classID, tx.Commit()
}

// Update applies the non-nil fields of p in one transaction.
func (r *Users) Update(id int64, p domain.UserPatch) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := applyUserPatch(tx, id, p); err != nil {
		return err
	}
	return tx.Commit()
}

// applyUserPatch writes the non-nil fields of p inside tx.
func applyUserPatch(tx *sql.Tx, id int64, p domain.UserPatch) (err error) {
	set := func(col string, v any) {
		if err == nil {
			_, err = tx.Exec(`UPDATE users SET `+col+` = ? WHERE id = ?`, v, id)
		}
	}
	if p.Name != nil {
		set("name", *p.Name)
	}
	if p.Role != nil {
		set("role", *p.Role)
	}
	if p.Active != nil {
		set("active", boolInt(*p.Active))
	}
	if p.Locale != nil {
		set("locale", *p.Locale)
	}
	return err
}

// Delete removes an account. Its reset links, and those it issued, go
// too, also on connections without foreign keys: an assisted link must
// never outlive its issuer and read as an e-mail reset.
func (r *Users) Delete(id int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM password_resets WHERE user_id = ? OR issued_by = ?`, id, id); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM users WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Users) PasswordHash(id int64) (string, error) {
	var hash string
	err := r.db.QueryRow(`SELECT password_hash FROM users WHERE id = ?`, id).Scan(&hash)
	return hash, err
}

func (r *Users) SetPasswordHash(id int64, hash string) error {
	_, err := r.db.Exec(`UPDATE users SET password_hash = ? WHERE id = ?`, hash, id)
	return err
}

// ChangePassword applies a profile patch and a new password hash in one
// transaction, then ends every login of the account and invalidates its
// reset links: nothing is written when any step fails.
func (r *Users) ChangePassword(id int64, p domain.UserPatch, hash string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := applyUserPatch(tx, id, p); err != nil {
		return err
	}
	if err := setPasswordRevokingAccess(tx, id, hash); err != nil {
		return err
	}
	return tx.Commit()
}

// setPasswordRevokingAccess stores the new hash, invalidates the pending
// reset links and deletes the logins of the account, inside tx.
func setPasswordRevokingAccess(tx *sql.Tx, userID int64, hash string) error {
	now := domain.Now()
	for _, q := range []struct {
		sql  string
		args []any
	}{
		{`UPDATE users SET password_hash = ? WHERE id = ?`, []any{hash, userID}},
		{`UPDATE password_resets SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL`, []any{now, userID}},
		{`DELETE FROM auth_sessions WHERE user_id = ?`, []any{userID}},
	} {
		if _, err := tx.Exec(q.sql, q.args...); err != nil {
			return err
		}
	}
	return nil
}

func (r *Users) RecordLogin(id int64) error {
	_, err := r.db.Exec(`UPDATE users SET last_login_at = ? WHERE id = ?`, domain.Now(), id)
	return err
}

// Count returns the number of users with role, or of all users when role
// is empty; room guests are not counted.
func (r *Users) Count(role string) int {
	if role == "" {
		return count(r.db, `SELECT COUNT(*) FROM users WHERE 1 = 1`+notGuest)
	}
	return count(r.db, `SELECT COUNT(*) FROM users WHERE role = ?`+notGuest, role)
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// count runs a COUNT query; errors count as 0.
func count(db *sql.DB, query string, args ...any) int {
	n, _ := countErr(db, query, args...)
	return n
}

// countErr is count for the checks that enforce a limit: there a failed
// read must not look like zero.
func countErr(db *sql.DB, query string, args ...any) (int, error) {
	var n int
	err := db.QueryRow(query, args...).Scan(&n)
	return n, err
}

// groupedInts runs a query of (id, count) rows into a map.
func groupedInts(db *sql.DB, query string, args ...any) (map[int64]int, error) {
	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]int{}
	for rows.Next() {
		var id int64
		var n int
		if err := rows.Scan(&id, &n); err != nil {
			return nil, err
		}
		out[id] = n
	}
	return out, rows.Err()
}
