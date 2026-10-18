package store

import (
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestClassesLifecycle(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	co, _ := users.Create("c@x.it", "Co", "", domain.RoleTeacher, "it")
	stud, _ := users.Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	r := NewClasses(db)

	id, err := r.Create("3A", "storia", teacher)
	if err != nil {
		t.Fatal(err)
	}
	c, err := r.Get(id)
	if err != nil || c.TeacherCount != 1 || c.OwnerName != "Prof" || len(c.JoinCode) != 6 {
		t.Fatalf("create must add the owner as teacher: %v %+v", err, c)
	}
	if !r.IsOwner(id, teacher) || !r.Teaches(id, teacher) || r.Teaches(id, co) {
		t.Fatal("ownership")
	}

	r.AddMember(id, co, domain.RoleTeacher)
	r.AddMember(id, stud, domain.RoleStudent)
	r.AddMember(id, stud, domain.RoleTeacher) // existing membership is kept
	if !r.Teaches(id, co) || r.IsOwner(id, co) || !r.TeachesStudent(co, stud) || r.TeachesStudent(stud, co) {
		t.Fatal("co-teacher rights")
	}
	if r.CountStudents(id) != 1 || r.CountMemberships(stud) != 1 {
		t.Fatal("counts")
	}
	if m := r.Members(id); len(m) != 3 || m[0].Role != domain.RoleTeacher || m[2].Name != "Sara" {
		t.Fatalf("members: %+v", m)
	}
	if st, _ := r.Students(id); len(st) != 1 || st[0].Email != "s@x.it" {
		t.Fatalf("students: %+v", st)
	}

	if found, err := r.FindByJoinCode(c.JoinCode); err != nil || found.ID != id {
		t.Fatalf("join code: %v", err)
	}
	archived := true
	r.Update(id, domain.ClassPatch{Archived: &archived})
	if _, err := r.FindByJoinCode(c.JoinCode); err == nil {
		t.Fatal("archived classes cannot be joined")
	}
	if joined, _ := r.ListJoinedBy(stud); len(joined) != 0 || r.CountActive() != 0 {
		t.Fatal("archived classes are hidden from students")
	}
	if taught, _ := r.ListTaughtBy(co); len(taught) != 1 {
		t.Fatal("co-teacher must see the class")
	}

	r.RemoveMember(id, stud)
	if r.IsMember(id, stud) {
		t.Fatal("member not removed")
	}
	r.Delete(id)
	if r.Name(id) != "" {
		t.Fatal("class not deleted")
	}
}

func TestNewJoinCodeAlphabet(t *testing.T) {
	for i := 0; i < 200; i++ {
		for _, ch := range domain.NewJoinCode() {
			if ch == '0' || ch == 'O' || ch == '1' || ch == 'I' || ch == 'L' {
				t.Fatalf("ambiguous character %q", ch)
			}
		}
	}
}
