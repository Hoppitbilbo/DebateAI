package httpapi

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// usernameClassAPI is a server with a username class and a standard one.
func usernameClassAPI(t *testing.T) (s *testAPI, handler http.Handler, class, standard *domain.Class) {
	t.Helper()
	s = newTestAPI(t)
	id, err := s.Accounts.CreateUser("prof@test.it", "Prof", "password123", domain.RoleTeacher, "it")
	if err != nil {
		t.Fatal(err)
	}
	teacher, _ := s.Users.Get(id)
	if class, err = s.ClassSvc.Create(teacher, app.NewClass{Name: "3A", EnrollmentMode: domain.EnrollUsername}); err != nil {
		t.Fatal(err)
	}
	if standard, err = s.ClassSvc.Create(teacher, app.NewClass{Name: "Email"}); err != nil {
		t.Fatal(err)
	}
	return s, s.Handler(), class, standard
}

// rawRequest serves one request and returns the recorder, for headers.
func rawRequest(handler http.Handler, method, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	return w
}

func TestClassInviteHTTP(t *testing.T) {
	s, handler, class, standard := usernameClassAPI(t)
	w := rawRequest(handler, "GET", "/api/auth/class-invite/"+class.JoinCode, "")
	if w.Code != 200 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("invite: %d %q", w.Code, w.Header().Get("Cache-Control"))
	}
	body := w.Body.String()
	if !strings.Contains(body, `"className":"3A"`) || !strings.Contains(body, `"enrollmentMode":"username"`) || strings.Contains(body, "prof") {
		t.Fatalf("only the class name and mode: %s", body)
	}
	for _, code := range []string{standard.JoinCode, "NOPE"} {
		if w := rawRequest(handler, "GET", "/api/auth/class-invite/"+code, ""); w.Code != 404 {
			t.Fatalf("%s: %d", code, w.Code)
		}
	}
	g := s.Settings.General()
	g.AllowJoinByCode = false
	if err := s.Settings.SaveGeneral(g); err != nil {
		t.Fatal(err)
	}
	if w := rawRequest(handler, "GET", "/api/auth/class-invite/"+class.JoinCode, ""); w.Code != 404 {
		t.Fatalf("joining by code disabled: %d", w.Code)
	}
}

func TestRegisterClassHTTP(t *testing.T) {
	s, handler, class, standard := usernameClassAPI(t)
	c := newHandlerClient(t, handler)
	// A forged role, e-mail or name is ignored.
	var u domain.User
	in := map[string]string{"code": class.JoinCode, "username": "Anna", "password": "password123", "locale": "en",
		"role": "admin", "email": "anna@test.it", "name": "Fake"}
	if code := c.do("POST", "/api/auth/register-class", in, &u); code != 201 {
		t.Fatalf("register: %d", code)
	}
	if u.Username != "anna" || u.Name != "anna" || u.Role != domain.RoleStudent || u.Email != "" {
		t.Fatalf("account: %+v", u)
	}
	var me meResponse
	if c.do("GET", "/api/auth/me", nil, &me); me.User == nil || me.User.ID != u.ID {
		t.Fatal("the student is logged in by the cookie")
	}
	if !s.Classes.IsMember(class.ID, u.ID) {
		t.Fatal("the student is in the class")
	}

	w := rawRequest(handler, "POST", "/api/auth/register-class", `{"code":"`+class.JoinCode+`","username":"ANNA","password":"password123"}`)
	if w.Code != 409 || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("username taken: %d %q", w.Code, w.Header().Get("Cache-Control"))
	}
	for name, tc := range map[string]struct {
		body string
		want int
	}{
		"short password":  {`{"code":"` + class.JoinCode + `","username":"marco","password":"short"}`, 400},
		"bad username":    {`{"code":"` + class.JoinCode + `","username":"m a","password":"password123"}`, 400},
		"not json":        {`nope`, 400},
		"standard class":  {`{"code":"` + standard.JoinCode + `","username":"marco","password":"password123"}`, 404},
		"wrong link code": {`{"code":"WRONG","username":"marco","password":"password123"}`, 404},
	} {
		if w := rawRequest(handler, "POST", "/api/auth/register-class", tc.body); w.Code != tc.want {
			t.Errorf("%s: %d, want %d", name, w.Code, tc.want)
		}
	}

	g := s.Settings.General()
	g.AllowJoinByCode = false
	if err := s.Settings.SaveGeneral(g); err != nil {
		t.Fatal(err)
	}
	if w := rawRequest(handler, "POST", "/api/auth/register-class", `{"code":"`+class.JoinCode+`","username":"marco","password":"password123"}`); w.Code != 403 {
		t.Fatalf("enrollment by link disabled: %d", w.Code)
	}
}

func TestRoomGuestCannotRegisterFromAClassLink(t *testing.T) {
	s, handler, class, _ := usernameClassAPI(t)
	room, err := s.RoomSvc.Open(nil, app.RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	guest := newHandlerClient(t, handler)
	if code := guest.do("POST", "/api/guest/join", map[string]string{"code": room.Room.Code, "nickname": "volpe", "avatar": "fox"}, nil); code != 200 {
		t.Fatalf("guest join: %d", code)
	}
	if code := guest.do("POST", "/api/auth/register-class", map[string]string{"code": class.JoinCode, "username": "volpe", "password": "password123"}, nil); code != 403 {
		t.Fatalf("a guest cannot turn into an account: %d", code)
	}
	if _, err := s.Users.GetByUsername("volpe"); err == nil {
		t.Fatal("no account may be created")
	}
}

func TestRegisterClassLimitPerLink(t *testing.T) {
	_, handler, class, _ := usernameClassAPI(t)
	c := newHandlerClient(t, handler)
	short := map[string]string{"code": class.JoinCode, "username": "x", "password": "short"}
	for i := 0; i < 120; i++ {
		if code := c.do("POST", "/api/auth/register-class", short, nil); code != 400 {
			t.Fatalf("attempt %d: %d", i, code)
		}
	}
	if code := c.do("POST", "/api/auth/register-class", short, nil); code != 429 {
		t.Fatalf("link cap: %d", code)
	}
}

func TestLoginWithIdentifierHTTP(t *testing.T) {
	s, handler, class, _ := usernameClassAPI(t)
	if _, err := s.Accounts.RegisterClassStudent(app.ClassEnrollment{Code: class.JoinCode, Username: "anna", Password: "password123"}); err != nil {
		t.Fatal(err)
	}
	login := func(in map[string]string) int {
		return newHandlerClient(t, handler).do("POST", "/api/auth/login", in, nil)
	}
	for name, tc := range map[string]struct {
		in   map[string]string
		want int
	}{
		"username":             {map[string]string{"identifier": " Anna ", "password": "password123"}, 200},
		"e-mail as identifier": {map[string]string{"identifier": "PROF@test.it", "password": "password123"}, 200},
		"old client e-mail":    {map[string]string{"email": "prof@test.it", "password": "password123"}, 200},
		"both, same":           {map[string]string{"identifier": "prof@test.it", "email": "prof@test.it", "password": "password123"}, 200},
		"both, different":      {map[string]string{"identifier": "anna", "email": "prof@test.it", "password": "password123"}, 400},
		"wrong password":       {map[string]string{"identifier": "anna", "password": "wrong-password"}, 401},
		"unknown account":      {map[string]string{"identifier": "nobody", "password": "password123"}, 401},
		"empty":                {map[string]string{"password": "password123"}, 401},
	} {
		if got := login(tc.in); got != tc.want {
			t.Errorf("%s: %d, want %d", name, got, tc.want)
		}
	}
	u, _ := s.Users.GetByUsername("anna")
	if err := s.Users.Update(u.ID, domain.UserPatch{Active: ptr(false)}); err != nil {
		t.Fatal(err)
	}
	if got := login(map[string]string{"identifier": "anna", "password": "password123"}); got != 403 {
		t.Fatalf("disabled: %d", got)
	}
	if got := login(map[string]string{"identifier": "anna", "password": "wrong-password"}); got != 401 {
		t.Fatalf("a disabled account is not revealed: %d", got)
	}
}

// A class of 40 on one school IP, some mistyping their password a few
// times, all get in; one account hammered from there is stopped alone.
func TestFortyStudentsOnOneIPAllLogIn(t *testing.T) {
	s, handler, class, _ := usernameClassAPI(t)
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	for i := 0; i < 40; i++ {
		if _, _, err := s.Users.CreateStudentInClass(domain.NewClassStudent{Code: class.JoinCode, Username: fmt.Sprintf("stud%02d", i),
			Name: "s", PasswordHash: string(hash), Locale: "it"}); err != nil {
			t.Fatal(err)
		}
	}
	for i := 0; i < 40; i++ {
		c := newHandlerClient(t, handler)
		name := fmt.Sprintf("stud%02d", i)
		for j := 0; j < i%4; j++ { // up to three mistakes
			if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": name, "password": "wrong-password"}, nil); code != 401 {
				t.Fatalf("%s mistake %d: %d", name, j, code)
			}
		}
		if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": name, "password": "password123"}, nil); code != 200 {
			t.Fatalf("%s: %d", name, code)
		}
		if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": name, "password": "password123"}, nil); code != 200 {
			t.Fatalf("%s logs in again: %d", name, code)
		}
	}
	attacker := newHandlerClient(t, handler)
	for i := 0; i < 20; i++ {
		attacker.do("POST", "/api/auth/login", map[string]string{"identifier": "stud00", "password": "guess"}, nil)
	}
	if code := attacker.do("POST", "/api/auth/login", map[string]string{"identifier": "stud00", "password": "password123"}, nil); code != 429 {
		t.Fatalf("one identifier from one IP is capped: %d", code)
	}
	if code := newHandlerClient(t, handler).do("POST", "/api/auth/login", map[string]string{"identifier": "stud01", "password": "password123"}, nil); code != 200 {
		t.Fatalf("the rest of the class still logs in: %d", code)
	}
}

// A logged-in student joins with the long code of a username class.
func TestJoinClassWithTheLongCode(t *testing.T) {
	s, handler, class, _ := usernameClassAPI(t)
	if _, err := s.Accounts.CreateUser("stud@test.it", "Stud", "password123", domain.RoleStudent, "it"); err != nil {
		t.Fatal(err)
	}
	c := newHandlerClient(t, handler)
	if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": "stud@test.it", "password": "password123"}, nil); code != 200 {
		t.Fatalf("login: %d", code)
	}
	var out joinClassResponse
	if code := c.do("POST", "/api/classes/join", map[string]string{"code": strings.ToLower(class.JoinCode)}, &out); code != 200 || out.ClassID != class.ID {
		t.Fatalf("join: %d %+v", code, out)
	}
	stud, _ := s.Users.GetByEmail("stud@test.it")
	if !s.Classes.IsMember(class.ID, stud.ID) || s.Classes.Teaches(class.ID, stud.ID) {
		t.Fatal("joined as student")
	}
}
