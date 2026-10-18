package app

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// TestResponseShapes pins the JSON shape (keys and value types, recursively)
// of the API responses, so refactorings of the handlers cannot change the
// contract with the frontend by accident (refactoring task 1.4).
// Regenerate testdata/shapes.json with UPDATE_SHAPES=1 only for intended changes.

// shapeOf describes a JSON value: objects list their keys with nested shapes,
// arrays the distinct shapes of their elements, scalars their type.
func shapeOf(v any) string {
	switch x := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, len(keys))
		for i, k := range keys {
			parts[i] = k + ":" + shapeOf(x[k])
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		seen := map[string]bool{}
		var variants []string
		for _, e := range x {
			if sh := shapeOf(e); !seen[sh] {
				seen[sh] = true
				variants = append(variants, sh)
			}
		}
		sort.Strings(variants)
		return "[" + strings.Join(variants, "|") + "]"
	case string:
		return "string"
	case float64:
		return "number"
	case bool:
		return "bool"
	case nil:
		return "null"
	}
	return "?"
}

func TestResponseShapes(t *testing.T) {
	s := newTestServer(t)
	srv := httptest.NewServer(s.Handler())
	defer srv.Close()
	useProvider(s, 90, ai.KindOpenAI, &fakeProvider{})
	useProvider(s, 91, ai.KindJev, &fakeDecider{scores: map[string]float64{"goal_0": 0.9}})
	if err := putSetting(s.db, "routing", RoutingSettings{Strategy: "ordered", Tasks: map[string][]RouteTarget{
		TaskChat: {{90, "m"}}, TaskJudge: {{91, "jev"}},
	}}); err != nil {
		t.Fatal(err)
	}

	shapes := map[string]string{}
	call := func(c *client, name, method, path string, body any) map[string]any {
		t.Helper()
		var rdr io.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			rdr = bytes.NewReader(b)
		}
		req, _ := http.NewRequest(method, c.base+path, rdr)
		req.Header.Set("Content-Type", "application/json")
		resp, err := c.http.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		var v any
		if err := json.Unmarshal(raw, &v); err != nil {
			t.Fatalf("%s: %v: %s", name, err, raw)
		}
		shapes[name] = shapeOf(v)
		m, _ := v.(map[string]any)
		return m
	}

	guest := newClient(t, srv.URL)
	call(guest, "health", "GET", "/api/health", nil)
	call(guest, "public config", "GET", "/api/public/config", nil)
	call(guest, "me (guest)", "GET", "/api/auth/me", nil)

	admin := newClient(t, srv.URL)
	admin.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil)
	call(admin, "me", "GET", "/api/auth/me", nil)
	call(admin, "ai status", "GET", "/api/ai/status", nil)
	call(admin, "admin overview", "GET", "/api/admin/overview", nil)
	call(admin, "admin settings", "GET", "/api/admin/settings", nil)

	cls := call(admin, "create class", "POST", "/api/classes", map[string]string{"name": "3A"})
	classID := int64(cls["id"].(float64))
	inv := call(admin, "class invite", "POST", fmtPath("/api/classes/%d/invite", classID), map[string]any{"emails": []string{"stud@test.it", "admin@test.it", "bad"}})
	call(admin, "admin invites", "POST", "/api/admin/invites", map[string]any{"emails": []string{"new@test.it", "admin@test.it", "bad"}, "role": "teacher"})
	link := inv["results"].([]any)[0].(map[string]any)["link"].(string)
	token := regexp.MustCompile(`token=(.+)$`).FindStringSubmatch(link)[1]
	call(guest, "invite info", "GET", "/api/auth/invite/"+token, nil)
	call(admin, "class detail", "GET", fmtPath("/api/classes/%d", classID), nil)

	a := call(admin, "create assignment", "POST", fmtPath("/api/classes/%d/assignments", classID), map[string]any{
		"title": "T", "appType": "wiki-chatbot", "instructions": "I", "goals": []string{"g"}, "maxTurns": 5, "autoEnd": true,
	})
	assignmentID := int64(a["id"].(float64))

	stud := newClient(t, srv.URL)
	stud.do("POST", "/api/auth/register", map[string]string{"token": token, "name": "Stud", "password": "password123"}, nil)
	var code struct{ JoinCode string }
	admin.do("GET", fmtPath("/api/classes/%d", classID), nil, &struct{ Class *struct{ JoinCode string } }{Class: &code})
	call(stud, "join class", "POST", "/api/classes/join", map[string]string{"code": code.JoinCode})

	sess := call(stud, "create session", "POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot", "assignmentId": assignmentID})
	sessionID := int64(sess["id"].(float64))
	call(stud, "generate", "POST", "/api/ai/generate", map[string]any{"sessionId": sessionID, "messages": []map[string]string{{"role": "user", "content": "ciao"}}})
	call(stud, "live usage", "POST", "/api/ai/live/usage", map[string]any{"providerId": 90, "model": "m", "inputTokens": 10, "outputTokens": 5, "seconds": 3})
	call(stud, "transcript (judged)", "PUT", fmtPath("/api/sessions/%d/transcript", sessionID), map[string]any{"messages": userTurns(1)})
	call(stud, "transcript (ended)", "PUT", fmtPath("/api/sessions/%d/transcript", sessionID), map[string]any{"messages": userTurns(2)})
	call(stud, "complete session", "POST", fmtPath("/api/sessions/%d/complete", sessionID), map[string]any{"reflection": "r"})

	call(admin, "assignment progress", "GET", fmtPath("/api/assignments/%d/progress", assignmentID), nil)
	call(admin, "class progress", "GET", fmtPath("/api/classes/%d/progress", classID), nil)
	call(admin, "usage summary", "GET", "/api/admin/usage?days=1", nil)
	upstream := mockAI(t)
	defer upstream.Close()
	var llm, jev providerRow
	admin.do("POST", "/api/admin/providers", map[string]string{"name": "Mock", "kind": "openai", "baseUrl": upstream.URL + "/v1", "apiKey": "k"}, &llm)
	admin.do("POST", "/api/admin/providers", map[string]string{"name": "Jev", "kind": "jev", "baseUrl": upstream.URL + "/systemone", "apiKey": "k"}, &jev)
	call(admin, "test provider (llm)", "POST", fmtPath("/api/admin/providers/%d/test", llm.ID), map[string]string{"model": "paid-model"})
	call(admin, "test provider (jev)", "POST", fmtPath("/api/admin/providers/%d/test", jev.ID), map[string]string{"model": "jev"})
	call(admin, "delete assignment", "DELETE", fmtPath("/api/assignments/%d", assignmentID), nil)

	golden := filepath.Join("testdata", "shapes.json")
	got, _ := json.MarshalIndent(shapes, "", "  ")
	if os.Getenv("UPDATE_SHAPES") == "1" {
		if err := os.MkdirAll("testdata", 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(golden, append(got, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
		return
	}
	want, err := os.ReadFile(golden)
	if err != nil {
		t.Fatalf("missing %s (run with UPDATE_SHAPES=1): %v", golden, err)
	}
	var wantShapes map[string]string
	_ = json.Unmarshal(want, &wantShapes)
	for name, w := range wantShapes {
		if shapes[name] != w {
			t.Errorf("%s\n got: %s\nwant: %s", name, shapes[name], w)
		}
	}
	for name := range shapes {
		if _, ok := wantShapes[name]; !ok {
			t.Errorf("%s: not in %s", name, golden)
		}
	}
}
