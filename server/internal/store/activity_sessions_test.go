package store

import (
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestActivitySessionsLifecycle(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	stud, _ := users.Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	classID, _ := NewClasses(db).Create("3A", "", teacher)
	aid, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: classID, Title: "T", AppType: "wiki-chatbot", Config: "{}", CreatedBy: teacher})
	r := NewActivitySessions(db)

	empty, _ := r.Create(domain.NewSession{UserID: stud, AssignmentID: &aid, AppType: "wiki-chatbot", Title: "1", Context: "{}"})
	if err := r.AbandonEmpty(stud, aid); err != nil {
		t.Fatal(err)
	}
	id, _ := r.Create(domain.NewSession{UserID: stud, AssignmentID: &aid, AppType: "wiki-chatbot", Title: "2", Context: "{}"})
	if ss, _ := r.Summary(empty); ss.Status != domain.SessionAbandoned {
		t.Fatalf("empty attempt not abandoned: %+v", ss)
	}
	if list, _ := r.ListForUser(stud, 10); len(list) != 1 || list[0].ID != id {
		t.Fatalf("empty abandoned attempts are hidden: %+v", list)
	}

	ctx := `{"topic":"guerra"}`
	if err := r.SaveTranscript(id, `[{"role":"user","content":"ciao"}]`, 1, &ctx); err != nil {
		t.Fatal(err)
	}
	r.SaveJudgement(id, `{"engine":"jev"}`, 60)
	r.SetStatus(id, domain.SessionGoalReached)
	r.AddCost(id, 0.5)
	r.AddCost(id, 0.25)
	d, err := r.Detail(id)
	if err != nil || d.Turns != 1 || d.Progress != 60 || d.CostUSD != 0.75 || string(d.Context) != ctx || d.AssignmentTitle != "T" || d.UserName != "Sara" {
		t.Fatalf("detail: %v %+v", err, d)
	}

	score := 8
	r.Complete(id, domain.SessionCompletion{Reflection: "r", ScoreConversation: &score})
	if best := r.Best(stud, aid); best.ID != id || best.Status != domain.SessionCompleted || *best.ScoreConversation != 8 || best.CompletedAt == nil {
		t.Fatalf("best: %+v", best)
	}
	if latest := r.Latest(stud, aid); latest == nil || r.Latest(teacher, aid) != nil {
		t.Fatal("latest")
	}
	if r.CountStarted(aid) != 1 || r.CountFinished(aid) != 1 || r.CountAttempts(stud, aid) != 2 || r.CountWithTurns() != 1 {
		t.Fatal("counts")
	}
	if cells, _ := r.BestPerStudent(classID); len(cells) != 1 || cells[0].SessionID != id || *cells[0].Score != 8 {
		t.Fatalf("best per student: %+v", cells)
	}
	if owner, status, err := r.Owner(id); err != nil || *owner != stud || status != domain.SessionCompleted {
		t.Fatalf("owner: %v %v %s", err, owner, status)
	}
}
