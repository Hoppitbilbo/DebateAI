package app

import (
	"errors"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestClassInviteRules(t *testing.T) {
	s := newTestServer(t)
	m := &captureMailer{}
	svc := *s.ClassSvc
	svc.mail = m
	acc := *s.Accounts
	acc.mail = m
	svc.accounts = &acc

	newUser := func(email, role string) *User {
		id, err := acc.CreateUser(email, "", "", role, "it")
		if err != nil {
			t.Fatal(err)
		}
		u, _ := s.Users.Get(id)
		return u
	}
	owner, co, other := newUser("o@x.it", domain.RoleTeacher), newUser("c@x.it", domain.RoleTeacher), newUser("x@x.it", domain.RoleTeacher)
	stud := newUser("s@x.it", domain.RoleStudent)
	class, _ := svc.Create(owner, "3A", "", nil)

	if svc.CanManage(other, class.ID) {
		t.Fatal("a teacher of another class must not manage it")
	}
	if _, err := svc.Invite(owner, class.ID, MemberInvitation{Emails: []string{"y@x.it"}, Role: domain.RoleAdmin}, "http://site"); !errors.Is(err, errBadMemberRole) {
		t.Fatalf("bad role: %v", err)
	}
	res, err := svc.Invite(owner, class.ID, MemberInvitation{Emails: []string{"c@x.it, s@x.it", "new@x.it"}, Role: domain.RoleTeacher}, "http://site")
	if err != nil || len(res) != 3 || res[0].Status != "added" || res[2].Status != "invited" {
		t.Fatalf("invite: %v %+v", err, res)
	}
	if !svc.CanManage(co, class.ID) || svc.CanManage(stud, class.ID) {
		t.Fatal("teachers become co-teachers, students stay students")
	}
	if _, err := svc.Invite(co, class.ID, MemberInvitation{Emails: []string{"z@x.it"}, Role: domain.RoleTeacher}, "http://site"); !errors.Is(err, errOnlyOwner) {
		t.Fatalf("co-teachers cannot add co-teachers: %v", err)
	}
}

func TestJoinByCode(t *testing.T) {
	s := newTestServer(t)
	tid, _ := s.Accounts.CreateUser("t@x.it", "", "", domain.RoleTeacher, "it")
	sid, _ := s.Accounts.CreateUser("s@x.it", "", "", domain.RoleStudent, "it")
	teacher, _ := s.Users.Get(tid)
	stud, _ := s.Users.Get(sid)
	class, _ := s.ClassSvc.Create(teacher, "3A", "", nil)

	if _, err := s.ClassSvc.Join(stud, "nope"); !errors.Is(err, errInvalidCode) {
		t.Fatalf("invalid code: %v", err)
	}
	if c, err := s.ClassSvc.Join(stud, " "+class.JoinCode+" "); err != nil || c.ID != class.ID {
		t.Fatalf("join: %v", err)
	}
	if joined, _ := s.ClassSvc.Joined(stud); len(joined) != 1 || joined[0].JoinCode != "" {
		t.Fatalf("students must not see the join code: %+v", joined)
	}
}
