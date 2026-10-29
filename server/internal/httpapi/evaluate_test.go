package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// gradingProvider answers an evaluation with fixed scores and remembers the prompt.
type gradingProvider struct {
	fakeProvider
	prompt *string
}

const gradedAnswer = "## Bravo\nGood questions.\n\nSCORE_CONVERSATION: 8\nSCORE_REFLECTION: 6/10"

func (g gradingProvider) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	*g.prompt = req.Messages[len(req.Messages)-1].Content
	return &ai.Response{Text: gradedAnswer}, onDelta(gradedAnswer)
}

func TestEvaluateGradesTheStoredTranscriptOnTheServer(t *testing.T) {
	s := newTestAPI(t)
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(srv.Close)
	c := newClient(t, srv.URL)
	if code := c.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil); code != 201 {
		t.Fatalf("setup %d", code)
	}
	var prompt string
	id := s.addFake(t, "grader", ai.KindOpenAI, gradingProvider{prompt: &prompt})
	if err := s.Settings.SaveRouting(app.RoutingSettings{Strategy: "ordered", Tasks: map[string][]app.RouteTarget{app.TaskEvaluation: {{ProviderID: id, Model: "m"}}}}); err != nil {
		t.Fatal(err)
	}
	var sess domain.SessionSummary
	if code := c.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot"}, &sess); code != 201 {
		t.Fatalf("create session %d", code)
	}
	c.do("PUT", fmtPath("/api/sessions/%d/transcript", sess.ID), map[string]any{"messages": []map[string]string{
		{"role": "user", "content": "Perché la Russia?"}, {"role": "assistant", "name": "Napoleone", "content": "Il blocco continentale"},
	}}, nil)

	body, _ := json.Marshal(map[string]any{"reflection": "ho imparato", "activity": "WikiChat", "characters": "Napoleone", "locale": "en",
		"scoreConversation": 10}) // a forged score is ignored
	req, _ := http.NewRequest("POST", srv.URL+fmtPath("/api/sessions/%d/evaluate", sess.ID), bytes.NewReader(body))
	resp, err := c.http.Do(req)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("evaluate: %v %v", err, resp.StatusCode)
	}
	stream, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if !strings.Contains(string(stream), `"done":true`) || !strings.Contains(string(stream), `"scoreConversation":8`) {
		t.Fatalf("stream: %s", stream)
	}
	if !strings.Contains(prompt, "Student: Perché la Russia?") || !strings.Contains(prompt, "Napoleone: Il blocco continentale") || !strings.Contains(prompt, "ho imparato") {
		t.Fatalf("the prompt must carry the stored transcript and the reflection: %s", prompt)
	}

	d, _ := s.Sessions.Detail(sess.ID)
	if d.Status != domain.SessionCompleted || *d.ScoreConversation != 8 || *d.ScoreReflection != 6 || strings.Contains(d.Evaluation, "SCORE_") || d.Reflection != "ho imparato" {
		t.Fatalf("stored: %+v", d)
	}
	var out apiError
	if code := c.do("POST", fmtPath("/api/sessions/%d/evaluate", sess.ID), map[string]any{"reflection": "x"}, &out); code != 409 || out.Error != "session_completed" {
		t.Fatalf("a handed-in attempt is not evaluated again: %d %+v", code, out)
	}
}

// slowGrader answers after a pause, as a real model writing an evaluation.
type slowGrader struct{ fakeProvider }

func (slowGrader) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(300 * time.Millisecond):
	}
	return &ai.Response{Text: gradedAnswer}, onDelta(gradedAnswer)
}

// A closed tab does not lose the hand-in: the evaluation goes on and is stored.
func TestEvaluateHandsInEvenWhenTheBrowserGoesAway(t *testing.T) {
	s := newTestAPI(t)
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(srv.Close)
	c := newClient(t, srv.URL)
	c.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil)
	id := s.addFake(t, "slow", ai.KindOpenAI, slowGrader{})
	if err := s.Settings.SaveRouting(app.RoutingSettings{Strategy: "ordered", Tasks: map[string][]app.RouteTarget{app.TaskEvaluation: {{ProviderID: id, Model: "m"}}}}); err != nil {
		t.Fatal(err)
	}
	var sess domain.SessionSummary
	c.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot"}, &sess)

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, "POST", srv.URL+fmtPath("/api/sessions/%d/evaluate", sess.ID), strings.NewReader(`{"reflection":"r"}`))
	if resp, err := c.http.Do(req); err == nil {
		_, _ = io.ReadAll(resp.Body) // the client gives up while the model is still writing
		resp.Body.Close()
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if d, _ := s.Sessions.Detail(sess.ID); d.Status == domain.SessionCompleted {
			if *d.ScoreConversation != 8 {
				t.Fatalf("stored: %+v", d)
			}
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("the attempt was not handed in after the browser went away")
}
