package store

import (
	"database/sql"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Users is the repository of accounts (users table).
type Users struct{ db *sql.DB }

func NewUsers(db *sql.DB) *Users { return &Users{db: db} }

const userCols = `id, email, name, role, locale, active, created_at, last_login_at`

func scanUser(row interface{ Scan(...any) error }) (*domain.User, error) {
	var u domain.User
	var active int
	var last sql.NullString
	if err := row.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Locale, &active, &u.CreatedAt, &last); err != nil {
		return nil, err
	}
	u.Active = active == 1
	if last.Valid {
		u.LastLoginAt = &last.String
	}
	return &u, nil
}

func (r *Users) Get(id int64) (*domain.User, error) {
	return scanUser(r.db.QueryRow(`SELECT `+userCols+` FROM users WHERE id = ?`, id))
}

func (r *Users) GetByEmail(email string) (*domain.User, error) {
	return scanUser(r.db.QueryRow(`SELECT `+userCols+` FROM users WHERE email = ?`, strings.TrimSpace(email)))
}

// Search lists users whose name or e-mail contains q, newest first;
// role filters when not empty.
func (r *Users) Search(q, role string, limit int) ([]domain.User, error) {
	like := "%" + q + "%"
	query := `SELECT ` + userCols + ` FROM users WHERE (name LIKE ? OR email LIKE ?)`
	args := []any{like, like}
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

// Update applies the non-nil fields of p in one transaction.
func (r *Users) Update(id int64, p domain.UserPatch) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
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
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Users) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM users WHERE id = ?`, id)
	return err
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

func (r *Users) RecordLogin(id int64) error {
	_, err := r.db.Exec(`UPDATE users SET last_login_at = ? WHERE id = ?`, domain.Now(), id)
	return err
}

// Count returns the number of users with role, or of all users when role is empty.
func (r *Users) Count(role string) int {
	var n int
	if role == "" {
		_ = r.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n)
	} else {
		_ = r.db.QueryRow(`SELECT COUNT(*) FROM users WHERE role = ?`, role).Scan(&n)
	}
	return n
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
