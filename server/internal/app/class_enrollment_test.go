package app

import (
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// newUsernameClass makes a username class owned by a new teacher.
func newUsernameClass(t *testing.T, s *Services) *domain.Class {
	t.Helper()
	teacher := newRoomTestUser(t, s, "prof@x.it", domain.RoleTeacher)
	c, err := s.ClassSvc.Create(teacher, NewClass{Name: "3A", EnrollmentMode: domain.EnrollUsername})
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestRegisterClassStudentCreatesAStudentOfTheClass(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	u, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: strings.ToLower(c.JoinCode), Username: "  Anna.B ", Password: "password123", Locale: "en"})
	if err != nil {
		t.Fatal(err)
	}
	if u.Username != "anna.b" || u.Name != "anna.b" || u.Email != "" || u.Role != domain.RoleStudent || u.Locale != "en" {
		t.Fatalf("account: %+v", u)
	}
	if !s.Classes.IsMember(c.ID, u.ID) || s.Classes.Teaches(c.ID, u.ID) {
		t.Fatal("the account must be a student of the class")
	}
	if got, err := s.Accounts.Login("ANNA.B", "password123"); err != nil || got.ID != u.ID {
		t.Fatalf("login with the username: %v", err)
	}
}

func TestRegisterClassStudentRefusesBadInput(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	long := strings.Repeat("é", 37) // 74 bytes: bcrypt reads only 72
	for name, in := range map[string]ClassEnrollment{
		"short username":     {Code: c.JoinCode, Username: "ab", Password: "password123"},
		"username with @":    {Code: c.JoinCode, Username: "anna@x.it", Password: "password123"},
		"short password":     {Code: c.JoinCode, Username: "anna", Password: "short"},
		"password > 72 byte": {Code: c.JoinCode, Username: "anna", Password: long},
	} {
		if _, err := s.Accounts.RegisterClassStudent(in); !IsInvalid(err) {
			t.Errorf("%s: want invalid input, got %v", name, err)
		}
	}
	if n := len(s.Classes.Members(c.ID)); n != 1 {
		t.Fatalf("no account may be created, members %d", n)
	}
}

func TestRegisterClassStudentNeedsAnOpenUsernameLink(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	teacher, _ := s.Users.GetByEmail("prof@x.it")
	standard, _ := s.ClassSvc.Create(teacher, NewClass{Name: "Email"})
	old := c.JoinCode
	if _, err := s.ClassSvc.RegenerateCode(c.ID); err != nil {
		t.Fatal(err)
	}
	archived, _ := s.ClassSvc.Create(teacher, NewClass{Name: "Old", EnrollmentMode: domain.EnrollUsername})
	if err := s.Classes.Update(archived.ID, domain.ClassPatch{Archived: ptr(true)}); err != nil {
		t.Fatal(err)
	}
	for name, code := range map[string]string{"standard class": standard.JoinCode, "regenerated link": old, "archived class": archived.JoinCode, "empty": ""} {
		if _, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: code, Username: "anna", Password: "password123"}); !errors.Is(err, domain.ErrEnrollmentClosed) {
			t.Errorf("%s: want ErrEnrollmentClosed, got %v", name, err)
		}
		if _, err := s.Accounts.ClassInvite(code); !errors.Is(err, domain.ErrEnrollmentClosed) {
			t.Errorf("%s: invite info, want ErrEnrollmentClosed, got %v", name, err)
		}
	}
	if _, err := s.Users.GetByUsername("anna"); err == nil {
		t.Fatal("no account may be left behind")
	}
}

func TestClassInviteShowsOnlyNameAndMode(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	info, err := s.Accounts.ClassInvite(" " + c.JoinCode + " ")
	if err != nil || info.ClassName != "3A" || info.EnrollmentMode != domain.EnrollUsername {
		t.Fatalf("invite: %v %+v", err, info)
	}
}

// A retry after a lost response finds the username taken and the chosen
// credentials already working: no second account.
func TestRegisterClassStudentUsernameTakenAndRetry(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	in := ClassEnrollment{Code: c.JoinCode, Username: "anna", Password: "password123"}
	first, err := s.Accounts.RegisterClassStudent(in)
	if err != nil {
		t.Fatal(err)
	}
	in.Username = "ANNA"
	if _, err := s.Accounts.RegisterClassStudent(in); !errors.Is(err, domain.ErrUsernameTaken) {
		t.Fatalf("retry: %v", err)
	}
	if u, err := s.Accounts.Login("anna", "password123"); err != nil || u.ID != first.ID {
		t.Fatalf("the first account works: %v", err)
	}
	if n := len(s.Classes.Members(c.ID)); n != 2 {
		t.Fatalf("teacher and one student, got %d members", n)
	}
}

func TestRegisterClassStudentConcurrentSameUsername(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	var wg sync.WaitGroup
	var mu sync.Mutex
	created, taken := 0, 0
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: c.JoinCode, Username: "anna", Password: "password123"})
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				created++
			case errors.Is(err, domain.ErrUsernameTaken):
				taken++
			default:
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if created != 1 || taken != 5 {
		t.Fatalf("created %d, taken %d", created, taken)
	}
}

func TestLoginByIdentifier(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	stud, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: c.JoinCode, Username: "marco", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}
	if u, err := s.Accounts.Login(" Prof@X.it ", ""); err == nil || u != nil {
		t.Fatal("the teacher has no password here")
	}
	if _, err := s.Accounts.Login("marco", "wrong-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong password: %v", err)
	}
	for _, id := range []string{"", "nobody", "a b", "@", "nobody@x.it"} {
		if _, err := s.Accounts.Login(id, "password123"); !errors.Is(err, ErrInvalidCredentials) {
			t.Errorf("%q: want ErrInvalidCredentials, got %v", id, err)
		}
	}
	if err := s.Users.Update(stud.ID, domain.UserPatch{Active: ptr(false)}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Accounts.Login("marco", "password123"); !errors.Is(err, ErrAccountDisabled) {
		t.Fatalf("disabled: %v", err)
	}
	if _, err := s.Accounts.Login("marco", "wrong-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("a disabled account is not revealed without its password: %v", err)
	}
}

func TestRoomGuestCannotLogInByIdentifier(t *testing.T) {
	s := newTestServer(t)
	room, err := s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	guest := joinRoom(t, s, room.Room.Code, "volpe")
	// Even with a password, a guest never logs in: it has no username.
	hash, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	if err := s.Users.SetPasswordHash(guest.ID, string(hash)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Accounts.Login(guest.Name, "password123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("guest by name: %v", err)
	}
}

// The progress of an assignment names an account without e-mail by its
// username, which the student cannot change (the display name they can).
func TestProgressShowsTheUsernameOfAnAccountWithoutEmail(t *testing.T) {
	s := newTestServer(t)
	c := newUsernameClass(t, s)
	u, err := s.Accounts.RegisterClassStudent(ClassEnrollment{Code: c.JoinCode, Username: "anna.b", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}
	name := "Anna"
	if _, err := s.Accounts.UpdateProfile(u, ProfileChange{Name: &name}); err != nil {
		t.Fatal(err)
	}
	owner, _ := s.Users.Get(*c.OwnerID)
	title, app := "T", "wiki-chatbot"
	a, err := s.AssignmentSvc.Create(owner, c.ID, AssignmentInput{Title: &title, AppType: &app}, "http://site")
	if err != nil {
		t.Fatal(err)
	}
	p, err := s.AssignmentSvc.Progress(a)
	if err != nil || len(p) != 1 || p[0].Name != "Anna" || p[0].Email != "" || p[0].Username != "anna.b" {
		t.Fatalf("progress: %v %+v", err, p)
	}
}
