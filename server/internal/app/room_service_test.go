package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func newRoomTestUser(t *testing.T, s *Services, email, role string) *domain.User {
	t.Helper()
	id, err := s.Accounts.CreateUser(email, email, "", role, "it")
	if err != nil {
		t.Fatal(err)
	}
	u, _ := s.Users.Get(id)
	return u
}

func joinRoom(t *testing.T, s *Services, code, nick string) *domain.User {
	t.Helper()
	login, err := s.RoomSvc.Join(JoinRequest{Code: code, Nickname: nick, Avatar: "fox"})
	if err != nil {
		t.Fatal(err)
	}
	u := s.Accounts.UserForToken(login.Token)
	if u == nil || !u.IsGuest() {
		t.Fatalf("guest must be logged in: %+v", u)
	}
	return u
}

func TestRoomOpenRules(t *testing.T) {
	s := newTestServer(t)
	teacher := newRoomTestUser(t, s, "t@x.it", domain.RoleTeacher)
	other := newRoomTestUser(t, s, "o@x.it", domain.RoleTeacher)
	class, _ := s.ClassSvc.Create(teacher, "3A", "", nil)
	a, err := s.AssignmentSvc.Create(teacher, class.ID, AssignmentInput{Title: ptr("Dibattito"), AppType: ptr("convinci-tu")}, "")
	if err != nil {
		t.Fatal(err)
	}

	anon, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot", Minutes: 500, MaxGuests: 500})
	if err != nil || anon.HostKey == "" || anon.Room.TeacherID != nil {
		t.Fatalf("anonymous room: %v %+v", err, anon)
	}
	if d := domain.ParseTime(anon.Room.ExpiresAt).Sub(time.Now()); d > domain.MaxRoomDuration || d < domain.MaxRoomDuration-time.Minute {
		t.Fatalf("a room lasts at most 2 hours, got %v", d)
	}
	if anon.Room.MaxGuests != DefaultRooms().MaxGuests {
		t.Fatalf("max guests capped: %d", anon.Room.MaxGuests)
	}
	if room, err := s.RoomSvc.ForHost(anon.HostKey); err != nil || room.ID != anon.Room.ID {
		t.Fatal("the host key manages the room")
	}
	if _, err := s.RoomSvc.ForHost("wrong"); !errors.Is(err, ErrRoomNotFound) {
		t.Fatal("a wrong key manages nothing")
	}

	if _, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "convinci-tu", AssignmentID: a.ID}); !errors.Is(err, ErrAssignmentForbidden) {
		t.Fatal("assignments need the teacher's account")
	}
	if _, err := s.RoomSvc.Open(other, RoomRequest{AssignmentID: a.ID}); !errors.Is(err, ErrAssignmentForbidden) {
		t.Fatal("only the class teachers may open a room on an assignment")
	}
	mine, err := s.RoomSvc.Open(teacher, RoomRequest{AssignmentID: a.ID, AppType: "wiki-chatbot"})
	if err != nil || mine.Room.AppType != "convinci-tu" || mine.Room.Title != "Dibattito" {
		t.Fatalf("assignment room takes app and title from the assignment: %v %+v", err, mine)
	}
	if _, err := s.RoomSvc.ForTeacher(other, mine.Room.ID); !errors.Is(err, ErrRoomNotYours) {
		t.Fatal("other teachers cannot manage the room")
	}
	if _, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "nope"}); !errors.Is(err, ErrInvalidApp) {
		t.Fatal("unknown app")
	}

	cfg := DefaultRooms()
	cfg.AllowAnonymousTeachers = false
	s.Settings.SaveRooms(cfg)
	if _, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"}); !errors.Is(err, ErrRoomLoginRequired) {
		t.Fatal("anonymous rooms can be disabled")
	}
	cfg.Enabled = false
	s.Settings.SaveRooms(cfg)
	if _, err := s.RoomSvc.Open(teacher, RoomRequest{AppType: "wiki-chatbot"}); !errors.Is(err, ErrRoomsDisabled) {
		t.Fatal("rooms can be disabled")
	}
}

func TestRoomJoinRejoinAndAssignmentAccess(t *testing.T) {
	s := newTestServer(t)
	teacher := newRoomTestUser(t, s, "t@x.it", domain.RoleTeacher)
	class, _ := s.ClassSvc.Create(teacher, "3A", "", nil)
	a, _ := s.AssignmentSvc.Create(teacher, class.ID, AssignmentInput{Title: ptr("Dibattito"), AppType: ptr("convinci-tu")}, "")
	other, _ := s.AssignmentSvc.Create(teacher, class.ID, AssignmentInput{Title: ptr("Altro"), AppType: ptr("convinci-tu")}, "")
	opened, _ := s.RoomSvc.Open(teacher, RoomRequest{AssignmentID: a.ID})
	code := opened.Room.Code

	if info, err := s.RoomSvc.Lookup(" " + code + " "); err != nil || info.Title != "Dibattito" {
		t.Fatalf("lookup: %v", err)
	}
	marco := joinRoom(t, s, code, "  Marco   R  ")
	if marco.Name != "Marco R" {
		t.Fatalf("nickname normalized: %q", marco.Name)
	}
	if _, err := s.RoomSvc.Join(JoinRequest{Code: code, Nickname: "MARCO R", Avatar: "owl"}); !errors.Is(err, ErrNicknameTaken) {
		t.Fatal("nickname taken")
	}
	if _, err := s.RoomSvc.Join(JoinRequest{Code: code, Nickname: "Sara", Avatar: "../x"}); !errors.Is(err, ErrBadAvatar) {
		t.Fatal("bad avatar")
	}
	if _, err := s.RoomSvc.Join(JoinRequest{Code: code, Nickname: "   ", Avatar: "fox"}); !errors.Is(err, ErrBadNickname) {
		t.Fatal("empty nickname")
	}

	// The guest works on the room's assignment and nothing else.
	if _, err := s.AssignmentSvc.Visible(marco, a.ID); err != nil {
		t.Fatalf("guest sees the room assignment: %v", err)
	}
	if _, err := s.AssignmentSvc.Visible(marco, other.ID); !errors.Is(err, ErrNotAssigned) {
		t.Fatal("guest must not see other assignments")
	}
	if _, err := s.SessionSvc.Start(marco, NewAttempt{AppType: "convinci-tu", AssignmentID: a.ID}); err != nil {
		t.Fatalf("guest starts the room assignment: %v", err)
	}
	if gr, err := s.RoomSvc.ForGuest(marco); err != nil || gr.Nickname != "Marco R" || gr.Avatar != "fox" {
		t.Fatalf("guest room: %v %+v", err, gr)
	}

	// Re-entry from another computer with the teacher's PIN, once.
	room, _ := s.RoomSvc.ForTeacher(teacher, opened.Room.ID)
	pin, err := s.RoomSvc.IssueRejoinPIN(room, marco.ID)
	if err != nil || len(pin) != 4 {
		t.Fatalf("pin: %v %q", err, pin)
	}
	if _, err := s.RoomSvc.Rejoin(RejoinRequest{Code: code, Nickname: "marco r", PIN: "x" + pin}); !errors.Is(err, ErrBadRejoinPIN) {
		t.Fatal("wrong pin")
	}
	login, err := s.RoomSvc.Rejoin(RejoinRequest{Code: code, Nickname: "marco r", PIN: pin})
	if err != nil || login.UserID != marco.ID {
		t.Fatalf("rejoin: %v", err)
	}
	if _, err := s.RoomSvc.Rejoin(RejoinRequest{Code: code, Nickname: "marco r", PIN: pin}); !errors.Is(err, ErrBadRejoinPIN) {
		t.Fatal("a pin works once")
	}

	s.RoomSvc.SetLocked(room, true)
	if _, err := s.RoomSvc.Join(JoinRequest{Code: code, Nickname: "Late", Avatar: "fox"}); !errors.Is(err, ErrRoomLocked) {
		t.Fatal("locked room")
	}

	view, err := s.RoomSvc.View(room)
	if err != nil || len(view.Guests) != 1 || view.Guests[0].Sessions != 1 {
		t.Fatalf("view: %v %+v", err, view)
	}
}

func TestRoomExpiresAndEnds(t *testing.T) {
	s := newTestServer(t)
	opened, _ := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot", Minutes: 30})
	guest := joinRoom(t, s, opened.Room.Code, "Anna")

	later := s.RoomSvc
	later.now = func() time.Time { return time.Now().Add(31 * time.Minute) }
	if _, err := later.Lookup(opened.Room.Code); !errors.Is(err, ErrRoomNotFound) {
		t.Fatal("an expired room is closed at once")
	}
	if _, err := later.Join(JoinRequest{Code: opened.Room.Code, Nickname: "Bea", Avatar: "fox"}); !errors.Is(err, ErrRoomNotFound) {
		t.Fatal("nobody joins an expired room")
	}
	later.Purge()
	if _, err := s.Users.Get(guest.ID); err == nil {
		t.Fatal("purge deletes the guests")
	}
	later.now = time.Now

	opened, _ = s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	guest = joinRoom(t, s, opened.Room.Code, "Anna")
	room, _ := s.RoomSvc.ForHost(opened.HostKey)
	if err := s.RoomSvc.End(room); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RoomSvc.ForHost(opened.HostKey); !errors.Is(err, ErrRoomNotFound) {
		t.Fatal("ended room")
	}
	if _, err := s.Users.Get(guest.ID); err == nil {
		t.Fatal("ending deletes the guests")
	}
}

func TestRoomLimitsArePerGuestNotPerNetwork(t *testing.T) {
	s := newTestServer(t)
	cfg := DefaultRooms()
	cfg.RequestsPerGuestPerHour = 2
	cfg.MaxRequestsPerRoom = 3
	s.Settings.SaveRooms(cfg)
	opened, _ := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	anna := joinRoom(t, s, opened.Room.Code, "Anna")
	bea := joinRoom(t, s, opened.Room.Code, "Bea")
	use := func(u *domain.User, task string) {
		s.Usage.Insert(domain.UsageRecord{UserID: &u.ID, Task: task, OK: true})
	}

	use(anna, TaskChat)
	use(anna, TaskChat)
	use(anna, TaskJudge) // the judge does not count
	if err := s.RoomSvc.AllowAI(anna); !errors.Is(err, ErrGuestLimit) {
		t.Fatalf("guest limit: %v", err)
	}
	if err := s.RoomSvc.AllowAI(bea); err != nil {
		t.Fatalf("another guest, same network, is not limited: %v", err)
	}
	use(bea, TaskChat)
	if err := s.RoomSvc.AllowAI(bea); !errors.Is(err, ErrRoomLimit) {
		t.Fatalf("room limit: %v", err)
	}
}

func TestRoomRoutingUsesTheRoomModels(t *testing.T) {
	s := newTestServer(t)
	fp := &fakeProvider{}
	useProvider(s, 1, ai.KindOpenAI, fp)
	setChatRoute(t, s, StrategyOrdered, RouteTarget{1, "paid-main"}, RouteTarget{1, "main:free"})

	ctx := WithRoomRouting(context.Background())
	if got := s.Gateway.TargetsFor(ctx, TaskChat); len(got) != 1 || got[0].Model != "main:free" {
		t.Fatalf("without room models, rooms use the free main ones: %+v", got)
	}
	cfg := DefaultRooms()
	cfg.Tasks = map[string][]RouteTarget{TaskChat: {{1, "room:free"}}}
	s.Settings.SaveRooms(cfg)
	res, err := s.Gateway.Generate(ctx, TaskChat, chatRequest(), nil, nil, nil)
	if err != nil || res.Model != "room:free" {
		t.Fatalf("rooms use their own model: %v %+v", err, res)
	}
	if got := s.Gateway.TargetsFor(ctx, TaskJudge); len(got) != 1 || got[0].Model != "room:free" {
		t.Fatalf("other tasks fall back to the room chat model: %+v", got)
	}
	if got := s.Gateway.TargetsFor(ctx, TaskLive); len(got) != 0 {
		t.Fatal("no live voice in rooms")
	}
	if got := s.Gateway.TargetsFor(context.Background(), TaskChat); got[0].Model != "paid-main" {
		t.Fatal("other users keep the main routing")
	}
}

func TestRoomExportAndImport(t *testing.T) {
	s := newTestServer(t)
	teacher := newRoomTestUser(t, s, "t@x.it", domain.RoleTeacher)
	class, _ := s.ClassSvc.Create(teacher, "3A", "", nil)
	a, _ := s.AssignmentSvc.Create(teacher, class.ID, AssignmentInput{Title: ptr("Dibattito"), AppType: ptr("convinci-tu")}, "")
	rossi := newRoomTestUser(t, s, "rossi@x.it", domain.RoleStudent)
	s.Classes.AddMember(class.ID, rossi.ID, domain.RoleStudent)
	outsider := newRoomTestUser(t, s, "out@x.it", domain.RoleStudent)

	opened, _ := s.RoomSvc.Open(teacher, RoomRequest{AssignmentID: a.ID})
	marco := joinRoom(t, s, opened.Room.Code, "Marco")
	joinRoom(t, s, opened.Room.Code, "Anon")
	ss, _ := s.SessionSvc.Start(marco, NewAttempt{AppType: "convinci-tu", AssignmentID: a.ID, Title: "Tentativo"})
	s.Sessions.SaveTranscript(ss.ID, `[{"role":"user","content":"ciao"}]`, 1, nil)
	room, _ := s.RoomSvc.ForTeacher(teacher, opened.Room.ID)

	export, err := s.RoomTransfer.Export(room)
	if err != nil || len(export.Guests) != 2 || len(export.Guests[0].Sessions) != 1 || export.Guests[0].Sessions[0].UserID != nil {
		t.Fatalf("export: %v %+v", err, export)
	}
	file, err := s.RoomTransfer.SealExport(export)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(file), "ciao") || strings.Contains(string(file), "Marco") {
		t.Fatal("the file must not expose the conversations")
	}
	if _, err := s.RoomTransfer.OpenExport(string(file[:len(file)-10]) + `"}`); !errors.Is(err, ErrBadExportFile) {
		t.Fatal("a changed file is refused")
	}
	preview, err := s.RoomTransfer.PreviewFile(string(file))
	if err != nil || len(preview.Guests) != 2 || preview.Guests[0].Sessions != 1 {
		t.Fatalf("preview: %v %+v", err, preview)
	}

	if _, err := s.RoomTransfer.ImportFile(teacher, class.ID, string(file), []ImportMatch{{"Marco", outsider.ID}}); !errors.Is(err, ErrBadImportMapping) {
		t.Fatal("only students of the class")
	}
	res, err := s.RoomTransfer.ImportFile(teacher, class.ID, string(file), []ImportMatch{{"marco", rossi.ID}, {"Anon", 0}})
	if err != nil || res.Sessions != 1 || res.Students != 1 || res.Discarded != 1 {
		t.Fatalf("import file: %v %+v", err, res)
	}
	if best := s.Sessions.Latest(rossi.ID, a.ID); best == nil || best.Turns != 1 {
		t.Fatal("imported attempt counts for the assignment")
	}

	res, err = s.RoomTransfer.ImportRoom(teacher, class.ID, room, []ImportMatch{{"Marco", rossi.ID}})
	if err != nil || res.Sessions != 1 || res.Discarded != 1 {
		t.Fatalf("import room: %v %+v", err, res)
	}
	if list, _ := s.Sessions.ListForUser(rossi.ID, 10); len(list) != 2 {
		t.Fatalf("both attempts now belong to the student: %d", len(list))
	}
	if _, err := s.RoomSvc.ForTeacher(teacher, room.ID); !errors.Is(err, ErrRoomNotFound) {
		t.Fatal("importing ends the room")
	}
	if _, err := s.Users.Get(marco.ID); err == nil {
		t.Fatal("the guest account is gone")
	}
}

// A substitute without an account fixes characters, topic and goals: the
// guests go straight to that assignment, like the students of a class.
func TestRoomWithItsOwnAssignment(t *testing.T) {
	s := newTestServer(t)
	config := json.RawMessage(`{"userCharacter":{"title":"Dante Alighieri"},"aiCharacter":{"title":"Virgilio"},"topic":"Inferno"}`)
	opened, err := s.RoomSvc.Open(nil, RoomRequest{Minutes: 60, Assignment: &AssignmentInput{
		Title: ptr("Dante e Virgilio"), AppType: ptr("impersona-tu"), Instructions: ptr("Fai parlare Dante"), Config: &config,
		Goals: &[]string{"Chiede del primo cerchio"}, MaxTurns: ptr(6), AllowLive: ptr(true), Published: ptr(false),
	}})
	if err != nil {
		t.Fatal(err)
	}
	room := opened.Room
	if room.AssignmentID == nil || room.AppType != "impersona-tu" || room.Title != "Dante e Virgilio" || room.Instructions != "Fai parlare Dante" {
		t.Fatalf("room: %+v", room)
	}
	a, _ := s.Assignments.Get(*room.AssignmentID)
	if !a.Published || a.AllowLive || a.MaxTurns != 6 || len(a.Goals) != 1 || !strings.Contains(string(a.Config), "Virgilio") {
		t.Fatalf("the room assignment is published, without live voice: %+v", a)
	}

	guest := joinRoom(t, s, room.Code, "Anna")
	if gr, _ := s.RoomSvc.ForGuest(guest); gr.AssignmentID == nil || *gr.AssignmentID != a.ID {
		t.Fatal("the guest is sent to the room assignment")
	}
	if _, err := s.AssignmentSvc.Visible(guest, a.ID); err != nil {
		t.Fatalf("the guest sees the fixed setup: %v", err)
	}
	if _, err := s.SessionSvc.Start(guest, NewAttempt{AppType: "impersona-tu", AssignmentID: a.ID}); err != nil {
		t.Fatalf("the guest starts it: %v", err)
	}

	if _, err := s.RoomSvc.Open(nil, RoomRequest{Assignment: &AssignmentInput{AppType: ptr("impersona-tu")}}); !errors.Is(err, ErrAssignmentInvalid) {
		t.Fatalf("a room assignment needs a title: %v", err)
	}

	end, _ := s.RoomSvc.ForHost(opened.HostKey)
	if err := s.RoomSvc.End(end); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Assignments.Get(a.ID); err == nil {
		t.Fatal("the room assignment ends with the room")
	}
}

// A path of activities: the guests may work on every step, see them in
// order with their progress, and nothing else of the platform.
func TestRoomWithAPath(t *testing.T) {
	s := newTestServer(t)
	step := func(title, app string) AssignmentInput { return AssignmentInput{Title: ptr(title), AppType: ptr(app)} }
	opened, err := s.RoomSvc.Open(nil, RoomRequest{Minutes: 60, Assignments: []AssignmentInput{
		step("Chi sono?", "personaggio-misterioso"), step("Einstein e Bohr", "doppia-intervista"), step("La bomba", "convinci-tu"),
	}})
	if err != nil {
		t.Fatal(err)
	}
	room, _ := s.RoomSvc.ForHost(opened.HostKey)
	if room.AppType != "personaggio-misterioso" || room.Title != "Chi sono?" {
		t.Fatalf("the first step names the room: %+v", room)
	}
	view, _ := s.RoomSvc.View(room)
	if len(view.Activities) != 3 || view.Activities[1].Title != "Einstein e Bohr" || view.Activities[2].AppType != "convinci-tu" {
		t.Fatalf("the teacher sees the path in order: %+v", view.Activities)
	}

	guest := joinRoom(t, s, room.Code, "Anna")
	second := view.Activities[1].AssignmentID
	if _, err := s.SessionSvc.Start(guest, NewAttempt{AppType: "doppia-intervista", AssignmentID: second}); err != nil {
		t.Fatalf("the guest starts the second step: %v", err)
	}
	gr, _ := s.RoomSvc.ForGuest(guest)
	if len(gr.Activities) != 3 || gr.Activities[1].Status != domain.SessionActive || gr.Activities[0].Status != "" {
		t.Fatalf("the guest sees their progress on each step: %+v", gr.Activities)
	}

	teacher := newRoomTestUser(t, s, "t@x.it", domain.RoleTeacher)
	class, _ := s.ClassSvc.Create(teacher, "3A", "", nil)
	other, _ := s.AssignmentSvc.Create(teacher, class.ID, AssignmentInput{Title: ptr("Altro"), AppType: ptr("convinci-tu")}, "")
	if _, err := s.SessionSvc.Start(guest, NewAttempt{AppType: "convinci-tu", AssignmentID: other.ID}); !errors.Is(err, ErrAssignmentForbidden) {
		t.Fatalf("a guest never reaches assignments outside the room: %v", err)
	}

	tooMany := make([]AssignmentInput, domain.MaxRoomActivities+1)
	for i := range tooMany {
		tooMany[i] = step("Tappa", "wiki-chatbot")
	}
	if _, err := s.RoomSvc.Open(nil, RoomRequest{Assignments: tooMany}); !errors.Is(err, ErrTooManyActivities) {
		t.Fatalf("a path has at most %d steps: %v", domain.MaxRoomActivities, err)
	}
}

// The case met in production: a paid model chosen for rooms while FreeOnly
// is on leaves the guests without a model. The teacher's view and the
// admin page must say so.
func TestRoomAIReadiness(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, &fakeProvider{})
	cfg := DefaultRooms()
	cfg.Tasks = map[string][]RouteTarget{TaskChat: {{1, "deepseek-chat"}}}
	s.Settings.SaveRooms(cfg)
	opened, _ := s.RoomSvc.Open(nil, RoomRequest{Assignment: &AssignmentInput{Title: ptr("Prova"), AppType: ptr("wiki-chatbot")}})
	room, _ := s.RoomSvc.ForHost(opened.HostKey)

	if view, _ := s.RoomSvc.View(room); view.AIReady {
		t.Fatal("a paid model with FreeOnly leaves the room without chat")
	}
	if got := s.Gateway.RoomTargets()[TaskChat]; len(got) != 0 {
		t.Fatalf("the paid model is left out: %+v", got)
	}

	cfg.FreeOnly = false
	s.Settings.SaveRooms(cfg)
	if view, _ := s.RoomSvc.View(room); !view.AIReady {
		t.Fatal("without FreeOnly the room uses its model")
	}
	cfg.FreeOnly = true
	cfg.Tasks = map[string][]RouteTarget{TaskChat: {{1, "deepseek-chat"}, {1, "llama:free"}}}
	s.Settings.SaveRooms(cfg)
	if got := s.Gateway.RoomTargets()[TaskChat]; len(got) != 1 || got[0].Model != "llama:free" {
		t.Fatalf("only the free model is kept: %+v", got)
	}
}
