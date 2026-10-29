package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Characterization tests for PUT /api/sessions/{id}/transcript (refactoring task 0.3).

type transcriptFixture struct {
	s       *testAPI
	owner   *client
	session int64
	judge   *fakeDecider
}

// newTranscriptFixture logs in an admin, creates a class and an assignment
// with the given fields, starts a session on it and routes the judge to a
// fake Jev that scores goal_0 with goalScore.
func newTranscriptFixture(t *testing.T, assignment map[string]any, goalScore float64) *transcriptFixture {
	t.Helper()
	s := newTestAPI(t)
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(srv.Close)

	owner := newClient(t, srv.URL)
	if code := owner.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil); code != 201 {
		t.Fatalf("setup %d", code)
	}
	d := &fakeDecider{scores: map[string]float64{"goal_0": goalScore}}
	jevID := s.addFake(t, "fake-jev", ai.KindJev, d)
	if err := s.Settings.SaveRouting(app.RoutingSettings{Strategy: "ordered", Tasks: map[string][]app.RouteTarget{app.TaskJudge: {{ProviderID: jevID, Model: "jev"}}}}); err != nil {
		t.Fatal(err)
	}

	var cls domain.Class
	owner.do("POST", "/api/classes", map[string]string{"name": "3A"}, &cls)
	fields := map[string]any{"title": "Napoleone", "appType": "wiki-chatbot", "instructions": "Intervista Napoleone", "goals": []string{"Chiede della Russia"}}
	for k, v := range assignment {
		fields[k] = v
	}
	var a domain.Assignment
	owner.do("POST", fmtPath("/api/classes/%d/assignments", cls.ID), fields, &a)
	var sess domain.SessionSummary
	if code := owner.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot", "assignmentId": a.ID}, &sess); code != 201 {
		t.Fatalf("create session %d", code)
	}
	return &transcriptFixture{s: s, owner: owner, session: sess.ID, judge: d}
}

// userTurns builds a transcript with n student messages, each followed by an answer.
func userTurns(n int) []map[string]string {
	var msgs []map[string]string
	for i := 0; i < n; i++ {
		msgs = append(msgs, map[string]string{"role": "user", "content": "domanda"}, map[string]string{"role": "assistant", "content": "risposta"})
	}
	return msgs
}

func (f *transcriptFixture) save(t *testing.T, body map[string]any) map[string]any {
	t.Helper()
	var out map[string]any
	if code := f.owner.do("PUT", fmtPath("/api/sessions/%d/transcript", f.session), body, &out); code != 200 {
		t.Fatalf("save transcript: %d %v", code, out)
	}
	return out
}

func keys(m map[string]any) string {
	var k []string
	for key := range m {
		k = append(k, key)
	}
	sort.Strings(k)
	return strings.Join(k, ",")
}

func TestSaveTranscriptResponseShape(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"maxTurns": 10, "autoEnd": false}, 0.2)
	out := f.save(t, map[string]any{"messages": userTurns(1)})
	if got := keys(out); got != "ended,jev,maxTurns,progress,reason,revision,status,turns" {
		t.Fatalf("response keys changed: %s", got)
	}
	if out["status"] != "active" || out["ended"] != false || out["turns"] != 1.0 || out["maxTurns"] != 10.0 || out["reason"] != "" {
		t.Fatalf("unexpected response: %v", out)
	}
}

func TestSaveTranscriptCountsOnlyNonEmptyStudentMessages(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": false}, 0)
	msgs := append(userTurns(2), map[string]string{"role": "user", "content": "   "}, map[string]string{"role": "system", "content": "intro"})
	if out := f.save(t, map[string]any{"messages": msgs}); out["turns"] != 2.0 {
		t.Fatalf("turns = %v", out["turns"])
	}
}

func TestSaveTranscriptFreeSessionIsNotJudged(t *testing.T) {
	f := newTranscriptFixture(t, nil, 1)
	var sess domain.SessionSummary
	f.owner.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot"}, &sess)
	f.session = sess.ID

	out := f.save(t, map[string]any{"messages": userTurns(3)})
	if got := keys(out); got != "ended,progress,revision,status,turns" {
		t.Fatalf("free session keys: %s", got)
	}
	if f.judge.decisions != 0 {
		t.Fatal("free sessions must not be judged")
	}
}

func TestSaveTranscriptAutoEndsWhenGoalReached(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": true}, 0.9)
	out := f.save(t, map[string]any{"messages": userTurns(1)})
	if out["status"] != "goal_reached" || out["reason"] != "goal_reached" || out["ended"] != true || out["progress"] != 100.0 {
		t.Fatalf("expected goal_reached: %v", out)
	}

	// ended session: stored, not judged again
	out = f.save(t, map[string]any{"messages": userTurns(2)})
	if out["status"] != "goal_reached" || out["ended"] != true || f.judge.decisions != 1 || out["turns"] != 2.0 {
		t.Fatalf("ended session: %v (decisions %d)", out, f.judge.decisions)
	}
	if got := keys(out); got != "ended,progress,revision,status,turns" {
		t.Fatalf("ended session keys: %s", got)
	}
}

func TestSaveTranscriptWithoutAutoEndStaysActive(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": false}, 0.9)
	out := f.save(t, map[string]any{"messages": userTurns(1)})
	if out["status"] != "active" || out["progress"] != 100.0 {
		t.Fatalf("expected active with full progress: %v", out)
	}
	var d domain.SessionDetail
	f.owner.do("GET", fmtPath("/api/sessions/%d", f.session), nil, &d)
	if d.Progress != 100 || !strings.Contains(string(d.Jev), `"engine":"jev"`) {
		t.Fatalf("judgement not stored: %+v %s", d.SessionSummary, d.Jev)
	}
}

func TestSaveTranscriptTurnLimit(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"maxTurns": 2, "autoEnd": true}, 0.1)
	if out := f.save(t, map[string]any{"messages": userTurns(1)}); out["status"] != "active" {
		t.Fatalf("below the limit: %v", out)
	}
	out := f.save(t, map[string]any{"messages": userTurns(2)})
	if out["status"] != "turn_limit" || out["reason"] != "turn_limit" || out["ended"] != true {
		t.Fatalf("expected turn_limit: %v", out)
	}
}

func TestSaveTranscriptEvaluateEvery(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"maxTurns": 3, "autoEnd": false}, 0.1)
	if err := f.s.Settings.SaveJev(app.JevSettings{Enabled: true, Threshold: 0.7, EvaluateEvery: 2, MaxStateChars: 24000}); err != nil {
		t.Fatal(err)
	}
	f.save(t, map[string]any{"messages": userTurns(1)})
	if f.judge.decisions != 0 {
		t.Fatal("turn 1 must not be judged with evaluateEvery=2")
	}
	f.save(t, map[string]any{"messages": userTurns(2)})
	if f.judge.decisions != 1 {
		t.Fatal("turn 2 must be judged")
	}
	f.save(t, map[string]any{"messages": userTurns(3)})
	if f.judge.decisions != 2 {
		t.Fatal("the last allowed turn (maxTurns) is always judged")
	}
}

func TestSaveTranscriptJudgeFlagOverridesSchedule(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": false}, 0.1)
	if out := f.save(t, map[string]any{"messages": userTurns(1), "judge": false}); out["jev"] != nil || f.judge.decisions != 0 {
		t.Fatalf("judge:false must skip judging: %v", out)
	}
	if err := f.s.Settings.SaveJev(app.JevSettings{Enabled: true, Threshold: 0.7, EvaluateEvery: 5, MaxStateChars: 24000}); err != nil {
		t.Fatal(err)
	}
	f.save(t, map[string]any{"messages": userTurns(1), "judge": true})
	if f.judge.decisions != 1 {
		t.Fatal("judge:true must force judging")
	}
	f.save(t, map[string]any{"messages": []map[string]string{}, "judge": true})
	if f.judge.decisions != 1 {
		t.Fatal("judge:true with zero turns must not judge")
	}
}

func TestSaveTranscriptStoresContextAndPassesItToJudge(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": false}, 0.1)
	f.save(t, map[string]any{"messages": userTurns(1), "context": map[string]string{"character": "Napoleone"}})

	var d domain.SessionDetail
	f.owner.do("GET", fmtPath("/api/sessions/%d", f.session), nil, &d)
	if !strings.Contains(string(d.Context), "Napoleone") {
		t.Fatalf("context not stored: %s", d.Context)
	}
	// later saves without context reuse the stored one
	f.save(t, map[string]any{"messages": userTurns(2)})
	st, _ := json.Marshal(f.judge.state)
	if !strings.Contains(string(st), "Napoleone") {
		t.Fatalf("stored context not sent to the judge: %s", st)
	}
}

func TestSaveTranscriptKeepsLast1000Messages(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"autoEnd": false}, 0)
	msgs := userTurns(600) // 1200 messages, 600 student turns
	if out := f.save(t, map[string]any{"messages": msgs, "judge": false}); out["turns"] != 500.0 {
		t.Fatalf("turns counted after truncation = %v", out["turns"])
	}
	var d domain.SessionDetail
	f.owner.do("GET", fmtPath("/api/sessions/%d", f.session), nil, &d)
	var stored []app.TranscriptMessage
	_ = json.Unmarshal(d.Transcript, &stored)
	if len(stored) != 1000 {
		t.Fatalf("stored %d messages", len(stored))
	}
}

func TestSaveTranscriptOnlyOwner(t *testing.T) {
	f := newTranscriptFixture(t, nil, 0)
	if _, err := f.s.Accounts.CreateUser("other@test.it", "Other", "password123", "student", "it"); err != nil {
		t.Fatal(err)
	}
	other := newClient(t, f.owner.base)
	other.do("POST", "/api/auth/login", map[string]string{"email": "other@test.it", "password": "password123"}, nil)
	if code := other.do("PUT", fmtPath("/api/sessions/%d/transcript", f.session), map[string]any{"messages": userTurns(1)}, nil); code != 404 {
		t.Fatalf("non-owner must get 404, got %d", code)
	}
}

// The final guess of the mystery game comes after the last question: a
// requested judgement still updates the progress, without reopening.
func TestSaveTranscriptJudgesAnEndedAttemptOnlyOnRequest(t *testing.T) {
	f := newTranscriptFixture(t, map[string]any{"maxTurns": 1, "autoEnd": true}, 0.1)
	if out := f.save(t, map[string]any{"messages": userTurns(1)}); out["status"] != "turn_limit" {
		t.Fatalf("expected turn_limit: %v", out)
	}
	decisions := f.judge.decisions
	guess := append(userTurns(1), map[string]string{"role": "system", "content": "Risposta finale: Napoleone. Il personaggio era Napoleone."})
	f.save(t, map[string]any{"messages": guess})
	if f.judge.decisions != decisions {
		t.Fatal("an ended attempt is not judged by default")
	}
	f.judge.scores["goal_0"] = 0.95
	out := f.save(t, map[string]any{"messages": guess, "judge": true})
	if f.judge.decisions != decisions+1 || out["progress"] != float64(100) {
		t.Fatalf("the requested judgement updates the progress: %v", out)
	}
	if out["status"] != "turn_limit" || out["ended"] != true {
		t.Fatalf("the attempt stays ended: %v", out)
	}
	var d domain.SessionDetail
	f.owner.do("GET", fmtPath("/api/sessions/%d", f.session), nil, &d)
	if d.Progress != 100 || d.Status != "turn_limit" {
		t.Fatalf("stored: %d %s", d.Progress, d.Status)
	}
}
