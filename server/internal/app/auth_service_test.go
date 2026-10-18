package app

import (
	"errors"
	"regexp"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// captureMailer records the mails instead of sending them.
type captureMailer struct {
	mu     sync.Mutex
	bodies []string
}

func (m *captureMailer) sendMail(to, subject, body string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.bodies = append(m.bodies, body)
	return nil
}

func (m *captureMailer) sendMailAsync(to, subject, body string) { _ = m.sendMail(to, subject, body) }

func (m *captureMailer) lastToken(t *testing.T) string {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	if len(m.bodies) == 0 {
		t.Fatal("no mail sent")
	}
	match := regexp.MustCompile(`token=([A-Za-z0-9_-]+)`).FindStringSubmatch(m.bodies[len(m.bodies)-1])
	if match == nil {
		t.Fatal("no token in mail")
	}
	return match[1]
}

func newAuthService(t *testing.T) (*authService, *captureMailer) {
	s := newTestServer(t)
	m := &captureMailer{}
	a := *s.accounts
	a.mail = m
	return &a, m
}

func TestLoginErrors(t *testing.T) {
	a, _ := newAuthService(t)
	id, err := a.CreateUser(" Anna@X.it ", "", "password123", domain.RoleStudent, "it")
	if err != nil {
		t.Fatal(err)
	}
	if u, err := a.Login("anna@x.it", "password123"); err != nil || u.ID != id || u.Name != "anna" {
		t.Fatalf("login: %v %+v", err, u)
	}
	if _, err := a.Login("anna@x.it", "wrong"); !errors.Is(err, errInvalidCredentials) {
		t.Fatalf("wrong password: %v", err)
	}
	if _, err := a.Login("nobody@x.it", "password123"); !errors.Is(err, errInvalidCredentials) {
		t.Fatalf("unknown user: %v", err)
	}
	off := false
	a.users.Update(id, domain.UserPatch{Active: &off})
	if _, err := a.Login("anna@x.it", "password123"); !errors.Is(err, errAccountDisabled) {
		t.Fatalf("disabled: %v", err)
	}
}

func TestCreateUserValidation(t *testing.T) {
	a, _ := newAuthService(t)
	for _, c := range []struct{ email, password, role string }{
		{"not-an-email", "password123", domain.RoleStudent},
		{"a@x.it", "short", domain.RoleStudent},
		{"a@x.it", "password123", "boss"},
	} {
		if _, err := a.CreateUser(c.email, "", c.password, c.role, "it"); !isInvalid(err) {
			t.Errorf("%+v: expected invalid input, got %v", c, err)
		}
	}
	a.CreateUser("a@x.it", "", "", domain.RoleStudent, "it")
	if _, err := a.CreateUser("A@x.it", "", "", domain.RoleStudent, "it"); !isInvalid(err) || !errors.Is(err, domain.ErrEmailTaken) {
		t.Fatalf("duplicate: %v", err)
	}
}

func TestPasswordResetFlow(t *testing.T) {
	a, m := newAuthService(t)
	id, _ := a.CreateUser("a@x.it", "Anna", "password123", domain.RoleStudent, "it")
	tok, _, _ := a.StartSession(id)

	a.RequestReset("nobody@x.it", "http://site")
	if len(m.bodies) != 0 {
		t.Fatal("no mail for unknown addresses")
	}
	a.RequestReset("a@x.it", "http://site")
	reset := m.lastToken(t)

	if _, err := a.ResetPassword(reset, "short"); !isInvalid(err) {
		t.Fatalf("weak password: %v", err)
	}
	if _, err := a.ResetPassword(reset, "newpassword1"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.ResetPassword(reset, "another-pass"); !errors.Is(err, errInvalidInvite) {
		t.Fatalf("link must be single use: %v", err)
	}
	if a.UserForToken(tok) != nil {
		t.Fatal("old logins must end after a reset")
	}
	if _, err := a.Login("a@x.it", "newpassword1"); err != nil {
		t.Fatalf("new password: %v", err)
	}
}

func TestUpdateProfilePassword(t *testing.T) {
	a, _ := newAuthService(t)
	id, _ := a.CreateUser("a@x.it", "Anna", "password123", domain.RoleStudent, "it")
	u, _ := a.users.Get(id)
	name := "Anna B"
	if _, err := a.UpdateProfile(u, ProfileChange{Name: &name, CurrentPassword: "nope", NewPassword: "newpassword1"}); !errors.Is(err, errWrongPassword) {
		t.Fatalf("wrong current password: %v", err)
	}
	got, err := a.UpdateProfile(u, ProfileChange{CurrentPassword: "password123", NewPassword: "newpassword1"})
	if err != nil || got.Name != "Anna B" {
		t.Fatalf("update: %v %+v", err, got)
	}
	if _, err := a.Login("a@x.it", "newpassword1"); err != nil {
		t.Fatal("password not changed")
	}
}

func TestRegisterExistingAccountNeedsPassword(t *testing.T) {
	a, m := newAuthService(t)
	teacherID, _ := a.CreateUser("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	teacher, _ := a.users.Get(teacherID)
	classID, _ := a.classes.Create("3A", "", teacherID)
	studID, _ := a.CreateUser("s@x.it", "Sara", "password123", domain.RoleStudent, "it")

	if _, err := a.CreateInvite(Invitation{Inviter: teacher, Email: "s@x.it", Role: domain.RoleStudent, ClassID: &classID, ClassName: "3A", Locale: "it"}, "http://site"); err != nil {
		t.Fatal(err)
	}
	tok := m.lastToken(t)
	if _, err := a.Register(Registration{Token: tok, Password: "wrong"}, "http://site"); !errors.Is(err, errInvalidCredentials) {
		t.Fatalf("existing account, wrong password: %v", err)
	}
	if uid, err := a.Register(Registration{Token: tok, Password: "password123"}, "http://site"); err != nil || uid != studID {
		t.Fatalf("register: %v %d", err, uid)
	}
	if !a.classes.IsMember(classID, studID) {
		t.Fatal("invite must add the class")
	}
	if _, err := a.Register(Registration{Token: tok, Password: "password123"}, "http://site"); !errors.Is(err, errInvalidInvite) {
		t.Fatalf("invite must be single use: %v", err)
	}
}
