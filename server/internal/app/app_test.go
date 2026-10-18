package app

import (
	"context"
	"fmt"
	"time"

	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// ---------- unit tests ----------

func TestSplitEmails(t *testing.T) {
	got := SplitEmails([]string{"a@x.it, B@x.it\n<c@x.it>; a@x.it"})
	want := []string{"a@x.it", "b@x.it", "c@x.it"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestFinalizeRespectsThresholdAndMinTurns(t *testing.T) {
	r := &JudgeResult{Goals: []GoalStatus{{Score: 0.9}, {Score: 0.5}}}
	finalize(r, []string{"a", "b"}, 0.7, 0, 3)
	if r.Progress != 50 || r.Completed {
		t.Fatalf("unexpected %+v", r)
	}
	r = &JudgeResult{Goals: []GoalStatus{{Score: 0.9}, {Score: 0.8}}}
	finalize(r, []string{"a", "b"}, 0.7, 5, 3)
	if r.Completed {
		t.Fatal("must not complete before min turns")
	}
	r = &JudgeResult{Goals: []GoalStatus{{Score: 0.9}, {Score: 0.8}}}
	finalize(r, []string{"a", "b"}, 0.7, 2, 3)
	if !r.Completed || r.Progress != 100 {
		t.Fatalf("expected completion %+v", r)
	}
}

func TestBuildStateTruncatesOldMessages(t *testing.T) {
	var msgs []TranscriptMessage
	for i := 0; i < 500; i++ {
		msgs = append(msgs, TranscriptMessage{Role: "user", Content: strings.Repeat("x", 100)})
	}
	msgs = append(msgs, TranscriptMessage{Role: "user", Content: "LAST MESSAGE"})
	s := buildState(judgeInput{Instructions: "do it", Goals: []string{"g"}, Transcript: msgs}, 5000)
	if len(s) > 6000 || !strings.Contains(s, "LAST MESSAGE") || !strings.Contains(s, "TEACHER ASSIGNMENT") {
		t.Fatalf("bad state (%d chars)", len(s))
	}
}

func TestRenderMailAllLocales(t *testing.T) {
	for _, l := range []string{"it", "en", "es", "fr", "de", "xx"} {
		for kind := range mailTexts {
			subj, body := RenderMail(kind, l, map[string]string{"site": "S", "link": "http://l", "name": "N", "inviter": "I", "class": "C", "role": "r", "title": "T", "due": ""})
			if subj == "" || body == "" || strings.Contains(subj+body, "{site}") {
				t.Fatalf("%s/%s not rendered", kind, l)
			}
		}
	}
}

func TestCryptoRoundTrip(t *testing.T) {
	c := NewCrypto("secret")
	enc := c.Encrypt("sk-123")
	if enc == "sk-123" {
		t.Fatal("not encrypted")
	}
	if dec, err := c.Decrypt(enc); err != nil || dec != "sk-123" {
		t.Fatalf("decrypt: %v %q", err, dec)
	}
	if _, err := NewCrypto("other").Decrypt(enc); err == nil {
		t.Fatal("wrong secret must fail")
	}
}

func itoa(n int64) string {
	return fmt.Sprintf("%d", n)
}

func TestGeminiVersion(t *testing.T) {
	if geminiVersion("gemini-3.1-flash-live-preview") != 3.1 || geminiVersion("gemini-live-2.5-flash") != 2.5 || geminiVersion("models/gemini-2.0-flash") != 2 || geminiVersion("aqa") != 0 {
		t.Fatal("version parse")
	}
}

func TestStreamFallsBackWhenFirstTokenIsLate(t *testing.T) {
	up := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/models") {
			fmt.Fprint(w, `{"data":[{"id":"slow"},{"id":"fast"}]}`)
			return
		}
		var body struct{ Model string }
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body.Model == "slow" {
			select {
			case <-r.Context().Done():
			case <-time.After(3 * time.Second):
			}
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Ciao\"}}]}\n\ndata: [DONE]\n\n")
	}))
	defer up.Close()

	old := firstTokenTimeout
	firstTokenTimeout = 200 * time.Millisecond
	defer func() { firstTokenTimeout = old }()

	s := newTestServer(t)
	prov, err := s.Gateway.AddProvider(context.Background(), NewProvider{Name: "Up", Kind: "openai", BaseURL: up.URL + "/v1", APIKey: "k"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Settings.SaveRouting(RoutingSettings{Strategy: "ordered", Tasks: map[string][]RouteTarget{
		TaskChat: {{prov.ID, "slow"}, {prov.ID, "fast"}},
	}}); err != nil {
		t.Fatal(err)
	}

	start := time.Now()
	var got strings.Builder
	res, err := s.Gateway.Generate(context.Background(), TaskChat, ai.Request{Messages: []ai.Message{{Role: "user", Content: "hi"}}}, nil, nil, func(d string) error {
		got.WriteString(d)
		return nil
	})
	if err != nil || res.Model != "fast" || got.String() != "Ciao" {
		t.Fatalf("fallback failed: %v %+v %q", err, res, got.String())
	}
	if time.Since(start) > 2*time.Second {
		t.Fatalf("waited for the slow model: %s", time.Since(start))
	}
}

func TestJevStateIsStructuredAndTruncated(t *testing.T) {
	var msgs []TranscriptMessage
	for i := 0; i < 200; i++ {
		msgs = append(msgs, TranscriptMessage{Role: "user", Content: strings.Repeat("parola ", 20)}, TranscriptMessage{Role: "assistant", Name: "Napoleone", Content: "risposta"})
	}
	st := jevState(judgeInput{Instructions: "Intervista", Transcript: msgs}, []string{"g1"}, 4000)
	if n := len(mustJSON(st)); n > 4000 {
		t.Fatalf("state too long: %d", n)
	}
	conv := st["conversation"].([]map[string]string)
	if st["earlier_messages_omitted"] == nil || conv[len(conv)-1]["from"] != "Napoleone" || conv[len(conv)-2]["from"] != "student" {
		t.Fatalf("bad state: %v", st["earlier_messages_omitted"])
	}
}
