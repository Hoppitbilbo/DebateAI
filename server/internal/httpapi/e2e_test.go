package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/app"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// ---------- end-to-end ----------

// mockAI serves an OpenAI-compatible endpoint and a Jev /systemone endpoint.
func mockAI(t *testing.T) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		switch {
		case strings.HasSuffix(r.URL.Path, "/models"):
			_, _ = w.Write([]byte(`{"data":[{"id":"free-model","pricing":{"prompt":"0","completion":"0"}},{"id":"paid-model","pricing":{"prompt":"0.000001","completion":"0.000002"}}]}`))
		case strings.HasSuffix(r.URL.Path, "/systemone"):
			var req struct {
				State struct {
					Conversation json.RawMessage `json:"conversation"`
				} `json:"state"`
				Questions map[string]json.RawMessage `json:"questions"`
			}
			_ = json.Unmarshal(body, &req)
			conv := string(req.State.Conversation)
			answers := map[string]any{}
			for k := range req.Questions {
				v := 0.1
				// goal_0 met once the student asked about Russia; goal_1 once about Moscow
				if (k == "goal_0" && strings.Contains(conv, "Russia")) || (k == "goal_1" && strings.Contains(conv, "Mosca")) {
					v = 0.95
				}
				answers[k] = map[string]any{"type": "noul", "noul": v}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"model": "jev-1.13.0", "answers": answers, "usage": map[string]int{"input_tokens": 300, "output_tokens": 10}})
		case strings.HasSuffix(r.URL.Path, "/chat/completions"):
			var req struct {
				Model string `json:"model"`
			}
			_ = json.Unmarshal(body, &req)
			if req.Model == "broken" {
				w.WriteHeader(429)
				_, _ = w.Write([]byte(`quota`))
				return
			}
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"<think>hmm</think>Sono Napoleone."}}],"usage":{"prompt_tokens":1000,"completion_tokens":500}}`))
		default:
			w.WriteHeader(404)
		}
	}))
}

type client struct {
	t       *testing.T
	base    string
	http    *http.Client
	headers map[string]string // sent with every request
}

func newClient(t *testing.T, base string) *client {
	jar, _ := cookiejar.New(nil)
	return &client{t: t, base: base, http: &http.Client{Jar: jar}}
}

func (c *client) do(method, path string, in any, out any) int {
	c.t.Helper()
	var rdr io.Reader
	if in != nil {
		b, _ := json.Marshal(in)
		rdr = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, c.base+path, rdr)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if out != nil && len(b) > 0 {
		if err := json.Unmarshal(b, out); err != nil {
			c.t.Fatalf("%s %s: %v: %s", method, path, err, b)
		}
	}
	return resp.StatusCode
}

func TestEndToEndAssignmentWithJev(t *testing.T) {
	ai := mockAI(t)
	defer ai.Close()

	dir := t.TempDir()
	cfg := app.Config{DataDir: dir, DatabasePath: filepath.Join(dir, "t.db"), Secret: "test-secret"}
	db, err := app.OpenDB(cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	srv := httptest.NewServer(NewServer(cfg, app.NewServices(cfg, db), nil).Handler())
	defer srv.Close()

	admin := newClient(t, srv.URL)
	if code := admin.do("POST", "/api/setup", map[string]string{"name": "Admin", "email": "admin@test.it", "password": "password123"}, nil); code != 201 {
		t.Fatalf("setup %d", code)
	}
	if code := admin.do("POST", "/api/setup", map[string]string{"name": "X", "email": "x@test.it", "password": "password123"}, nil); code != 409 {
		t.Fatalf("second setup must fail, got %d", code)
	}

	// providers: an OpenAI-compatible one (models + prices imported) and Jev
	var prov app.ProviderView
	admin.do("POST", "/api/admin/providers", map[string]string{"name": "Mock", "kind": "openai", "baseUrl": ai.URL + "/v1", "apiKey": "k"}, &prov)
	if len(prov.Models) != 2 {
		t.Fatalf("models not imported: %+v", prov)
	}
	var jev app.ProviderView
	admin.do("POST", "/api/admin/providers", map[string]string{"name": "Jev", "kind": "jev", "baseUrl": ai.URL + "/systemone", "apiKey": "k"}, &jev)

	// routing: broken model first to exercise fallback; Jev as judge
	admin.do("PUT", "/api/admin/settings/routing", map[string]any{"strategy": "ordered", "tasks": map[string]any{
		"chat":  []map[string]any{{"providerId": prov.ID, "model": "broken"}, {"providerId": prov.ID, "model": "paid-model"}},
		"judge": []map[string]any{{"providerId": jev.ID, "model": "jev-1.13-free"}},
	}}, nil)

	// class + invite a student (no SMTP -> link returned)
	var cls domain.Class
	admin.do("POST", "/api/classes", map[string]string{"name": "3A"}, &cls)
	var inv struct {
		Results []struct{ Link string } `json:"results"`
	}
	admin.do("POST", fmtPath("/api/classes/%d/invite", cls.ID), map[string]any{"emails": []string{"stud@test.it"}}, &inv)
	if len(inv.Results) != 1 || inv.Results[0].Link == "" {
		t.Fatalf("invite: %+v", inv)
	}
	token := regexp.MustCompile(`token=(.+)$`).FindStringSubmatch(inv.Results[0].Link)[1]

	var a domain.Assignment
	admin.do("POST", fmtPath("/api/classes/%d/assignments", cls.ID), map[string]any{
		"title": "Napoleone", "appType": "wiki-chatbot", "instructions": "Intervista Napoleone",
		"goals": []string{"Chiede della Russia", "Chiede di Mosca"}, "maxTurns": 10,
	}, &a)

	// student registers through the invite and sees the assignment
	stud := newClient(t, srv.URL)
	if code := stud.do("POST", "/api/auth/register", map[string]string{"token": token, "name": "Stud", "password": "password123"}, nil); code != 201 {
		t.Fatalf("register %d", code)
	}
	if code := stud.do("POST", "/api/auth/register", map[string]string{"token": token, "name": "Stud", "password": "password123"}, nil); code != 404 {
		t.Fatalf("invite reuse must fail, got %d", code)
	}
	var mine []domain.Assignment
	stud.do("GET", "/api/me/assignments", nil, &mine)
	if len(mine) != 1 {
		t.Fatalf("student assignments: %+v", mine)
	}
	if code := stud.do("GET", "/api/admin/overview", nil, nil); code != 403 {
		t.Fatalf("student must not reach admin, got %d", code)
	}

	var sess domain.SessionSummary
	stud.do("POST", "/api/sessions", map[string]any{"appType": "wiki-chatbot", "assignmentId": a.ID}, &sess)

	// chat goes through the fallback chain and strips <think>
	var gen struct{ Text, Model string }
	stud.do("POST", "/api/ai/generate", map[string]any{"sessionId": sess.ID, "messages": []map[string]string{{"role": "user", "content": "ciao"}}}, &gen)
	if gen.Text != "Sono Napoleone." || gen.Model != "paid-model" {
		t.Fatalf("generate: %+v", gen)
	}

	type syncResp struct {
		Status   string          `json:"status"`
		Ended    bool            `json:"ended"`
		Progress int             `json:"progress"`
		Jev      app.JudgeResult `json:"jev"`
	}
	var s1 syncResp
	stud.do("PUT", fmtPath("/api/sessions/%d/transcript", sess.ID), map[string]any{"messages": []map[string]string{
		{"role": "user", "content": "Perché hai invaso la Russia?"}, {"role": "assistant", "content": "Il blocco continentale"},
	}}, &s1)
	if s1.Ended || s1.Progress != 50 || s1.Jev.Engine != "jev" {
		t.Fatalf("first judge: %+v", s1)
	}
	var s2 syncResp
	stud.do("PUT", fmtPath("/api/sessions/%d/transcript", sess.ID), map[string]any{"messages": []map[string]string{
		{"role": "user", "content": "Perché hai invaso la Russia?"}, {"role": "assistant", "content": "Il blocco continentale"},
		{"role": "user", "content": "E a Mosca cosa è successo?"},
	}}, &s2)
	if !s2.Ended || s2.Status != "goal_reached" || s2.Progress != 100 {
		t.Fatalf("goal should be reached: %+v", s2)
	}
	// chat on an ended session is refused
	if code := stud.do("POST", "/api/ai/generate", map[string]any{"sessionId": sess.ID, "messages": []map[string]string{{"role": "user", "content": "ancora"}}}, nil); code != 409 {
		t.Fatalf("ended session must refuse chat, got %d", code)
	}
	stud.do("POST", fmtPath("/api/sessions/%d/complete", sess.ID), map[string]any{"reflection": "ho imparato", "evaluation": "ok", "scoreConversation": 8}, nil)

	// teacher sees progress and costs are tracked (paid-model: 1000*1 + 500*2 per 1M = 0.002)
	var prog struct {
		Students []app.StudentProgress `json:"students"`
	}
	admin.do("GET", fmtPath("/api/assignments/%d/progress", a.ID), nil, &prog)
	if len(prog.Students) != 1 || prog.Students[0].Session == nil || prog.Students[0].Session.Status != "completed" {
		t.Fatalf("progress: %+v", prog)
	}
	if c := prog.Students[0].Session.CostUSD; c < 0.0019 || c > 0.0021 {
		t.Fatalf("session cost %v", c)
	}
	var usage struct {
		ByTask []struct {
			Key      string
			Requests int
		} `json:"byTask"`
	}
	admin.do("GET", "/api/admin/usage?days=1", nil, &usage)
	tasks := map[string]int{}
	for _, x := range usage.ByTask {
		tasks[x.Key] = x.Requests
	}
	if tasks["chat"] != 2 || tasks["judge"] != 2 { // broken + paid; two judge calls
		t.Fatalf("usage by task: %+v", tasks)
	}

	// budget: once exhausted, paid models are skipped and no free chat model -> error
	admin.do("PUT", "/api/admin/settings/routing", map[string]any{"strategy": "ordered", "tasks": map[string]any{
		"chat": []map[string]any{{"providerId": prov.ID, "model": "paid-model"}},
	}}, nil)
	admin.do("PUT", "/api/admin/settings/budget", map[string]any{"monthlyUsd": 0.001, "warnPercent": 80, "blockPaidWhenExceeded": true}, nil)
	var errOut apiError
	if code := admin.do("POST", "/api/ai/generate", map[string]any{"messages": []map[string]string{{"role": "user", "content": "x"}}}, &errOut); code != 502 || !strings.Contains(errOut.Message, "budget") {
		t.Fatalf("budget block: %d %+v", code, errOut)
	}
}

func fmtPath(f string, id int64) string {
	return strings.Replace(f, "%d", itoa(id), 1)
}

func itoa(n int64) string {
	b, _ := json.Marshal(n)
	return string(b)
}
