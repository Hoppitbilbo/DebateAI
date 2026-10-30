package app

import (
	"encoding/json"
	"errors"
	"net/url"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestTeacherCannotReadOtherClassOrPrivatePractice(t *testing.T) {
	s, teacher, other, student, assignment := visibilityFixture(t)
	otherClass, err := s.ClassSvc.Create(other, NewClass{Name: "Other class"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Classes.AddMember(otherClass.ID, student.ID, domain.RoleStudent); err != nil {
		t.Fatal(err)
	}
	admin := newRoomTestUser(t, s, "admin@x.it", domain.RoleAdmin)
	for _, tc := range []struct {
		name         string
		assignmentID *int64
	}{
		{"assignment", &assignment.ID},
		{"private practice", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			id, err := s.Sessions.Create(domain.NewSession{UserID: student.ID, AssignmentID: tc.assignmentID, AppType: "wiki-chatbot"})
			if err != nil {
				t.Fatal(err)
			}
			if _, _, err := s.SessionSvc.Load(other, id); !errors.Is(err, ErrSessionNotFound) {
				t.Errorf("another teacher of the same student can read the work: %v", err)
			}
			if _, err := s.SessionSvc.GiveFeedback(other, id, domain.TeacherFeedback{Text: "not my work"}, ""); !errors.Is(err, ErrSessionNotFound) {
				t.Errorf("another teacher can write feedback: %v", err)
			}
			for _, u := range []*domain.User{student, admin} {
				if _, _, err := s.SessionSvc.Load(u, id); err != nil {
					t.Errorf("owner/admin must retain access: %v", err)
				}
			}
			_, _, err = s.SessionSvc.Load(teacher, id)
			if tc.assignmentID != nil && err != nil {
				t.Errorf("assignment teacher lost access: %v", err)
			}
			if tc.assignmentID == nil && !errors.Is(err, ErrSessionNotFound) {
				t.Errorf("private practice exposed to a teacher: %v", err)
			}
		})
	}
}

func TestImportedRoomWorkBelongsOnlyToDestinationClass(t *testing.T) {
	for _, source := range []string{"private", "room assignment", "other class assignment"} {
		for _, method := range []string{"file", "open room"} {
			t.Run(source+"/"+method, func(t *testing.T) {
				s := newTestServer(t)
				s.SessionSvc.listeners = nil
				teacher := newRoomTestUser(t, s, "teacher@x.it", domain.RoleTeacher)
				other := newRoomTestUser(t, s, "other@x.it", domain.RoleTeacher)
				co := newRoomTestUser(t, s, "co@x.it", domain.RoleTeacher)
				student := newRoomTestUser(t, s, "student@x.it", domain.RoleStudent)
				dest, err := s.ClassSvc.Create(teacher, NewClass{Name: "Destination"})
				if err != nil {
					t.Fatal(err)
				}
				foreign, err := s.ClassSvc.Create(other, NewClass{Name: "Other class"})
				if err != nil {
					t.Fatal(err)
				}
				for _, classID := range []int64{dest.ID, foreign.ID} {
					if err := s.Classes.AddMember(classID, student.ID, domain.RoleStudent); err != nil {
						t.Fatal(err)
					}
				}
				if err := s.Classes.AddMember(dest.ID, co.ID, domain.RoleTeacher); err != nil {
					t.Fatal(err)
				}
				request := RoomRequest{AppType: "wiki-chatbot"}
				switch source {
				case "room assignment":
					request.Assignment = &AssignmentInput{Title: ptr("Temporary"), AppType: ptr("wiki-chatbot")}
				case "other class assignment":
					a, err := s.AssignmentSvc.Create(other, foreign.ID, AssignmentInput{Title: ptr("Foreign"), AppType: ptr("wiki-chatbot")}, "")
					if err != nil {
						t.Fatal(err)
					}
					request.AssignmentID = a.ID
				}
				opened, err := s.RoomSvc.Open(other, request)
				if err != nil {
					t.Fatal(err)
				}
				guest := joinRoom(t, s, opened.Room.Code, "Guest")
				attempt := NewAttempt{AppType: "wiki-chatbot", Title: "Imported work"}
				if opened.Room.AssignmentID != nil {
					attempt.AssignmentID = *opened.Room.AssignmentID
				}
				if _, err := s.SessionSvc.Start(guest, attempt); err != nil {
					t.Fatal(err)
				}
				matches := []ImportMatch{{Nickname: "Guest", StudentID: student.ID}}
				if method == "file" {
					exported, err := s.RoomTransfer.Export(opened.Room)
					if err != nil {
						t.Fatal(err)
					}
					file, err := s.RoomTransfer.SealExport(exported)
					if err != nil {
						t.Fatal(err)
					}
					if _, err := s.RoomTransfer.ImportFile(teacher, dest.ID, string(file), matches); err != nil {
						t.Fatal(err)
					}
					if err := s.RoomSvc.End(opened.Room); err != nil {
						t.Fatal(err)
					}
				} else if _, err := s.RoomTransfer.ImportRoom(teacher, dest.ID, opened.Room, matches); err != nil {
					t.Fatal(err)
				}
				list, err := s.Sessions.ListForUser(student.ID, 10)
				if err != nil || len(list) != 1 {
					t.Fatalf("import: %v %+v", err, list)
				}
				id := list[0].ID
				d, _, err := s.SessionSvc.Load(teacher, id)
				if err != nil || d.ClassID == nil || *d.ClassID != dest.ID || d.AssignmentID != nil {
					t.Fatalf("destination must own the imported work: %v %+v", err, d)
				}
				if _, _, err := s.SessionSvc.Load(other, id); !errors.Is(err, ErrSessionNotFound) {
					t.Fatalf("source teacher still has access: %v", err)
				}
				if _, err := s.SessionSvc.GiveFeedback(co, id, domain.TeacherFeedback{Text: "Good"}, ""); err != nil {
					t.Fatal(err)
				}
				if err := s.Classes.RemoveMember(dest.ID, co.ID); err != nil {
					t.Fatal(err)
				}
				if _, _, err := s.SessionSvc.Load(co, id); !errors.Is(err, ErrSessionNotFound) {
					t.Fatalf("removed co-teacher: %v", err)
				}
				archived := true
				if err := s.Classes.Update(dest.ID, domain.ClassPatch{Archived: &archived}); err != nil {
					t.Fatal(err)
				}
				if _, _, err := s.SessionSvc.Load(teacher, id); err != nil {
					t.Fatalf("archiving preserves review: %v", err)
				}
				if err := s.Classes.Delete(dest.ID); err != nil {
					t.Fatal(err)
				}
				if _, _, err := s.SessionSvc.Load(teacher, id); !errors.Is(err, ErrSessionNotFound) {
					t.Fatalf("deleted class: %v", err)
				}
				if _, owns, err := s.SessionSvc.Load(student, id); err != nil || !owns {
					t.Fatalf("student keeps imported work: %v", err)
				}
			})
		}
	}
}

func TestSessionClassProvenanceIsServerOwned(t *testing.T) {
	var d domain.SessionDetail
	if err := json.Unmarshal([]byte(`{"classId":123,"ClassID":123}`), &d); err != nil {
		t.Fatal(err)
	}
	if d.ClassID != nil {
		t.Fatal("a client or imported file must not set class provenance")
	}
}

func TestDisabledAccountCannotAcceptClassInvite(t *testing.T) {
	a, mail := newAuthService(t)
	teacherID, err := a.CreateUser("teacher@x.it", "Teacher", "password123", domain.RoleTeacher, "it")
	if err != nil {
		t.Fatal(err)
	}
	teacher, err := a.users.Get(teacherID)
	if err != nil {
		t.Fatal(err)
	}
	classID, err := a.classes.Create("Class", "", teacherID, domain.EnrollStandard)
	if err != nil {
		t.Fatal(err)
	}
	id, err := a.CreateUser("student@x.it", "Student", "password123", domain.RoleStudent, "it")
	if err != nil {
		t.Fatal(err)
	}
	off := false
	if err := a.users.Update(id, domain.UserPatch{Active: &off}); err != nil {
		t.Fatal(err)
	}
	if _, err := a.CreateInvite(Invitation{Inviter: teacher, Email: "student@x.it", Role: domain.RoleStudent, ClassID: &classID}, "http://site"); err != nil {
		t.Fatal(err)
	}
	if _, err := a.Register(Registration{Token: mail.lastToken(t), Password: "password123"}, "http://site"); !errors.Is(err, ErrAccountDisabled) {
		t.Fatalf("disabled account: %v", err)
	}
	if a.classes.IsMember(classID, id) {
		t.Fatal("disabled account was enrolled")
	}
}

func TestClassInviteRequiresExistingAccountAcceptance(t *testing.T) {
	s := newTestServer(t)
	s.Accounts.mail = &captureMailer{}
	teacher := newRoomTestUser(t, s, "teacher@x.it", domain.RoleTeacher)
	class, err := s.ClassSvc.Create(teacher, NewClass{Name: "Class"})
	if err != nil {
		t.Fatal(err)
	}
	id, err := s.Accounts.CreateUser("student@x.it", "Student", "password123", domain.RoleStudent, "it")
	if err != nil {
		t.Fatal(err)
	}
	results, err := s.ClassSvc.Invite(teacher, class.ID, MemberInvitation{Emails: []string{"student@x.it"}}, "http://site")
	if err != nil || len(results) != 1 {
		t.Fatalf("invite: %v %+v", err, results)
	}
	if s.Classes.IsMember(class.ID, id) {
		t.Fatal("knowing an email must not enroll its owner")
	}
	if results[0].Status != "invited" {
		t.Fatalf("existing and new addresses must receive invitations: %+v", results)
	}
	link, err := url.Parse(results[0].Link)
	if err != nil {
		t.Fatal(err)
	}
	in := Registration{Token: link.Query().Get("token"), Password: "wrong"}
	if _, err := s.Accounts.Register(in, "http://site"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong password: %v", err)
	}
	if s.Classes.IsMember(class.ID, id) {
		t.Fatal("failed acceptance changed membership")
	}
	in.Password = "password123"
	if got, err := s.Accounts.Register(in, "http://site"); err != nil || got != id || !s.Classes.IsMember(class.ID, id) {
		t.Fatalf("acceptance: user=%d err=%v", got, err)
	}
}
