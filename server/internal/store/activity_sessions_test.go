package store

import (
	"errors"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestActivitySessionsLifecycle(t *testing.T) {
	db := openTestDB(t)
	users := NewUsers(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	stud, _ := users.Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	classID, _ := NewClasses(db).Create("3A", "", teacher)
	aid, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: classID, Title: "T", AppType: "wiki-chatbot", Config: "{}", CreatedBy: &teacher})
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
	if rev, err := r.SaveTranscript(id, domain.TranscriptSave{JSON: `[{"role":"user","content":"ciao"}]`, Turns: 1, Context: &ctx}); err != nil || rev != 1 {
		t.Fatal(rev, err)
	}
	r.SaveJudgement(id, `{"engine":"jev"}`, 60, 1)
	r.SetStatus(id, domain.SessionActive, domain.SessionGoalReached)
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

func TestActivitySessionsConditionalWrites(t *testing.T) {
	db := openTestDB(t)
	stud, _ := NewUsers(db).Create("s@x.it", "Sara", "", domain.RoleStudent, "it")
	r := NewActivitySessions(db)
	id, _ := r.Create(domain.NewSession{UserID: stud, AppType: "wiki-chatbot", Title: "1", Context: "{}"})
	save := func(turns int, base *int64) (int64, error) {
		return r.SaveTranscript(id, domain.TranscriptSave{JSON: "[]", Turns: turns, BaseRevision: base})
	}

	rev1, _ := save(1, nil)
	rev2, _ := save(2, &rev1)
	if rev2 != 2 {
		t.Fatalf("revision %d", rev2)
	}
	if _, err := save(2, &rev1); !errors.Is(err, domain.ErrStaleRevision) {
		t.Fatalf("a save on an old revision must be refused: %v", err)
	}

	// the verdict on revision 2 arrives first; the late one on revision 1 is dropped
	if ok, _ := r.SaveJudgement(id, `{"n":2}`, 80, rev2); !ok {
		t.Fatal("newer verdict not stored")
	}
	if ok, _ := r.SaveJudgement(id, `{"n":1}`, 30, rev1); ok {
		t.Fatal("older verdict overwrote a newer one")
	}
	if d, _ := r.Detail(id); d.Progress != 80 || d.Revision != 2 {
		t.Fatalf("detail: %+v", d)
	}

	// a status change based on an old status does nothing
	r.Complete(id, domain.SessionCompletion{Reflection: "r"})
	if moved, _ := r.SetStatus(id, domain.SessionActive, domain.SessionGoalReached); moved {
		t.Fatal("a late judge reopened a completed attempt")
	}
	if _, err := save(3, nil); !errors.Is(err, domain.ErrSessionCompleted) {
		t.Fatalf("a completed attempt must not be rewritten: %v", err)
	}
	if ss, _ := r.Summary(id); ss.Status != domain.SessionCompleted || ss.Turns != 2 {
		t.Fatalf("summary: %+v", ss)
	}
}
