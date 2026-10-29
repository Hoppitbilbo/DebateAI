package store

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Classes is the repository of classes and their members (classes and
// class_members tables).
type Classes struct{ db *sql.DB }

func NewClasses(db *sql.DB) *Classes { return &Classes{db: db} }

const classSelect = `SELECT c.id, c.name, c.description, c.join_code, c.owner_id, COALESCE(u.name,''), c.archived, c.created_at,
	(SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id AND m.role = 'student'),
	(SELECT COUNT(*) FROM class_members m WHERE m.class_id = c.id AND m.role = 'teacher'),
	(SELECT COUNT(*) FROM assignments a WHERE a.class_id = c.id)
	FROM classes c LEFT JOIN users u ON u.id = c.owner_id`

func scanClass(row interface{ Scan(...any) error }) (*domain.Class, error) {
	var c domain.Class
	var owner sql.NullInt64
	var archived int
	if err := row.Scan(&c.ID, &c.Name, &c.Description, &c.JoinCode, &owner, &c.OwnerName, &archived, &c.CreatedAt, &c.StudentCount, &c.TeacherCount, &c.Assignments); err != nil {
		return nil, err
	}
	if owner.Valid {
		c.OwnerID = &owner.Int64
	}
	c.Archived = archived == 1
	return &c, nil
}

func (r *Classes) list(where string, args ...any) ([]*domain.Class, error) {
	rows, err := r.db.Query(classSelect+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.Class{}
	for rows.Next() {
		if c, err := scanClass(rows); err == nil {
			out = append(out, c)
		}
	}
	return out, rows.Err()
}

func (r *Classes) Get(id int64) (*domain.Class, error) {
	return scanClass(r.db.QueryRow(classSelect+` WHERE c.id = ?`, id))
}

// Name returns the class name, or "" when the class does not exist.
func (r *Classes) Name(id int64) string {
	var name string
	_ = r.db.QueryRow(`SELECT name FROM classes WHERE id = ?`, id).Scan(&name)
	return name
}

// notRoomClass hides the classes rooms create for their own assignment.
const notRoomClass = ` c.id NOT IN (SELECT own_class_id FROM rooms WHERE own_class_id IS NOT NULL)`

// ListAll returns every class, active ones first.
func (r *Classes) ListAll() ([]*domain.Class, error) {
	return r.list(` WHERE` + notRoomClass + ` ORDER BY c.archived, c.created_at DESC`)
}

// ListTaughtBy returns the classes a user owns or co-teaches.
func (r *Classes) ListTaughtBy(userID int64) ([]*domain.Class, error) {
	return r.list(` WHERE (c.owner_id = ? OR c.id IN (SELECT class_id FROM class_members WHERE user_id = ? AND role = 'teacher')) AND`+notRoomClass+
		` ORDER BY c.archived, c.created_at DESC`, userID, userID)
}

// ListJoinedBy returns the active classes a user belongs to, by name.
func (r *Classes) ListJoinedBy(userID int64) ([]*domain.Class, error) {
	return r.list(` WHERE c.id IN (SELECT class_id FROM class_members WHERE user_id = ?) AND c.archived = 0 ORDER BY c.name`, userID)
}

// FindByJoinCode returns the active class with this code.
func (r *Classes) FindByJoinCode(code string) (*domain.Class, error) {
	return scanClass(r.db.QueryRow(classSelect+` WHERE c.join_code = ? AND c.archived = 0`, code))
}

// errNoJoinCode means no free join code was found after several attempts.
var errNoJoinCode = errors.New("could not create class")

// Create inserts a class with a fresh join code and adds the owner as teacher.
func (r *Classes) Create(name, description string, ownerID int64) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	id, err := insertClass(tx, name, description, &ownerID, false)
	if err != nil {
		return 0, err
	}
	if _, err := tx.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, id, ownerID, domain.RoleTeacher, domain.Now()); err != nil {
		return 0, err
	}
	return id, tx.Commit()
}

// insertClass stores a class with a fresh join code (they are unique).
func insertClass(db execer, name, description string, ownerID *int64, archived bool) (int64, error) {
	for attempt := 0; attempt < 5; attempt++ {
		res, err := db.Exec(`INSERT INTO classes(name, description, join_code, owner_id, archived, created_at) VALUES(?,?,?,?,?,?)`,
			name, description, domain.NewJoinCode(), ownerID, boolInt(archived), domain.Now())
		if err == nil {
			return res.LastInsertId()
		}
		if !strings.Contains(err.Error(), "UNIQUE") {
			return 0, err
		}
	}
	return 0, errNoJoinCode
}

// Update applies the non-nil fields of p in one transaction.
func (r *Classes) Update(id int64, p domain.ClassPatch) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	set := func(col string, v any) {
		if err == nil {
			_, err = tx.Exec(`UPDATE classes SET `+col+` = ? WHERE id = ?`, v, id)
		}
	}
	if p.Name != nil {
		set("name", *p.Name)
	}
	if p.Description != nil {
		set("description", *p.Description)
	}
	if p.Archived != nil {
		set("archived", boolInt(*p.Archived))
	}
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Classes) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM classes WHERE id = ?`, id)
	return err
}

func (r *Classes) SetJoinCode(id int64, code string) error {
	_, err := r.db.Exec(`UPDATE classes SET join_code = ? WHERE id = ?`, code, id)
	return err
}

// CountActive counts the classes that are not archived.
func (r *Classes) CountActive() int {
	return count(r.db, `SELECT COUNT(*) FROM classes WHERE archived = 0`)
}

// ---------- members ----------

// Members lists teachers first, then students, by name.
func (r *Classes) Members(classID int64) []domain.Member {
	out := []domain.Member{}
	rows, err := r.db.Query(`SELECT u.id, u.name, u.email, m.role, m.joined_at, u.last_login_at FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? ORDER BY m.role DESC, u.name`, classID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var m domain.Member
		var last sql.NullString
		if rows.Scan(&m.UserID, &m.Name, &m.Email, &m.Role, &m.JoinedAt, &last) == nil {
			if last.Valid {
				m.LastLoginAt = &last.String
			}
			out = append(out, m)
		}
	}
	return out
}

// Students returns the student accounts of a class, by name.
func (r *Classes) Students(classID int64) ([]domain.User, error) {
	rows, err := r.db.Query(`SELECT `+prefixed("u.", userCols)+`, `+userRoomCol("u")+` FROM class_members m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? AND m.role = 'student' ORDER BY u.name`, classID)
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

func (r *Classes) CountStudents(classID int64) int {
	return count(r.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND role = 'student'`, classID)
}

// CountMemberships counts the classes each user belongs to, by user id.
func (r *Classes) CountMemberships() (map[int64]int, error) {
	return groupedInts(r.db, `SELECT user_id, COUNT(*) FROM class_members GROUP BY user_id`)
}

// AddMember adds a user to a class; an existing membership is kept as is.
func (r *Classes) AddMember(classID, userID int64, role string) error {
	_, err := r.db.Exec(`INSERT OR IGNORE INTO class_members(class_id, user_id, role, joined_at) VALUES(?,?,?,?)`, classID, userID, role, domain.Now())
	return err
}

func (r *Classes) RemoveMember(classID, userID int64) error {
	_, err := r.db.Exec(`DELETE FROM class_members WHERE class_id = ? AND user_id = ?`, classID, userID)
	return err
}

// IsMember reports whether the user belongs to the class in any role.
func (r *Classes) IsMember(classID, userID int64) bool {
	return count(r.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND user_id = ?`, classID, userID) > 0
}

// IsOwner reports whether the user created (owns) the class.
func (r *Classes) IsOwner(classID, userID int64) bool {
	return count(r.db, `SELECT COUNT(*) FROM classes WHERE id = ? AND owner_id = ?`, classID, userID) > 0
}

// Teaches reports whether the user owns or co-teaches the class.
func (r *Classes) Teaches(classID, userID int64) bool {
	return r.IsOwner(classID, userID) ||
		count(r.db, `SELECT COUNT(*) FROM class_members WHERE class_id = ? AND user_id = ? AND role = 'teacher'`, classID, userID) > 0
}

// TeachesStudent reports whether the teacher teaches a class the student is in.
func (r *Classes) TeachesStudent(teacherID, studentID int64) bool {
	return count(r.db, `SELECT COUNT(*) FROM class_members m1 JOIN class_members m2 ON m1.class_id = m2.class_id
		WHERE m1.user_id = ? AND m1.role = 'teacher' AND m2.user_id = ?`, teacherID, studentID) > 0
}
