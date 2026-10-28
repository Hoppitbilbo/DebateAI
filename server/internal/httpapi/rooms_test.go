package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// A substitute teacher without an account opens a room in a school lab:
// every computer reaches the server from the same IP.
func TestEndToEndRoomInSchoolLab(t *testing.T) {
	mock := mockAI(t)
	defer mock.Close()
	dir := t.TempDir()
	cfg := app.Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := app.OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	srv := httptest.NewServer(NewServer(cfg, app.NewServices(cfg, db), nil).Handler())
	defer srv.Close()
	const labIP = "93.40.1.2"
	inLab := func() *client {
		c := newClient(t, srv.URL)
		c.headers = map[string]string{"X-Forwarded-For": labIP}
		return c
	}

	// The admin gives rooms their own free model; everyone else uses the paid one.
	admin := newClient(t, srv.URL)
	admin.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil)
	var prov app.ProviderView
	admin.do("POST", "/api/admin/providers", map[string]string{"name": "Mock", "kind": "openai", "baseUrl": mock.URL + "/v1", "apiKey": "k"}, &prov)
	admin.do("PUT", "/api/admin/settings/routing", map[string]any{"strategy": "ordered", "tasks": map[string]any{
		"chat": []map[string]any{{"providerId": prov.ID, "model": "paid-model"}},
	}}, nil)
	rooms := app.DefaultRooms()
	rooms.Tasks = map[string][]app.RouteTarget{app.TaskChat: {{ProviderID: prov.ID, Model: "free-model"}}}
	if code := admin.do("PUT", "/api/admin/settings/rooms", rooms, nil); code != 200 {
		t.Fatalf("save room settings: %d", code)
	}
	var pub publicConfigResponse
	admin.do("GET", "/api/public/config", nil, &pub)
	if !pub.RoomsEnabled || !pub.AnonymousRooms || pub.RoomMaxMinutes != 120 {
		t.Fatalf("public config: %+v", pub)
	}

	// The substitute opens the room without an account.
	host := inLab()
	var opened app.OpenedRoom
	if code := host.do("POST", "/api/rooms", map[string]any{"title": "Napoleone", "appType": "wiki-chatbot", "minutes": 90}, &opened); code != 201 {
		t.Fatalf("open room: %d", code)
	}
	roomPath := fmt.Sprintf("/api/rooms/%d", opened.Room.ID)
	host.headers["X-Room-Key"] = opened.HostKey

	// 30 students on the same IP join; a few typos do not lock anyone out.
	for i := 0; i < 5; i++ {
		if code := inLab().do("GET", "/api/guest/rooms/ZZZZZZ", nil, nil); code != 404 {
			t.Fatalf("wrong code: %d", code)
		}
	}
	var students []*client
	for i := 0; i < 30; i++ {
		c := inLab()
		var u domain.User
		if code := c.do("POST", "/api/guest/join", map[string]string{"code": opened.Room.Code, "nickname": fmt.Sprintf("Studente %d", i), "avatar": "fox"}, &u); code != 200 || !u.IsGuest() {
			t.Fatalf("join %d: %d %+v", i, code, u)
		}
		students = append(students, c)
	}
	anna := students[0]
	if code := inLab().do("POST", "/api/guest/join", map[string]string{"code": opened.Room.Code, "nickname": "studente 0", "avatar": "owl"}, nil); code != 409 {
		t.Fatalf("taken nickname: %d", code)
	}

	// Students chat with the room model, from the same IP, without limits per network.
	var sess domain.SessionSummary
	anna.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot", "title": "Napoleone"}, &sess)
	for _, c := range students[:10] {
		var gen struct{ Model string }
		if code := c.do("POST", "/api/ai/generate", map[string]any{"messages": []map[string]string{{"role": "user", "content": "ciao"}}}, &gen); code != 200 || gen.Model != "free-model" {
			t.Fatalf("guest chat: %d %+v", code, gen)
		}
	}
	anna.do("PUT", fmt.Sprintf("/api/sessions/%d/transcript", sess.ID), map[string]any{"messages": []map[string]string{{"role": "user", "content": "Perché la Russia?"}}}, nil)
	var me app.GuestRoom
	if code := anna.do("GET", "/api/guest/room", nil, &me); code != 200 || me.Nickname != "Studente 0" || me.Title != "Napoleone" {
		t.Fatalf("guest room: %d %+v", code, me)
	}

	// Guests cannot do what accounts do.
	if code := anna.do("PATCH", "/api/auth/me", map[string]string{"name": "x"}, nil); code != 403 {
		t.Fatalf("guest profile: %d", code)
	}
	if code := anna.do("POST", "/api/ai/live/token", map[string]any{}, nil); code != 403 {
		t.Fatalf("guest live: %d", code)
	}
	if code := anna.do("POST", "/api/rooms", map[string]any{"appType": "wiki-chatbot"}, nil); code != 403 {
		t.Fatalf("guest opens room: %d", code)
	}
	if code := anna.do("GET", roomPath, nil, nil); code != 403 {
		t.Fatalf("guest manages room: %d", code)
	}

	// The host sees the lobby only with the key.
	var view app.RoomView
	if code := host.do("GET", roomPath, nil, &view); code != 200 || len(view.Guests) != 30 || view.Guests[0].Turns != 1 {
		t.Fatalf("lobby: %d %d", code, len(view.Guests))
	}
	if code := inLab().do("GET", roomPath, nil, nil); code != 404 {
		t.Fatalf("lobby without key: %d", code)
	}
	if code := host.do("GET", fmt.Sprintf("%s/sessions/%d", roomPath, sess.ID), nil, nil); code != 200 {
		t.Fatalf("host reads a conversation: %d", code)
	}

	// Anna changes computer: the teacher gives her a PIN.
	var pin rejoinPINResponse
	host.do("POST", fmt.Sprintf("%s/guests/%d/pin", roomPath, view.Guests[0].UserID), nil, &pin)
	other := inLab()
	if code := other.do("POST", "/api/guest/rejoin", map[string]string{"code": opened.Room.Code, "nickname": "studente 0", "pin": pin.PIN}, nil); code != 200 {
		t.Fatalf("rejoin: %d", code)
	}
	if code := other.do("GET", "/api/guest/room", nil, &me); code != 200 || me.Nickname != "Studente 0" {
		t.Fatalf("rejoined: %d", code)
	}

	// Exports, then a teacher with an account can preview the file in a class.
	if code := host.do("GET", roomPath+"/export.xlsx", nil, nil); code != 200 {
		t.Fatalf("xlsx: %d", code)
	}
	var cls domain.Class
	admin.do("POST", "/api/classes", map[string]string{"name": "3A"}, &cls)
	var preview app.RoomPreview
	if code := admin.do("POST", fmt.Sprintf("/api/classes/%d/room-import/preview", cls.ID), map[string]string{"file": exportFile(t, host, roomPath)}, &preview); code != 200 || len(preview.Guests) != 30 {
		t.Fatalf("preview: %d %+v", code, preview.Guests)
	}

	if code := inLab().do("GET", "/api/cron/purge-rooms", nil, nil); code != 401 {
		t.Fatalf("cron without secret: %d", code)
	}

	// Ending the room logs every guest out and deletes the data.
	if code := host.do("DELETE", roomPath, nil, nil); code != 200 {
		t.Fatalf("end: %d", code)
	}
	if code := anna.do("GET", "/api/guest/room", nil, nil); code != 401 {
		t.Fatalf("guest after the end: %d", code)
	}
	if code := host.do("GET", roomPath, nil, nil); code != 404 {
		t.Fatalf("room after the end: %d", code)
	}
}

// exportFile downloads the encrypted export of a room as text.
func exportFile(t *testing.T, c *client, roomPath string) string {
	t.Helper()
	var raw map[string]any
	if code := c.do("GET", roomPath+"/export.aula", nil, &raw); code != 200 || raw["data"] == nil {
		t.Fatalf("export file: %d", code)
	}
	b, _ := json.Marshal(raw)
	return string(b)
}

func TestWrongRoomCodesAreLimitedPerNetwork(t *testing.T) {
	api := newTestAPI(t)
	srv := httptest.NewServer(api.Handler())
	defer srv.Close()
	opened, err := api.RoomSvc.Open(nil, app.RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	bot := newClient(t, srv.URL)
	bot.headers = map[string]string{"X-Forwarded-For": "6.6.6.6"}
	for i := 0; i < wrongRoomCodesLimit; i++ {
		bot.do("GET", "/api/guest/rooms/AAAAAA", nil, nil)
	}
	if code := bot.do("GET", "/api/guest/rooms/"+opened.Room.Code, nil, nil); code != 429 {
		t.Fatalf("a network guessing codes is stopped: %d", code)
	}
	school := newClient(t, srv.URL)
	school.headers = map[string]string{"X-Forwarded-For": "93.40.1.2"}
	if code := school.do("GET", "/api/guest/rooms/"+opened.Room.Code, nil, nil); code != 200 {
		t.Fatalf("other networks are not affected: %d", code)
	}
}
