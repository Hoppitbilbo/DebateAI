package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Rooms is the repository of temporary rooms and their guests (rooms and
// room_guests tables; every guest also has a student row in users).
//
// Deleting a room or a guest removes the rows explicitly instead of relying
// on ON DELETE CASCADE, so the data of minors is gone even on a database
// where foreign keys are not enforced.
type Rooms struct{ db *sql.DB }

func NewRooms(db *sql.DB) *Rooms { return &Rooms{db: db} }

var (
	ErrNicknameTaken = errors.New("nickname already used in this room")
	ErrRoomFull      = errors.New("the room is full")
	errNoRoomCode    = errors.New("could not create room")
)

const roomSelect = `SELECT r.id, r.code, r.title, r.instructions, r.app_type, r.assignment_id, r.teacher_id, r.locked, r.max_guests, r.created_at, r.expires_at,
	(SELECT COUNT(*) FROM room_guests g WHERE g.room_id = r.id)
	FROM rooms r`

func scanRoom(row interface{ Scan(...any) error }) (*domain.Room, error) {
	var r domain.Room
	var assignment, teacher sql.NullInt64
	var locked int
	if err := row.Scan(&r.ID, &r.Code, &r.Title, &r.Instructions, &r.AppType, &assignment, &teacher, &locked, &r.MaxGuests, &r.CreatedAt, &r.ExpiresAt, &r.GuestCount); err != nil {
		return nil, err
	}
	r.AssignmentID = nullIntPtr64(assignment)
	r.TeacherID = nullIntPtr64(teacher)
	r.Locked = locked == 1
	return &r, nil
}

func nullIntPtr64(v sql.NullInt64) *int64 {
	if !v.Valid {
		return nil
	}
	return &v.Int64
}

// Create inserts a room with a fresh join code.
func (r *Rooms) Create(n domain.NewRoom) (int64, error) {
	for attempt := 0; attempt < 5; attempt++ { // codes are unique
		res, err := r.db.Exec(`INSERT INTO rooms(code, host_token_hash, teacher_id, assignment_id, title, instructions, app_type, max_guests, created_at, expires_at)
			VALUES(?,?,?,?,?,?,?,?,?,?)`, domain.NewJoinCode(), n.HostTokenHash, n.TeacherID, n.AssignmentID, n.Title, n.Instructions, n.AppType, n.MaxGuests, domain.Now(), n.ExpiresAt)
		if err == nil {
			return res.LastInsertId()
		}
		if !strings.Contains(err.Error(), "UNIQUE") {
			return 0, err
		}
	}
	return 0, errNoRoomCode
}

func (r *Rooms) Get(id int64) (*domain.Room, error) {
	return scanRoom(r.db.QueryRow(roomSelect+` WHERE r.id = ?`, id))
}

func (r *Rooms) FindByCode(code string) (*domain.Room, error) {
	return scanRoom(r.db.QueryRow(roomSelect+` WHERE r.code = ?`, code))
}

// FindByHostToken returns the room managed with this secret link.
func (r *Rooms) FindByHostToken(tokenHash string) (*domain.Room, error) {
	return scanRoom(r.db.QueryRow(roomSelect+` WHERE r.host_token_hash = ?`, tokenHash))
}

// ListOpenForTeacher returns the rooms of a teacher that have not expired yet.
func (r *Rooms) ListOpenForTeacher(teacherID int64, now string) ([]*domain.Room, error) {
	rows, err := r.db.Query(roomSelect+` WHERE r.teacher_id = ? AND r.expires_at > ? ORDER BY r.created_at DESC`, teacherID, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []*domain.Room{}
	for rows.Next() {
		if room, err := scanRoom(rows); err == nil {
			out = append(out, room)
		}
	}
	return out, rows.Err()
}

// CountOpenAnonymous counts the open rooms created without an account.
func (r *Rooms) CountOpenAnonymous(now string) int {
	return count(r.db, `SELECT COUNT(*) FROM rooms WHERE teacher_id IS NULL AND expires_at > ?`, now)
}

func (r *Rooms) SetLocked(id int64, locked bool) error {
	_, err := r.db.Exec(`UPDATE rooms SET locked = ? WHERE id = ?`, boolInt(locked), id)
	return err
}

// AddGuest creates the student account of a guest and puts it in the room;
// it fails with ErrNicknameTaken or ErrRoomFull.
func (r *Rooms) AddGuest(roomID int64, nickname, avatar, locale string) (int64, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	var guests, max int
	if err := tx.QueryRow(`SELECT (SELECT COUNT(*) FROM room_guests WHERE room_id = ?), max_guests FROM rooms WHERE id = ?`, roomID, roomID).Scan(&guests, &max); err != nil {
		return 0, err
	}
	if guests >= max {
		return 0, ErrRoomFull
	}
	var taken int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM room_guests WHERE room_id = ? AND nickname = ?`, roomID, nickname).Scan(&taken); err != nil {
		return 0, err
	}
	if taken > 0 {
		return 0, ErrNicknameTaken
	}
	res, err := tx.Exec(`INSERT INTO users(email, name, password_hash, role, locale, created_at) VALUES(?,?,'',?,?,?)`,
		guestEmail(), nickname, domain.RoleStudent, locale, domain.Now())
	if err != nil {
		return 0, err
	}
	userID, _ := res.LastInsertId()
	if _, err := tx.Exec(`INSERT INTO room_guests(user_id, room_id, nickname, avatar) VALUES(?,?,?,?)`, userID, roomID, nickname, avatar); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return 0, ErrNicknameTaken
		}
		return 0, err
	}
	return userID, tx.Commit()
}

// guestEmail is a unique placeholder address that can never receive mail.
func guestEmail() string {
	b := make([]byte, 12)
	_, _ = rand.Read(b)
	return "guest-" + hex.EncodeToString(b) + domain.GuestEmailDomain
}

// Guests lists the guests of a room with a summary of their attempts.
func (r *Rooms) Guests(roomID int64) ([]domain.RoomGuest, error) {
	rows, err := r.db.Query(`SELECT g.user_id, g.nickname, g.avatar, u.created_at, g.rejoin_pin_hash != '',
		(SELECT COUNT(*) FROM activity_sessions s WHERE s.user_id = g.user_id),
		(SELECT COALESCE(SUM(s.turns), 0) FROM activity_sessions s WHERE s.user_id = g.user_id),
		(SELECT COALESCE(MAX(s.progress), 0) FROM activity_sessions s WHERE s.user_id = g.user_id),
		(SELECT s.status FROM activity_sessions s WHERE s.user_id = g.user_id ORDER BY s.updated_at DESC LIMIT 1),
		(SELECT MAX(s.updated_at) FROM activity_sessions s WHERE s.user_id = g.user_id)
		FROM room_guests g JOIN users u ON u.id = g.user_id WHERE g.room_id = ? ORDER BY u.created_at`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.RoomGuest{}
	for rows.Next() {
		var g domain.RoomGuest
		var status, last sql.NullString
		if err := rows.Scan(&g.UserID, &g.Nickname, &g.Avatar, &g.JoinedAt, &g.RejoinPending, &g.Sessions, &g.Turns, &g.BestProgress, &status, &last); err != nil {
			return nil, err
		}
		g.Status = status.String
		if last.Valid {
			g.LastActivity = &last.String
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

// Guest returns one guest of a room.
func (r *Rooms) Guest(roomID, userID int64) (*domain.RoomGuest, error) {
	var g domain.RoomGuest
	err := r.db.QueryRow(`SELECT user_id, nickname, avatar FROM room_guests WHERE room_id = ? AND user_id = ?`, roomID, userID).Scan(&g.UserID, &g.Nickname, &g.Avatar)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// GuestByNickname returns the guest of a room with this nickname.
func (r *Rooms) GuestByNickname(roomID int64, nickname string) (*domain.RoomGuest, error) {
	var g domain.RoomGuest
	err := r.db.QueryRow(`SELECT user_id, nickname, avatar FROM room_guests WHERE room_id = ? AND nickname = ?`, roomID, nickname).Scan(&g.UserID, &g.Nickname, &g.Avatar)
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// SetRejoinPIN stores the hash of a one-time re-entry PIN; an empty hash clears it.
func (r *Rooms) SetRejoinPIN(userID int64, pinHash string, expiresAt *string) error {
	_, err := r.db.Exec(`UPDATE room_guests SET rejoin_pin_hash = ?, rejoin_expires_at = ? WHERE user_id = ?`, pinHash, expiresAt, userID)
	return err
}

// RejoinPIN returns the stored PIN hash of a guest and its expiry.
func (r *Rooms) RejoinPIN(userID int64) (pinHash, expiresAt string, err error) {
	var exp sql.NullString
	err = r.db.QueryRow(`SELECT rejoin_pin_hash, rejoin_expires_at FROM room_guests WHERE user_id = ?`, userID).Scan(&pinHash, &exp)
	return pinHash, exp.String, err
}

// MoveGuestSessions gives the attempts of a guest to a real student.
func (r *Rooms) MoveGuestSessions(guestID, studentID int64) error {
	_, err := r.db.Exec(`UPDATE activity_sessions SET user_id = ? WHERE user_id = ?`, studentID, guestID)
	return err
}

// guestCleanup deletes everything that belongs to the guests selected by
// the subquery guests (a SELECT of user ids), in dependency order.
var guestCleanup = []string{
	`DELETE FROM activity_sessions WHERE user_id IN (%s)`,
	`DELETE FROM auth_sessions WHERE user_id IN (%s)`,
	`UPDATE usage_log SET user_id = NULL WHERE user_id IN (%s)`,
	`DELETE FROM users WHERE id IN (%s)`,
}

func deleteGuests(tx *sql.Tx, guests string, args ...any) error {
	for _, q := range guestCleanup {
		if _, err := tx.Exec(strings.Replace(q, "%s", guests, 1), args...); err != nil {
			return err
		}
	}
	return nil
}

// DeleteGuest removes a guest with all their attempts.
func (r *Rooms) DeleteGuest(roomID, userID int64) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := deleteGuests(tx, `SELECT user_id FROM room_guests WHERE room_id = ? AND user_id = ?`, roomID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM room_guests WHERE room_id = ? AND user_id = ?`, roomID, userID); err != nil {
		return err
	}
	return tx.Commit()
}

// Delete removes a room, its guests and all their attempts.
func (r *Rooms) Delete(id int64) error {
	return r.deleteWhere(`id = ?`, id)
}

// PurgeExpired deletes every room that expired before now; when none did,
// it costs a single indexed query.
func (r *Rooms) PurgeExpired(now string) error {
	if count(r.db, `SELECT COUNT(*) FROM rooms WHERE expires_at <= ?`, now) == 0 {
		return nil
	}
	return r.deleteWhere(`expires_at <= ?`, now)
}

func (r *Rooms) deleteWhere(cond string, args ...any) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	rooms := `SELECT id FROM rooms WHERE ` + cond
	if err := deleteGuests(tx, `SELECT user_id FROM room_guests WHERE room_id IN (`+rooms+`)`, args...); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM room_guests WHERE room_id IN (`+rooms+`)`, args...); err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM rooms WHERE `+cond, args...); err != nil {
		return err
	}
	return tx.Commit()
}
