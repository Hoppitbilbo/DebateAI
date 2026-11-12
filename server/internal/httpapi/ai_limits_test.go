package httpapi

import (
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
)

// Investigation 11/11, C5 (first step): the tasks that still take a
// caller-written prompt are bounded, so the platform is not a free general
// chatbot on the school's budget.
func TestUtilityRequestsAreBounded(t *testing.T) {
	f, p := recipeFixture(t, map[string]any{})
	rt := f.s.Settings.Routing()
	rt.Tasks[app.TaskUtility] = rt.Tasks[app.TaskChat]
	if err := f.s.Settings.SaveRouting(rt); err != nil {
		t.Fatal(err)
	}
	long := map[string]any{"task": "utility", "system": "x", "messages": []map[string]string{{"role": "user", "content": strings.Repeat("a", maxUtilityInputChars)}}}
	var out map[string]any
	if code := f.owner.do("POST", "/api/ai/generate", long, &out); code != 413 || out["error"] != "too_large" {
		t.Fatalf("utility over %d characters: %d %v", maxUtilityInputChars, code, out)
	}
	ok := map[string]any{"task": "utility", "system": "x", "maxTokens": 100000, "messages": []map[string]string{{"role": "user", "content": "Select a voice"}}}
	if code := f.owner.do("POST", "/api/ai/generate", ok, nil); code != 200 {
		t.Fatalf("short utility request: %d", code)
	}
	calls := p.calls()
	if len(calls) != 1 || calls[0].MaxTokens != maxUtilityOutputTokens {
		t.Fatalf("utility output capped at %d: %+v", maxUtilityOutputTokens, calls)
	}
}

func TestInputLimitPerTask(t *testing.T) {
	for _, c := range []struct {
		task     string
		loggedIn bool
		want     int
	}{
		{app.TaskChat, true, maxChatInputChars},
		{app.TaskUtility, true, maxUtilityInputChars},
		{app.TaskUtility, false, maxUtilityInputChars},
		{app.TaskEvaluation, true, maxChatInputChars},
		{app.TaskEvaluation, false, maxAnonymousEvaluationChars},
	} {
		if got := inputLimit(c.task, c.loggedIn); got != c.want {
			t.Errorf("inputLimit(%s, %v) = %d, want %d", c.task, c.loggedIn, got, c.want)
		}
	}
	msgs := []ai.Message{{Role: "user", Content: strings.Repeat("a", 50)}}
	if boundHistory("", msgs, 40) != nil {
		t.Fatal("a single message over the limit is refused")
	}
}
