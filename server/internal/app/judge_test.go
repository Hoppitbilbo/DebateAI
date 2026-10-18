package app

import (
	"context"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Characterization tests for the JEV judge (refactoring task 0.2).

// fakeDecider is a Jev-like provider: it answers every question with the
// score in scores (0 when missing) and remembers the last request.
type fakeDecider struct {
	scores    map[string]float64
	err       error
	state     any
	questions map[string]ai.JevQuestion
	decisions int
}

func (d *fakeDecider) Decide(ctx context.Context, model string, state any, qs map[string]ai.JevQuestion) (*ai.JevResult, error) {
	d.state, d.questions = state, qs
	d.decisions++
	if d.err != nil {
		return nil, d.err
	}
	answers := map[string]ai.JevAnswer{}
	for k := range qs {
		v := d.scores[k]
		answers[k] = ai.JevAnswer{Type: "noul", Noul: &v}
	}
	return &ai.JevResult{Model: model, Answers: answers, Usage: ai.Usage{InputTokens: 100, OutputTokens: 5}}, nil
}

func (d *fakeDecider) ListModels(ctx context.Context) ([]ai.ModelInfo, error) { return nil, nil }

// scriptedLLM returns the same text for every Generate call.
type scriptedLLM struct {
	*fakeProvider
	text string
	req  ai.Request
}

func (p *scriptedLLM) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	p.req = req
	return &ai.Response{Text: p.text}, nil
}

func setJudgeRoute(t *testing.T, s *Server, targets ...RouteTarget) {
	t.Helper()
	if err := s.settingsSvc.SaveRouting(RoutingSettings{Strategy: "ordered", Tasks: map[string][]RouteTarget{TaskJudge: targets}}); err != nil {
		t.Fatal(err)
	}
}

func judgeIn(goals ...string) judgeInput {
	return judgeInput{
		Instructions: "Intervista Napoleone",
		Goals:        goals,
		Transcript:   []transcriptMsg{{Role: "user", Content: "Perché la Russia?"}, {Role: "assistant", Name: "Napoleone", Content: "Per l'Inghilterra."}},
		Locale:       "it",
		Turns:        1,
	}
}

func TestJudgeWithoutGoalsOrInstructionsDoesNothing(t *testing.T) {
	s := newTestServer(t)
	in := judgeIn()
	in.Instructions = "  "
	if r := s.gateway.judge(context.Background(), in, nil, nil); r.Engine != "none" || r.Error != "" {
		t.Fatalf("expected no evaluation: %+v", r)
	}
}

func TestJudgeDisabledDoesNothing(t *testing.T) {
	s := newTestServer(t)
	if err := s.settingsSvc.SaveJev(JevSettings{Enabled: false}); err != nil {
		t.Fatal(err)
	}
	d := &fakeDecider{}
	useProvider(s, 1, ai.KindJev, d)
	setJudgeRoute(t, s, RouteTarget{1, "jev"})
	if r := s.gateway.judge(context.Background(), judgeIn("g"), nil, nil); r.Engine != "none" || d.questions != nil {
		t.Fatalf("disabled judge must not run: %+v", r)
	}
}

func TestJudgeWithJevAsksOneQuestionPerGoal(t *testing.T) {
	s := newTestServer(t)
	d := &fakeDecider{scores: map[string]float64{"goal_0": 0.9, "goal_1": 0.3, "off_topic": 0.85}}
	useProvider(s, 1, ai.KindJev, d)
	setJudgeRoute(t, s, RouteTarget{1, "jev-latest"})

	r := s.gateway.judge(context.Background(), judgeIn("chiedere della Russia", "chiedere di Mosca"), nil, nil)
	if r.Engine != "jev" || r.Model != "jev-latest" || r.Progress != 50 || r.Completed || !r.OffTopic {
		t.Fatalf("unexpected result: %+v", r)
	}
	if !r.Goals[0].Met || r.Goals[1].Met || r.Goals[0].Text != "chiedere della Russia" {
		t.Fatalf("goal status: %+v", r.Goals)
	}
	for _, k := range []string{"goal_0", "goal_1", "off_topic", "manipulation"} {
		if _, ok := d.questions[k]; !ok {
			t.Errorf("missing question %s", k)
		}
	}
	if _, ok := d.state.(map[string]any); !ok {
		t.Fatalf("jev state must be structured, got %T", d.state)
	}
	if ok, _ := usageRows(t, s); ok != 1 {
		t.Fatalf("usage not logged")
	}
}

func TestJudgeUsesInstructionsAsGoalWhenNoGoals(t *testing.T) {
	s := newTestServer(t)
	d := &fakeDecider{scores: map[string]float64{"goal_0": 0.95}}
	useProvider(s, 1, ai.KindJev, d)
	setJudgeRoute(t, s, RouteTarget{1, "jev"})

	r := s.gateway.judge(context.Background(), judgeIn(), nil, nil)
	if len(r.Goals) != 1 || !strings.Contains(r.Goals[0].Text, "Intervista Napoleone") || !r.Completed || r.Progress != 100 {
		t.Fatalf("instructions should become the only goal: %+v", r)
	}
}

func TestJudgeWithLLMParsesFencedJSON(t *testing.T) {
	s := newTestServer(t)
	llm := &scriptedLLM{fakeProvider: &fakeProvider{}, text: "Ecco:\n```json\n" +
		`{"goals":[{"index":0,"score":0,"met":true},{"index":1,"score":0.2},{"index":7,"score":1}],"completed":false,"offTopic":false,"hint":"Chiedi di Mosca"}` +
		"\n```"}
	useProvider(s, 1, ai.KindOpenAI, llm)
	setJudgeRoute(t, s, RouteTarget{1, "judge-model"})

	r := s.gateway.judge(context.Background(), judgeIn("a", "b"), nil, nil)
	if r.Engine != "llm" || r.Hint != "Chiedi di Mosca" || r.Progress != 50 {
		t.Fatalf("unexpected result: %+v", r)
	}
	if r.Goals[0].Score != 1 || !r.Goals[0].Met || r.Goals[1].Met {
		t.Fatalf("met:true with score 0 counts as 1, out-of-range index ignored: %+v", r.Goals)
	}
	if !llm.req.JSON || !strings.Contains(llm.req.System, "Italian") || !strings.Contains(llm.req.Messages[0].Content, "TEACHER ASSIGNMENT") {
		t.Fatalf("bad LLM request: %+v", llm.req)
	}
}

func TestJudgeLLMCompletedIsBlockedByMinTurns(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, &scriptedLLM{fakeProvider: &fakeProvider{}, text: `{"goals":[{"index":0,"score":0.1}],"completed":true}`})
	setJudgeRoute(t, s, RouteTarget{1, "m"})

	in := judgeIn("a")
	if r := s.gateway.judge(context.Background(), in, nil, nil); !r.Completed || r.Progress != 100 {
		t.Fatalf("model-declared completion should be kept: %+v", r)
	}
	in.MinTurns, in.Turns = 3, 1
	if r := s.gateway.judge(context.Background(), in, nil, nil); r.Completed {
		t.Fatalf("completion before MinTurns: %+v", r)
	}
}

func TestJudgeFallsBackToNextTarget(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindOpenAI, &scriptedLLM{fakeProvider: &fakeProvider{}, text: "not json"})
	useProvider(s, 2, ai.KindJev, &fakeDecider{scores: map[string]float64{"goal_0": 0.8}})
	setJudgeRoute(t, s, RouteTarget{1, "bad"}, RouteTarget{2, "jev"})

	r := s.gateway.judge(context.Background(), judgeIn("a"), nil, nil)
	if r.Engine != "jev" || !r.Completed {
		t.Fatalf("expected fallback to jev: %+v", r)
	}
	if ok, failed := usageRows(t, s); ok != 1 || failed != 1 {
		t.Fatalf("usage log ok=%d failed=%d", ok, failed)
	}
}

func TestJudgeAllTargetsFailing(t *testing.T) {
	s := newTestServer(t)
	useProvider(s, 1, ai.KindJev, &fakeDecider{err: &ai.HTTPError{Status: 500, Body: "down"}})
	setJudgeRoute(t, s, RouteTarget{1, "jev"})

	r := s.gateway.judge(context.Background(), judgeIn("a"), nil, nil)
	if r.Engine != "none" || !strings.Contains(r.Error, "down") {
		t.Fatalf("expected error result: %+v", r)
	}
}

func TestJudgeInvalidThresholdFallsBackToDefault(t *testing.T) {
	s := newTestServer(t)
	if err := s.settingsSvc.SaveJev(JevSettings{Enabled: true, Threshold: 1.5}); err != nil {
		t.Fatal(err)
	}
	useProvider(s, 1, ai.KindJev, &fakeDecider{scores: map[string]float64{"goal_0": 0.75}})
	setJudgeRoute(t, s, RouteTarget{1, "jev"})

	if r := s.gateway.judge(context.Background(), judgeIn("a"), nil, nil); !r.Goals[0].Met {
		t.Fatalf("0.75 must pass the default 0.7 threshold: %+v", r)
	}
}

func TestFinalizeAllGoalsMetCompletes(t *testing.T) {
	r := &JudgeResult{Goals: []GoalStatus{{Score: 0.7}, {Score: 1}}}
	finalize(r, []string{"a", "b"}, 0.7, 0, 1)
	if !r.Completed || r.Progress != 100 || !r.Goals[0].Met {
		t.Fatalf("threshold is inclusive: %+v", r)
	}
	r = &JudgeResult{}
	finalize(r, nil, 0.7, 0, 1)
	if r.Completed || r.Progress != 0 {
		t.Fatalf("no goals must not complete: %+v", r)
	}
}
