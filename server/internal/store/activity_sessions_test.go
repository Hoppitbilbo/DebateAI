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
	classID, _ := NewClasses(db).Create("3A", "", teacher, domain.EnrollStandard)
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
	if stats, _ := r.StatsForClass(classID); stats[aid].Started != 1 || stats[aid].Completed != 1 || r.CountWithTurns() != 1 {
		t.Fatalf("counts: %+v", stats)
	}
	if best, _ := r.BestPerUser(aid); best[stud].Session == nil || best[stud].Session.ID != id || best[stud].Attempts != 2 {
		t.Fatalf("best per user: %+v", best)
	}
	if latest, _ := r.LatestPerAssignment(stud); latest[aid] == nil || latest[aid].ID != r.Latest(stud, aid).ID {
		t.Fatalf("latest per assignment: %+v", latest)
	}
	if cells, _ := r.BestPerStudent(classID); len(cells) != 1 || cells[0].SessionID != id || *cells[0].Score != 8 {
		t.Fatalf("best per student: %+v", cells)
	}
	if owner, status, _, err := r.Owner(id); err != nil || *owner != stud || status != domain.SessionCompleted {
		t.Fatalf("owner: %v %v %s", err, owner, status)
	}
	other, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: classID, Title: "U", AppType: "convinci-tu", Config: "{}", CreatedBy: &teacher})
	otherID, _ := r.Create(domain.NewSession{UserID: stud, AssignmentID: &other, AppType: "convinci-tu", Title: "3", Context: "{}"})
	if all, _ := r.BestPerUserIn([]int64{aid, other}); all[aid][stud].Session.ID != id || all[aid][stud].Attempts != 2 || all[other][stud].Session.ID != otherID || all[other][stud].Attempts != 1 {
		t.Fatalf("best per user in several assignments: %+v", all)
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

// Characterization of BestPerStudent before investigation 11/11, R4: one
// cell per student and assignment, the best attempt, best cells first.
func TestBestPerStudentKeepsTheBestAttemptOfEach(t *testing.T) {
	db := openTestDB(t)
	users, r := NewUsers(db), NewActivitySessions(db)
	teacher, _ := users.Create("t@x.it", "Prof", "", domain.RoleTeacher, "it")
	anna, _ := users.Create("a@x.it", "Anna", "", domain.RoleStudent, "it")
	marco, _ := users.Create("m@x.it", "Marco", "", domain.RoleStudent, "it")
	classID, _ := NewClasses(db).Create("3A", "", teacher, domain.EnrollStandard)
	other, _ := NewClasses(db).Create("3B", "", teacher, domain.EnrollStandard)
	a1, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: classID, Title: "A1", AppType: "wiki-chatbot", Config: "{}", CreatedBy: &teacher})
	a2, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: classID, Title: "A2", AppType: "wiki-chatbot", Config: "{}", CreatedBy: &teacher})
	elsewhere, _ := NewAssignments(db).Create(domain.NewAssignment{ClassID: other, Title: "B", AppType: "wiki-chatbot", Config: "{}", CreatedBy: &teacher})
	start := func(u, a int64, progress int, complete bool) int64 {
		id, _ := r.Create(domain.NewSession{UserID: u, AssignmentID: &a, AppType: "wiki-chatbot", Context: "{}"})
		if _, err := db.Exec(`UPDATE activity_sessions SET progress = ? WHERE id = ?`, progress, id); err != nil {
			t.Fatal(err)
		}
		if complete {
			r.Complete(id, domain.SessionCompletion{})
		}
		return id
	}
	start(anna, a1, 90, false)
	annaBest := start(anna, a1, 40, true) // completed beats more progress
	start(marco, a1, 10, false)
	marcoBest := start(marco, a1, 70, false)
	annaA2 := start(anna, a2, 20, false)
	start(anna, elsewhere, 100, true) // another class
	cells, err := r.BestPerStudent(classID)
	if err != nil {
		t.Fatal(err)
	}
	got := []int64{}
	for _, c := range cells {
		got = append(got, c.SessionID)
	}
	want := []int64{annaBest, marcoBest, annaA2}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Fatalf("cells %v, want %v (best first)", got, want)
	}
}
