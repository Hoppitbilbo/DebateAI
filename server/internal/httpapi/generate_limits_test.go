package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
)

func TestBoundHistoryKeepsTheNewestMessagesWithinTheCharacterBudget(t *testing.T) {
	big := strings.Repeat("x", maxChatInputChars/2)
	msgs := []ai.Message{{Role: "user", Content: big}, {Role: "assistant", Content: big}, {Role: "user", Content: "last"}}
	got := boundHistory("system", msgs)
	if len(got) != 2 || got[1].Content != "last" {
		t.Fatalf("oldest message should be dropped: %d", len(got))
	}
	if boundHistory(big, []ai.Message{{Role: "user", Content: big + "x"}}) != nil {
		t.Fatal("a last message that does not fit must refuse the request")
	}
	many := make([]ai.Message, maxChatHistoryMessages+5)
	if got := boundHistory("", many); len(got) != maxChatHistoryMessages {
		t.Fatalf("message count bound: %d", len(got))
	}
}

func TestGenerateRefusesBeyondConcurrentGenerations(t *testing.T) {
	s := newTestAPI(t)
	srv := httptest.NewServer(s.Handler())
	t.Cleanup(srv.Close)
	c := newClient(t, srv.URL)
	if code := c.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil); code != 201 {
		t.Fatalf("setup %d", code)
	}
	id := s.addFake(t, "fake", ai.KindOpenAI, fakeProvider{})
	if err := s.Settings.SaveRouting(app.RoutingSettings{Strategy: "ordered", Tasks: map[string][]app.RouteTarget{app.TaskChat: {{ProviderID: id, Model: "m"}}}}); err != nil {
		t.Fatal(err)
	}
	body := map[string]any{"recipe": wikiRecipe, "messages": []map[string]string{{"role": "user", "content": "ciao"}}}
	if code := c.do("POST", "/api/ai/generate", body, nil); code != 200 {
		t.Fatalf("free slot: %d", code)
	}
	for range maxGenerationsPerUser {
		if _, ok, err := s.Inflight.Acquire("user:1", maxGenerationsPerUser, "9999-01-01T00:00:00Z"); err != nil || !ok {
			t.Fatalf("hold slot: %v %v", ok, err)
		}
	}
	var out struct{ Error string }
	if code := c.do("POST", "/api/ai/generate", body, &out); code != 429 || out.Error != "busy" {
		t.Fatalf("expected 429 busy, got %d %+v", code, out)
	}
}
