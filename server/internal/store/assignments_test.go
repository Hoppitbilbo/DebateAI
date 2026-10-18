package store

import (
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestAssignmentsLifecycle(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	stud, _ := users.Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	classes := NewClasses(db)
	classID, _ := classes.Create("3A", "", teacher)
	classes.AddMember(classID, stud, domain.RoleStudent)
	r := NewAssignments(db)

	due := "2026-11-01T10:00:00Z"
	id, err := r.Create(domain.NewAssignment{ClassID: classID, Title: "Napoleone", AppType: "wiki-chatbot", Config: "{}",
		Goals: []string{"g1"}, MaxTurns: 5, AutoEnd: true, Published: true, DueAt: &due, CreatedBy: teacher})
	if err != nil {
		t.Fatal(err)
	}
	r.Create(domain.NewAssignment{ClassID: classID, Title: "Bozza", AppType: "wiki-chatbot", Config: "{}", CreatedBy: teacher})

	a, err := r.Get(id)
	if err != nil || a.ClassName != "3A" || a.Goals[0] != "g1" || !a.AutoEnd || a.RequireReflection || *a.DueAt != due {
		t.Fatalf("get: %v %+v", err, a)
	}
	if all, _ := r.ListForClass(classID); len(all) != 2 || r.Count() != 2 {
		t.Fatal("class list")
	}
	if mine, _ := r.ListForStudent(stud); len(mine) != 1 || mine[0].ID != id {
		t.Fatalf("students see only published assignments: %+v", mine)
	}

	title, empty, goals := "Napoleone 2", "", []string{}
	if err := r.Update(id, domain.AssignmentPatch{Title: &title, DueAt: &empty, Goals: &goals}); err != nil {
		t.Fatal(err)
	}
	a, _ = r.Get(id)
	if a.Title != "Napoleone 2" || a.DueAt != nil || len(a.Goals) != 0 || a.MaxTurns != 5 {
		t.Fatalf("after update: %+v", a)
	}
	r.Delete(id)
	if _, err := r.Get(id); err == nil {
		t.Fatal("deleted assignment still found")
	}
}

func TestCleanGoals(t *testing.T) {
	in := []string{" a ", "", "  "}
	for i := 0; i < 20; i++ {
		in = append(in, "x")
	}
	if got := domain.CleanGoals(in); len(got) != domain.MaxAssignmentGoals || got[0] != "a" {
		t.Fatalf("got %v", got)
	}
}
