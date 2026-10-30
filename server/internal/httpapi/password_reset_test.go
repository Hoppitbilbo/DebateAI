package httpapi

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// recoveryAPI is a username class with a student, and logged-in clients for
// its owner, a co-teacher, another teacher, an admin and the student.
type recoveryAPI struct {
	s                                        *testAPI
	handler                                  http.Handler
	class                                    *domain.Class
	student                                  *domain.User
	owner, coTeacher, stranger, admin, pupil *client
}

func newRecoveryAPI(t *testing.T) *recoveryAPI {
	t.Helper()
	s, handler, class, _ := usernameClassAPI(t)
	f := &recoveryAPI{s: s, handler: handler, class: class}
	login := func(identifier string) *client {
		c := newHandlerClient(t, handler)
		if code := c.do("POST", "/api/auth/login", map[string]string{"identifier": identifier, "password": "password123"}, nil); code != 200 {
			t.Fatalf("login %s: %d", identifier, code)
		}
		return c
	}
	for email, role := range map[string]string{"co@test.it": domain.RoleTeacher, "other@test.it": domain.RoleTeacher, "admin@test.it": domain.RoleAdmin} {
		if _, err := s.Accounts.CreateUser(email, email, "password123", role, "it"); err != nil {
			t.Fatal(err)
		}
	}
	co, _ := s.Users.GetByEmail("co@test.it")
	if err := s.Classes.AddMember(class.ID, co.ID, domain.RoleTeacher); err != nil {
		t.Fatal(err)
	}
	var err error
	if f.student, err = s.Accounts.RegisterClassStudent(app.ClassEnrollment{Code: class.JoinCode, Username: "anna", Password: "password123"}); err != nil {
		t.Fatal(err)
	}
	f.owner, f.coTeacher, f.stranger, f.admin, f.pupil = login("prof@test.it"), login("co@test.it"), login("other@test.it"), login("admin@test.it"), login("anna")
	return f
}

func (f *recoveryAPI) resetPath(userID int64) string {
	return fmt.Sprintf("/api/classes/%d/members/%d/password-reset", f.class.ID, userID)
}

// issue asks for a link as c and returns its token.
func (f *recoveryAPI) issue(t *testing.T, c *client) string {
	t.Helper()
	var link app.ResetLink
	if code := c.do("POST", f.resetPath(f.student.ID), nil, &link); code != 200 || link.ExpiresAt == "" {
		t.Fatalf("issue: %d %+v", code, link)
	}
	_, tok, ok := strings.Cut(link.URL, "/reset-password?token=")
	if !ok || tok == "" {
		t.Fatalf("url %q", link.URL)
	}
	return tok
}

func TestMemberPasswordResetPermissionsHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	for name, tc := range map[string]struct {
		c    *client
		want int
	}{
		"co-teacher":               {f.coTeacher, 403},
		"teacher of another class": {f.stranger, 403},
		"the student":              {f.pupil, 403},
		"owner":                    {f.owner, 200},
		"admin":                    {f.admin, 200},
	} {
		if got := tc.c.do("POST", f.resetPath(f.student.ID), nil, nil); got != tc.want {
			t.Errorf("%s: %d, want %d", name, got, tc.want)
		}
	}
	w := rawRequest(f.handler, "POST", f.resetPath(f.student.ID), "")
	if w.Code != 401 {
		t.Fatalf("anonymous: %d", w.Code)
	}
	if got := f.owner.do("POST", f.resetPath(9999), nil, nil); got != 404 {
		t.Fatalf("not a member: %d", got)
	}
	withEmail, _ := f.s.Accounts.CreateUser("mail@test.it", "Mail", "password123", domain.RoleStudent, "it")
	f.s.Classes.AddMember(f.class.ID, withEmail, domain.RoleStudent)
	if got := f.owner.do("POST", f.resetPath(withEmail), nil, nil); got != 409 {
		t.Fatalf("account with e-mail: %d", got)
	}
	f.s.Classes.Update(f.class.ID, domain.ClassPatch{Archived: ptr(true)})
	if got := f.owner.do("POST", f.resetPath(f.student.ID), nil, nil); got != 409 {
		t.Fatalf("archived class: %d", got)
	}
}

func TestMemberPasswordResetIsNotCached(t *testing.T) {
	f := newRecoveryAPI(t)
	req, _ := http.NewRequest("POST", f.owner.base+f.resetPath(f.student.ID), nil)
	resp, err := f.owner.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != 200 || resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("%d %q", resp.StatusCode, resp.Header.Get("Cache-Control"))
	}
}

func TestClassDetailTellsWhoCanBeReset(t *testing.T) {
	f := newRecoveryAPI(t)
	for name, tc := range map[string]struct {
		c    *client
		want bool
	}{"owner": {f.owner, true}, "admin": {f.admin, true}, "co-teacher": {f.coTeacher, false}} {
		var detail struct{ Members []domain.Member }
		if code := tc.c.do("GET", fmt.Sprintf("/api/classes/%d", f.class.ID), nil, &detail); code != 200 {
			t.Fatalf("%s: %d", name, code)
		}
		for _, m := range detail.Members {
			if m.CanResetPassword != (tc.want && m.UserID == f.student.ID) {
				t.Errorf("%s sees %d canResetPassword=%v", name, m.UserID, m.CanResetPassword)
			}
		}
	}
}

func TestAssistedResetHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	tok := f.issue(t, f.owner)
	browser := newHandlerClient(t, f.handler)
	if code := browser.do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "short"}, nil); code != 400 {
		t.Fatalf("weak password: %d", code)
	}
	var u domain.User
	if code := browser.do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "newpassword1"}, &u); code != 200 || u.ID != f.student.ID {
		t.Fatalf("reset: %d", code)
	}
	var me meResponse
	if browser.do("GET", "/api/auth/me", nil, &me); me.User == nil || me.User.ID != f.student.ID {
		t.Fatal("the browser that chose the password is logged in, as for an e-mail reset")
	}
	me = meResponse{}
	if f.pupil.do("GET", "/api/auth/me", nil, &me); me.User != nil {
		t.Fatal("the student's other logins must end")
	}
	login := func(password string) int {
		return newHandlerClient(t, f.handler).do("POST", "/api/auth/login", map[string]string{"identifier": "anna", "password": password}, nil)
	}
	if login("password123") != 401 || login("newpassword1") != 200 {
		t.Fatal("old password refused, new one accepted")
	}
	if code := browser.do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "another-pass"}, nil); code != 404 {
		t.Fatalf("reused link: %d", code)
	}
}

func TestAssistedResetAfterOwnerChangeHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	tok := f.issue(t, f.owner)
	prof, _ := f.s.Users.GetByEmail("prof@test.it")
	if err := f.s.Users.Delete(prof.ID); err != nil { // the class loses its owner
		t.Fatal(err)
	}
	if code := newHandlerClient(t, f.handler).do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "newpassword1"}, nil); code != 404 {
		t.Fatalf("owner gone: %d", code)
	}
	second := f.issue(t, f.admin)
	f.s.Classes.RemoveMember(f.class.ID, f.student.ID)
	if code := newHandlerClient(t, f.handler).do("POST", "/api/auth/reset", map[string]string{"token": second, "password": "newpassword1"}, nil); code != 404 {
		t.Fatalf("student removed: %d", code)
	}
}

func TestConcurrentResetsHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	tok := f.issue(t, f.owner)
	var wg sync.WaitGroup
	codes := make([]int, 2)
	for i := range codes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			w := rawRequest(f.handler, "POST", "/api/auth/reset", fmt.Sprintf(`{"token":%q,"password":"newpassword%d"}`, tok, i))
			codes[i] = w.Code
		}(i)
	}
	wg.Wait()
	if !(codes[0] == 200 && codes[1] == 404 || codes[0] == 404 && codes[1] == 200) {
		t.Fatalf("one reset only: %v", codes)
	}
}

func TestForgotByUsernameSendsNothingHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	tok := f.issue(t, f.owner)
	for _, body := range []string{`{"email":"anna"}`, `{"email":""}`, `{}`} {
		if w := rawRequest(f.handler, "POST", "/api/auth/forgot", body); w.Code != 200 {
			t.Fatalf("%s: %d, the answer never tells", body, w.Code)
		}
	}
	// Nothing was issued for the account: the owner's link still works.
	if code := newHandlerClient(t, f.handler).do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "newpassword1"}, nil); code != 200 {
		t.Fatalf("owner's link: %d", code)
	}
}

func TestChangePasswordHTTP(t *testing.T) {
	f := newRecoveryAPI(t)
	other := newHandlerClient(t, f.handler)
	other.do("POST", "/api/auth/login", map[string]string{"identifier": "anna", "password": "password123"}, nil)
	tok := f.issue(t, f.owner)

	bad := map[string]string{"name": "Anna B", "locale": "en", "currentPassword": "wrong", "newPassword": "newpassword1"}
	if code := f.pupil.do("PATCH", "/api/auth/me", bad, nil); code != 400 {
		t.Fatalf("wrong current password: %d", code)
	}
	if u, _ := f.s.Users.Get(f.student.ID); u.Name != "anna" || u.Locale != "it" {
		t.Fatalf("nothing may be saved: %+v", u)
	}
	good := map[string]string{"name": "Anna B", "currentPassword": "password123", "newPassword": "newpassword1"}
	var u domain.User
	if code := f.pupil.do("PATCH", "/api/auth/me", good, &u); code != 200 || u.Name != "Anna B" {
		t.Fatalf("change: %d %+v", code, u)
	}
	var me meResponse
	if f.pupil.do("GET", "/api/auth/me", nil, &me); me.User == nil {
		t.Fatal("this browser gets a new session")
	}
	me = meResponse{}
	if other.do("GET", "/api/auth/me", nil, &me); me.User != nil {
		t.Fatal("other logins must end")
	}
	if code := newHandlerClient(t, f.handler).do("POST", "/api/auth/reset", map[string]string{"token": tok, "password": "another-pass"}, nil); code != 404 {
		t.Fatalf("reset links must be invalidated: %d", code)
	}
}
