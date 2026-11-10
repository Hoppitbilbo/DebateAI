package app

import (
	"errors"
	"net/url"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestClassInviteRules(t *testing.T) {
	s := newTestServer(t)
	m := &captureMailer{}
	svc := *s.ClassSvc
	acc := *s.Accounts
	acc.mail = m
	svc.accounts = &acc

	newUser := func(email, role string) *domain.User {
		id, err := acc.CreateUser(email, "", "password123", role, "it")
		if err != nil {
			t.Fatal(err)
		}
		u, _ := s.Users.Get(id)
		return u
	}
	owner, co, other := newUser("o@x.it", domain.RoleTeacher), newUser("c@x.it", domain.RoleTeacher), newUser("x@x.it", domain.RoleTeacher)
	stud := newUser("s@x.it", domain.RoleStudent)
	class, _ := svc.Create(owner, NewClass{Name: "3A"})

	if svc.CanManage(other, class.ID) {
		t.Fatal("a teacher of another class must not manage it")
	}
	if _, err := svc.Invite(owner, class.ID, MemberInvitation{Emails: []string{"y@x.it"}, Role: domain.RoleAdmin}, "http://site"); !errors.Is(err, ErrBadMemberRole) {
		t.Fatalf("bad role: %v", err)
	}
	res, err := svc.Invite(owner, class.ID, MemberInvitation{Emails: []string{"c@x.it, s@x.it", "new@x.it"}, Role: domain.RoleTeacher}, "http://site")
	if err != nil || len(res) != 3 || res[0].Status != "invited" || res[2].Status != "invited" {
		t.Fatalf("invite: %v %+v", err, res)
	}
	if svc.CanManage(co, class.ID) || s.Classes.IsMember(class.ID, stud.ID) {
		t.Fatal("invitations do not grant access before acceptance")
	}
	for _, result := range res[:2] {
		link, err := url.Parse(result.Link)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := acc.Register(Registration{Token: link.Query().Get("token"), Password: "password123"}, "http://site"); err != nil {
			t.Fatal(err)
		}
	}
	if !svc.CanManage(co, class.ID) || svc.CanManage(stud, class.ID) {
		t.Fatal("teachers become co-teachers, students stay students")
	}
	for _, member := range s.Classes.Members(class.ID) {
		if member.UserID == stud.ID && member.Role != domain.RoleStudent {
			t.Fatal("an invited student must not gain teacher membership")
		}
	}
	if _, err := svc.Invite(co, class.ID, MemberInvitation{Emails: []string{"z@x.it"}, Role: domain.RoleTeacher}, "http://site"); !errors.Is(err, ErrOnlyOwner) {
		t.Fatalf("co-teachers cannot add co-teachers: %v", err)
	}
}

func TestJoinByCode(t *testing.T) {
	s := newTestServer(t)
	tid, _ := s.Accounts.CreateUser("t@x.it", "", "", domain.RoleTeacher, "it")
	sid, _ := s.Accounts.CreateUser("s@x.it", "", "", domain.RoleStudent, "it")
	teacher, _ := s.Users.Get(tid)
	stud, _ := s.Users.Get(sid)
	class, _ := s.ClassSvc.Create(teacher, NewClass{Name: "3A"})

	if _, err := s.ClassSvc.Join(stud, "nope"); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("invalid code: %v", err)
	}
	if c, err := s.ClassSvc.Join(stud, " "+class.JoinCode+" "); err != nil || c.ID != class.ID {
		t.Fatalf("join: %v", err)
	}
	if joined, _ := s.ClassSvc.Joined(stud); len(joined) != 1 || joined[0].JoinCode != "" {
		t.Fatalf("students must not see the join code: %+v", joined)
	}
}
