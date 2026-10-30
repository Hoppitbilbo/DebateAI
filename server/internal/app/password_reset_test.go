package app

import (
	"database/sql"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// recoveryClass is a username class with its owner, a co-teacher, the
// teacher of another class, an admin and a student created from the link.
type recoveryClass struct {
	s                                     *Services
	db                                    *sql.DB
	class                                 *domain.Class
	owner, coTeacher, stranger, admin, st *domain.User
}

func newRecoveryClass(t *testing.T) *recoveryClass {
	t.Helper()
	dir := t.TempDir()
	cfg := Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	s := NewServices(cfg, db)
	f := &recoveryClass{s: s, db: db, class: newUsernameClass(t, s)}
	f.owner, _ = s.Users.GetByEmail("prof@x.it")
	f.coTeacher = newRoomTestUser(t, s, "co@x.it", domain.RoleTeacher)
	if err := s.Classes.AddMember(f.class.ID, f.coTeacher.ID, domain.RoleTeacher); err != nil {
		t.Fatal(err)
	}
	f.stranger = newRoomTestUser(t, s, "other@x.it", domain.RoleTeacher)
	if _, err := s.ClassSvc.Create(f.stranger, NewClass{Name: "4B"}); err != nil {
		t.Fatal(err)
	}
	f.admin = newRoomTestUser(t, s, "admin@x.it", domain.RoleAdmin)
	f.st, err = s.Accounts.RegisterClassStudent(ClassEnrollment{Code: f.class.JoinCode, Username: "anna", Password: "password123"})
	if err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *recoveryClass) link(t *testing.T, issuer *domain.User) string {
	t.Helper()
	l, err := f.s.Accounts.AssistedReset(issuer, f.class.ID, f.st.ID, "http://site")
	if err != nil {
		t.Fatal(err)
	}
	if exp := parseTime(l.ExpiresAt); exp.Before(time.Now().Add(14*time.Minute)) || exp.After(time.Now().Add(16*time.Minute)) {
		t.Fatalf("a link lasts 15 minutes: %s", l.ExpiresAt)
	}
	tok, ok := strings.CutPrefix(l.URL, "http://site/reset-password?token=")
	if !ok || tok == "" {
		t.Fatalf("url %q", l.URL)
	}
	return tok
}

func TestAssistedResetByOwnerAndAdmin(t *testing.T) {
	for _, who := range []string{"owner", "admin"} {
		t.Run(who, func(t *testing.T) {
			f := newRecoveryClass(t)
			issuer := map[string]*domain.User{"owner": f.owner, "admin": f.admin}[who]
			login, _, _ := f.s.Accounts.StartSession(f.st.ID)
			tok := f.link(t, issuer)
			if _, err := f.s.Accounts.ResetPassword(tok, "short"); !IsInvalid(err) {
				t.Fatalf("weak password: %v", err)
			}
			u, err := f.s.Accounts.ResetPassword(tok, "newpassword1")
			if err != nil || u.ID != f.st.ID {
				t.Fatalf("reset: %v", err)
			}
			if f.s.Accounts.UserForToken(login) != nil {
				t.Fatal("the student's logins must end")
			}
			if _, err := f.s.Accounts.Login("anna", "password123"); !errors.Is(err, ErrInvalidCredentials) {
				t.Fatalf("old password: %v", err)
			}
			if _, err := f.s.Accounts.Login("anna", "newpassword1"); err != nil {
				t.Fatalf("new password: %v", err)
			}
			if _, err := f.s.Accounts.ResetPassword(tok, "another-pass"); !errors.Is(err, domain.ErrResetLinkInvalid) {
				t.Fatalf("reused link: %v", err)
			}
		})
	}
}

func TestAssistedResetRefusesOtherTeachers(t *testing.T) {
	f := newRecoveryClass(t)
	for name, u := range map[string]*domain.User{"co-teacher": f.coTeacher, "teacher of another class": f.stranger, "the student": f.st} {
		if _, err := f.s.Accounts.AssistedReset(u, f.class.ID, f.st.ID, "http://site"); !errors.Is(err, ErrResetForbidden) {
			t.Errorf("%s: want ErrResetForbidden, got %v", name, err)
		}
	}
	// The owner of another class the student joined later has no authority.
	other, _ := f.s.ClassSvc.Create(f.stranger, NewClass{Name: "Extra", EnrollmentMode: domain.EnrollUsername})
	if _, err := f.s.ClassSvc.Join(f.st, other.JoinCode); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.Accounts.AssistedReset(f.stranger, other.ID, f.st.ID, "http://site"); !errors.Is(err, ErrResetForbidden) {
		t.Fatalf("not the class of origin: %v", err)
	}
	if _, err := f.s.Accounts.AssistedReset(f.owner, f.class.ID, 9999, "http://site"); !errors.Is(err, ErrNotClassStudent) {
		t.Fatalf("unknown student: %v", err)
	}
}

func TestAssistedResetRefusesAccountsThatDoNotQualify(t *testing.T) {
	f := newRecoveryClass(t)
	withEmail := newRoomTestUser(t, f.s, "mail@x.it", domain.RoleStudent)
	f.s.Classes.AddMember(f.class.ID, withEmail.ID, domain.RoleStudent)
	room, err := f.s.RoomSvc.Open(nil, RoomRequest{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	guest := joinRoom(t, f.s, room.Room.Code, "volpe")
	f.s.Classes.AddMember(f.class.ID, guest.ID, domain.RoleStudent)
	for name, id := range map[string]int64{"account with e-mail": withEmail.ID, "room guest": guest.ID, "teacher": f.coTeacher.ID} {
		if _, err := f.s.Accounts.AssistedReset(f.owner, f.class.ID, id, "http://site"); !errors.Is(err, domain.ErrResetNotAllowed) {
			t.Errorf("%s: want ErrResetNotAllowed, got %v", name, err)
		}
	}
	f.s.Classes.Update(f.class.ID, domain.ClassPatch{Archived: ptr(true)})
	if _, err := f.s.Accounts.AssistedReset(f.owner, f.class.ID, f.st.ID, "http://site"); !errors.Is(err, domain.ErrResetNotAllowed) {
		t.Fatalf("archived class: %v", err)
	}
	f.s.Classes.Update(f.class.ID, domain.ClassPatch{Archived: ptr(false)})
	f.s.Classes.RemoveMember(f.class.ID, f.st.ID)
	if _, err := f.s.Accounts.AssistedReset(f.owner, f.class.ID, f.st.ID, "http://site"); !errors.Is(err, ErrNotClassStudent) {
		t.Fatalf("removed student: %v", err)
	}
}

// Between issue and use: whatever takes the authority away kills the link.
func TestAssistedResetLinkStopsWorking(t *testing.T) {
	for name, change := range map[string]func(f *recoveryClass){
		"owner changed": func(f *recoveryClass) {
			if _, err := f.db.Exec(`UPDATE classes SET owner_id = ? WHERE id = ?`, f.coTeacher.ID, f.class.ID); err != nil {
				panic(err)
			}
		},
		"class deleted":   func(f *recoveryClass) { f.s.Classes.Delete(f.class.ID) },
		"issuer demoted":  func(f *recoveryClass) { f.s.Users.Update(f.owner.ID, domain.UserPatch{Role: ptr(domain.RoleStudent)}) },
		"student removed": func(f *recoveryClass) { f.s.Classes.RemoveMember(f.class.ID, f.st.ID) },
		"class archived":  func(f *recoveryClass) { f.s.Classes.Update(f.class.ID, domain.ClassPatch{Archived: ptr(true)}) },
		"new link issued": func(f *recoveryClass) { f.s.Accounts.AssistedReset(f.owner, f.class.ID, f.st.ID, "http://site") },
	} {
		t.Run(name, func(t *testing.T) {
			f := newRecoveryClass(t)
			tok := f.link(t, f.owner)
			change(f)
			if _, err := f.s.Accounts.ResetPassword(tok, "newpassword1"); !errors.Is(err, domain.ErrResetLinkInvalid) {
				t.Fatalf("want ErrResetLinkInvalid, got %v", err)
			}
			if _, err := f.s.Accounts.Login("anna", "password123"); err != nil {
				t.Fatal("the old password must still work")
			}
		})
	}
	t.Run("admin demoted", func(t *testing.T) {
		f := newRecoveryClass(t)
		tok := f.link(t, f.admin)
		f.s.Users.Update(f.admin.ID, domain.UserPatch{Role: ptr(domain.RoleTeacher)})
		if _, err := f.s.Accounts.ResetPassword(tok, "newpassword1"); !errors.Is(err, domain.ErrResetLinkInvalid) {
			t.Fatalf("want ErrResetLinkInvalid, got %v", err)
		}
	})
}

// Deleting the issuer leaves the class without owner and the link with it.
func TestAssistedResetDiesWithItsIssuer(t *testing.T) {
	f := newRecoveryClass(t)
	tok := f.link(t, f.owner)
	if err := f.s.Users.Delete(f.owner.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.Accounts.ResetPassword(tok, "newpassword1"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("want ErrResetLinkInvalid, got %v", err)
	}
}

func TestResetLinkExpires(t *testing.T) {
	f := newRecoveryClass(t)
	tok := randomToken(24)
	past := time.Now().Add(-time.Second).UTC().Format(time.RFC3339)
	if err := f.s.Resets.Issue(domain.NewPasswordReset{TokenHash: hashToken(tok), UserID: f.st.ID, ExpiresAt: past, IssuedBy: &f.owner.ID, ClassID: &f.class.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.Accounts.ResetPassword(tok, "newpassword1"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("expired: %v", err)
	}
}

func TestConcurrentResetsWithTheSameLink(t *testing.T) {
	f := newRecoveryClass(t)
	tok := f.link(t, f.owner)
	var wg sync.WaitGroup
	var mu sync.Mutex
	ok, refused := 0, 0
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := f.s.Accounts.ResetPassword(tok, "newpassword"+itoa(int64(i)))
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				ok++
			case errors.Is(err, domain.ErrResetLinkInvalid):
				refused++
			default:
				t.Error(err)
			}
		}(i)
	}
	wg.Wait()
	if ok != 1 || refused != 1 {
		t.Fatalf("ok %d, refused %d", ok, refused)
	}
}

func TestEmailResetUsesTheNewLinks(t *testing.T) {
	a, m := newAuthService(t)
	id, _ := a.CreateUser("a@x.it", "Anna", "password123", domain.RoleStudent, "it")
	a.RequestReset(" A@X.it ", "http://site")
	first := m.lastToken(t)
	a.RequestReset("a@x.it", "http://site")
	second := m.lastToken(t)
	if _, err := a.ResetPassword(first, "newpassword1"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("a new request replaces the previous link: %v", err)
	}
	if u, err := a.ResetPassword(second, "newpassword1"); err != nil || u.ID != id {
		t.Fatalf("reset: %v", err)
	}
}

func TestForgotSendsNothingWithoutAnAddress(t *testing.T) {
	f := newRecoveryClass(t)
	m := &captureMailer{}
	a := *f.s.Accounts
	a.mail = m
	for _, who := range []string{"anna", "ANNA", "", "  ", "nobody@x.it"} {
		a.RequestReset(who, "http://site")
	}
	if len(m.bodies) != 0 {
		t.Fatalf("no mail without an e-mail account: %q", m.bodies)
	}
	// Nothing was issued either: a link from the owner is still the only one.
	tok := f.link(t, f.owner)
	a.RequestReset("anna", "http://site")
	if _, err := a.ResetPassword(tok, "newpassword1"); err != nil {
		t.Fatalf("the owner's link must not be replaced: %v", err)
	}
}

func TestMembersTellWhoCanBeReset(t *testing.T) {
	f := newRecoveryClass(t)
	class, _ := f.s.Classes.Get(f.class.ID)
	for who, want := range map[*domain.User]bool{f.owner: true, f.admin: true, f.coTeacher: false} {
		members, err := f.s.ClassSvc.Members(who, class)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range members {
			if got := m.CanResetPassword; got != (want && m.UserID == f.st.ID) {
				t.Errorf("%s sees member %d canResetPassword=%v", who.Email, m.UserID, got)
			}
		}
	}
}

func TestUpdateProfileWithWrongPasswordSavesNothing(t *testing.T) {
	f := newRecoveryClass(t)
	login, _, _ := f.s.Accounts.StartSession(f.st.ID)
	tok := f.link(t, f.owner)
	name, locale := "Anna B", "en"
	if _, err := f.s.Accounts.UpdateProfile(f.st, ProfileChange{Name: &name, Locale: &locale, CurrentPassword: "wrong", NewPassword: "newpassword1"}); !errors.Is(err, ErrWrongPassword) {
		t.Fatalf("wrong password: %v", err)
	}
	if _, err := f.s.Accounts.UpdateProfile(f.st, ProfileChange{Name: &name, CurrentPassword: "password123", NewPassword: "short"}); !IsInvalid(err) {
		t.Fatalf("weak new password: %v", err)
	}
	if u, _ := f.s.Users.Get(f.st.ID); u.Name != "anna" || u.Locale != "it" {
		t.Fatalf("nothing may be saved: %+v", u)
	}
	if f.s.Accounts.UserForToken(login) == nil {
		t.Fatal("a refused change keeps the logins")
	}

	u, err := f.s.Accounts.UpdateProfile(f.st, ProfileChange{Name: &name, Locale: &locale, CurrentPassword: "password123", NewPassword: "newpassword1"})
	if err != nil || u.Name != "Anna B" || u.Locale != "en" {
		t.Fatalf("update: %v %+v", err, u)
	}
	if f.s.Accounts.UserForToken(login) != nil {
		t.Fatal("other logins must end")
	}
	if _, err := f.s.Accounts.ResetPassword(tok, "another-pass"); !errors.Is(err, domain.ErrResetLinkInvalid) {
		t.Fatalf("reset links must be invalidated: %v", err)
	}
	if _, err := f.s.Accounts.Login("anna", "password123"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatal("old password still works")
	}
}

func TestJoinWithAReplacedCode(t *testing.T) {
	f := newRecoveryClass(t)
	old := f.class.JoinCode
	if _, err := f.s.ClassSvc.RegenerateCode(f.class.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.s.ClassSvc.Join(f.coTeacher, old); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("replaced code: %v", err)
	}
}
