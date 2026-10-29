package store

import (
	"errors"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func newTestRoom(t *testing.T, r *Rooms, hostHash string, teacherID *int64, expires time.Time, maxGuests int) *domain.Room {
	t.Helper()
	id, err := r.Create(domain.NewRoom{HostTokenHash: hostHash, TeacherID: teacherID, AppType: "convinci-tu", Title: "Prova",
		MaxGuests: maxGuests, ExpiresAt: expires.UTC().Format(time.RFC3339)})
	if err != nil {
		t.Fatal(err)
	}
	room, err := r.Get(id)
	if err != nil {
		t.Fatal(err)
	}
	return room
}

func TestRoomsGuestsAndLookup(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	r := NewRooms(db)
	room := newTestRoom(t, r, "host-hash", &teacher, time.Now().Add(time.Hour), 2)

	if len(room.Code) != 6 || room.TeacherID == nil || *room.TeacherID != teacher {
		t.Fatalf("room: %+v", room)
	}
	if found, err := r.FindByCode(room.Code); err != nil || found.ID != room.ID {
		t.Fatal("find by code")
	}
	if found, err := r.FindByHostToken("host-hash"); err != nil || found.ID != room.ID {
		t.Fatal("find by host token")
	}

	marco, err := r.AddGuest(room.ID, "Marco R", "fox", "it")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.AddGuest(room.ID, "marco r", "owl", "it"); !errors.Is(err, domain.ErrNicknameTaken) {
		t.Fatalf("nicknames are unique ignoring case: %v", err)
	}
	if _, err := r.AddGuest(room.ID, "Sara", "cat", "it"); err != nil {
		t.Fatal(err)
	}
	if _, err := r.AddGuest(room.ID, "Luca", "dog", "it"); !errors.Is(err, domain.ErrRoomFull) {
		t.Fatalf("room must be full: %v", err)
	}

	u, err := users.Get(marco)
	if err != nil || !u.IsGuest() || *u.RoomID != room.ID || u.Role != domain.RoleStudent || u.Name != "Marco R" {
		t.Fatalf("guest account: %v %+v", err, u)
	}
	if teacherUser, _ := users.Get(teacher); teacherUser.IsGuest() {
		t.Fatal("real accounts are not guests")
	}
	if users.Count("") != 1 || users.Count(domain.RoleStudent) != 0 {
		t.Fatal("guests are not counted as accounts")
	}
	if list, _ := users.Search("", "", 50); len(list) != 1 {
		t.Fatalf("guests are not listed: %+v", list)
	}

	if g, err := r.GuestByNickname(room.ID, "MARCO R"); err != nil || g.UserID != marco {
		t.Fatal("guest by nickname")
	}
	exp := time.Now().Add(5 * time.Minute).UTC().Format(time.RFC3339)
	r.SetRejoinPIN(marco, "pin-hash", &exp)
	if h, e, _ := r.RejoinPIN(marco); h != "pin-hash" || e != exp {
		t.Fatal("rejoin pin")
	}
	guests, err := r.Guests(room.ID)
	if err != nil || len(guests) != 2 || guests[0].Nickname != "Marco R" || !guests[0].RejoinPending || guests[0].Avatar != "fox" {
		t.Fatalf("guests: %v %+v", err, guests)
	}

	r.SetLocked(room.ID, true)
	if got, _ := r.Get(room.ID); !got.Locked || got.GuestCount != 2 {
		t.Fatalf("locked room: %+v", got)
	}
	if open, _ := r.ListOpenForTeacher(teacher, domain.Now()); len(open) != 1 {
		t.Fatal("open rooms of the teacher")
	}
}

func TestRoomsDeleteLeavesNothingBehind(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	sessions := NewActivitySessions(db)
	logins := NewAuthSessions(db)
	usage := NewUsage(db)
	r := NewRooms(db)

	old := newTestRoom(t, r, "old", nil, time.Now().Add(-time.Minute), 30)
	live := newTestRoom(t, r, "live", nil, time.Now().Add(time.Hour), 30)
	if r.CountOpenAnonymous(domain.Now()) != 1 {
		t.Fatal("open anonymous rooms")
	}
	addGuestWithData := func(roomID int64, nick string) int64 {
		uid, err := r.AddGuest(roomID, nick, "fox", "it")
		if err != nil {
			t.Fatal(err)
		}
		sessions.Create(domain.NewSession{UserID: uid, AppType: "convinci-tu", Context: "{}"})
		logins.Create("tok-"+nick, uid, time.Now().Add(time.Hour).UTC().Format(time.RFC3339))
		usage.Insert(domain.UsageRecord{UserID: &uid, Task: "chat", OK: true})
		return uid
	}
	gone := addGuestWithData(old.ID, "Anna")
	kept := addGuestWithData(live.ID, "Bruno")
	kicked := addGuestWithData(live.ID, "Carla")

	if n := usage.CountRoomRequestsSince(live.ID, "", "judge"); n != 2 {
		t.Fatalf("room requests: %d", n)
	}

	if err := r.PurgeExpired(domain.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Get(old.ID); err == nil {
		t.Fatal("expired room must be deleted")
	}
	if _, err := users.Get(gone); err == nil {
		t.Fatal("guest account must be deleted")
	}
	if list, _ := sessions.ListForUser(gone, 10); len(list) != 0 {
		t.Fatal("guest sessions must be deleted")
	}
	if _, _, err := logins.Lookup("tok-Anna"); err == nil {
		t.Fatal("guest login must be deleted")
	}
	if n := usage.CountUserRequestsSince(gone, "", ""); n != 0 {
		t.Fatal("usage rows must not point at the deleted guest")
	}
	if usage.CountSince("", false) != 3 {
		t.Fatal("costs stay accounted")
	}
	if _, err := users.Get(kept); err != nil {
		t.Fatal("open rooms are kept")
	}

	if err := r.DeleteGuest(live.ID, kicked); err != nil {
		t.Fatal(err)
	}
	if _, err := users.Get(kicked); err == nil {
		t.Fatal("kicked guest must be deleted")
	}

	student, _ := users.Create("s@x.it", "Bruno Rossi", "", domain.RoleStudent, "it")
	r.MoveGuestSessions(kept, student)
	if err := r.Delete(live.ID); err != nil {
		t.Fatal(err)
	}
	if list, _ := sessions.ListForUser(student, 10); len(list) != 1 {
		t.Fatal("sessions moved to a real student survive the room")
	}
	if n := count(db, `SELECT COUNT(*) FROM room_guests`) + count(db, `SELECT COUNT(*) FROM rooms`); n != 0 {
		t.Fatalf("leftover rows: %d", n)
	}
}

func TestRoomWithItsOwnAssignment(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	classes := NewClasses(db)
	assignments := NewAssignments(db)
	sessions := NewActivitySessions(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	real, _ := classes.Create("3A", "", teacher)
	r := NewRooms(db)

	id, err := r.Create(domain.NewRoom{HostTokenHash: "h", TeacherID: &teacher, AppType: "impersona-tu", Title: "Dante", MaxGuests: 30,
		ExpiresAt: time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		OwnAssignments: []domain.NewAssignment{
			{Title: "Dante", AppType: "impersona-tu", Config: `{"topic":"Inferno"}`, Goals: []string{"Chiede di Virgilio"}, MaxTurns: 8, Published: true},
			{Title: "Chi sono?", AppType: "personaggio-misterioso", Published: true},
		}})
	if err != nil {
		t.Fatal(err)
	}
	room, _ := r.Get(id)
	if room.AssignmentID == nil {
		t.Fatal("the room points to its assignment")
	}
	a, err := assignments.Get(*room.AssignmentID)
	if err != nil || a.Title != "Dante" || a.MaxTurns != 8 || len(a.Goals) != 1 || !a.Published {
		t.Fatalf("own assignment: %v %+v", err, a)
	}
	if room.OwnClassID == nil || *room.OwnClassID != a.ClassID {
		t.Fatalf("the room knows its hidden class: %v", room.OwnClassID)
	}
	if path, _ := assignments.ListForClass(a.ClassID); len(path) != 2 {
		t.Fatalf("both activities live in the hidden class: %d", len(path))
	}
	hidden, _ := classes.Get(a.ClassID)
	if !hidden.Archived {
		t.Fatal("the hidden class is archived, so its code never works")
	}
	if _, err := classes.FindByJoinCode(hidden.JoinCode); err == nil {
		t.Fatal("nobody joins the hidden class")
	}
	if list, _ := classes.ListTaughtBy(teacher); len(list) != 1 || list[0].ID != real {
		t.Fatalf("the teacher does not see the hidden class: %+v", list)
	}
	if list, _ := classes.ListAll(); len(list) != 1 {
		t.Fatalf("admins do not see it either: %+v", list)
	}
	if !classes.Teaches(a.ClassID, teacher) {
		t.Fatal("the teacher manages the room's assignment")
	}

	// One guest's attempt is imported into a real student, one is not.
	moved, _ := r.AddGuest(id, "Anna", "fox", "it")
	gone, _ := r.AddGuest(id, "Bea", "owl", "it")
	student, _ := users.Create("s@x.it", "Anna Rossi", "", domain.RoleStudent, "it")
	sessions.Create(domain.NewSession{UserID: moved, AssignmentID: room.AssignmentID, AppType: "impersona-tu", Context: "{}"})
	sessions.Create(domain.NewSession{UserID: gone, AssignmentID: room.AssignmentID, AppType: "impersona-tu", Context: "{}"})
	r.MoveGuestSessions(moved, student)

	if err := r.Delete(id); err != nil {
		t.Fatal(err)
	}
	if _, err := assignments.Get(*room.AssignmentID); err == nil {
		t.Fatal("the own assignment is deleted with the room")
	}
	if _, err := classes.Get(a.ClassID); err == nil {
		t.Fatal("the hidden class is deleted with the room")
	}
	kept, _ := sessions.ListForUser(student, 10)
	if len(kept) != 1 || kept[0].AssignmentID != nil {
		t.Fatalf("the imported attempt stays, without the deleted assignment: %+v", kept)
	}
	if _, err := classes.Get(real); err != nil {
		t.Fatal("real classes are untouched")
	}
}

func TestRoomWithoutAccountHasAnAssignmentWithoutAuthor(t *testing.T) {
	db := openTestDB(t)
	r := NewRooms(db)
	id, err := r.Create(domain.NewRoom{HostTokenHash: "h", AppType: "convinci-tu", MaxGuests: 30, ExpiresAt: time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		OwnAssignments: []domain.NewAssignment{{Title: "Debate", AppType: "convinci-tu", Config: "{}", Published: true}}})
	if err != nil {
		t.Fatal(err)
	}
	room, _ := r.Get(id)
	if a, err := NewAssignments(db).Get(*room.AssignmentID); err != nil || a.Title != "Debate" {
		t.Fatalf("assignment of an anonymous room: %v", err)
	}
	if err := r.PurgeExpired(time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	if n := count(db, `SELECT COUNT(*) FROM classes`) + count(db, `SELECT COUNT(*) FROM assignments`); n != 0 {
		t.Fatalf("purge leaves nothing: %d", n)
	}
}
