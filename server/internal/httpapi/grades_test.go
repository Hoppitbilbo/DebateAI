package httpapi

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"github.com/xuri/excelize/v2"
)

func TestGradesExport(t *testing.T) {
	api := newTestAPI(t)
	srv := httptest.NewServer(api.Handler())
	defer srv.Close()
	admin := newClient(t, srv.URL)
	admin.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123", "locale": "it"}, nil)
	me, _ := api.Users.GetByEmail("admin@test.it")

	studID, _ := api.Accounts.CreateUser("sara@test.it", "Sara Bianchi", "", domain.RoleStudent, "it")
	stud, _ := api.Users.Get(studID)
	class, _ := api.ClassSvc.Create(me, "3A", "", nil)
	api.Classes.AddMember(class.ID, studID, domain.RoleStudent)
	title, appType := "Napoleone", "wiki-chatbot"
	a, err := api.AssignmentSvc.Create(me, class.ID, app.AssignmentInput{Title: &title, AppType: &appType}, srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	ss, _ := api.SessionSvc.Start(stud, app.NewAttempt{AppType: appType, AssignmentID: a.ID})
	conv, teacher := 7, 9
	d, _ := api.Sessions.Detail(ss.ID)
	api.Sessions.Complete(d.ID, domain.SessionCompletion{Reflection: "r", ScoreConversation: &conv})
	if _, err := api.SessionSvc.GiveFeedback(me, ss.ID, domain.TeacherFeedback{Text: "Bene", Score: &teacher}, srv.URL); err != nil {
		t.Fatal(err)
	}

	for _, path := range []string{fmtPath("/api/classes/%d/grades.xlsx", class.ID), fmtPath("/api/assignments/%d/grades.xlsx", a.ID)} {
		req, _ := http.NewRequest("GET", srv.URL+path, nil)
		resp, err := admin.http.Do(req)
		if err != nil || resp.StatusCode != 200 {
			t.Fatalf("%s: %v %d", path, err, resp.StatusCode)
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		f, err := excelize.OpenReader(bytes.NewReader(body))
		if err != nil {
			t.Fatalf("%s is not an xlsx: %v", path, err)
		}
		rows, _ := f.GetRows("Sheet1")
		if len(rows) != 2 || rows[0][0] != "Studente" || rows[0][7] != "Voto docente" {
			t.Fatalf("%s header: %v", path, rows)
		}
		if r := rows[1]; r[0] != "Sara Bianchi" || r[2] != "Napoleone" || r[3] != "Completata" || r[5] != "7" || r[7] != "9" || r[8] != "1" {
			t.Fatalf("%s row: %v", path, r)
		}
	}

	other := newClient(t, srv.URL)
	api.Accounts.CreateUser("prof@test.it", "Prof", "password123", domain.RoleTeacher, "it")
	other.do("POST", "/api/auth/login", map[string]string{"email": "prof@test.it", "password": "password123"}, nil)
	if code := other.do("GET", fmtPath("/api/classes/%d/grades.xlsx", class.ID), nil, nil); code != 403 {
		t.Fatalf("another teacher must not export the class: %d", code)
	}
}
