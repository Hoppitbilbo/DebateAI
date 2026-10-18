package ai

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStripThinking(t *testing.T) {
	cases := map[string]string{
		"<think>a</think>Hello":       "Hello",
		"Hi <think>x</think>there":    "Hi there",
		"no tags":                     "no tags",
		"<think>unterminated forever": "",
	}
	for in, want := range cases {
		if got := stripThinking(in); got != want {
			t.Errorf("%q -> %q, want %q", in, got, want)
		}
	}
}

func TestIsLikelyFree(t *testing.T) {
	if !IsLikelyFree("http://localhost:11434/v1", "llama3") || !IsLikelyFree("https://openrouter.ai/api/v1", "x/y:free") ||
		!IsLikelyFree("https://opencode.ai/inference/openai/v1", "big-pickle") || IsLikelyFree("https://api.openai.com/v1", "gpt-5") {
		t.Fatal("free detection wrong")
	}
}

func TestOpenAIStream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		for _, d := range []string{"Ciao", " mondo"} {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":%q}}]}\n\n", d)
		}
		fmt.Fprint(w, "data: {\"choices\":[],\"usage\":{\"prompt_tokens\":7,\"completion_tokens\":3}}\n\ndata: [DONE]\n\n")
	}))
	defer srv.Close()
	p := newOpenAI(Config{Kind: KindOpenAI, BaseURL: srv.URL})
	var parts []string
	res, err := p.Stream(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "hi"}}}, func(d string) error {
		parts = append(parts, d)
		return nil
	})
	if err != nil || res.Text != "Ciao mondo" || len(parts) != 2 || res.Usage.InputTokens != 7 || res.Usage.OutputTokens != 3 {
		t.Fatalf("stream: %v %+v %v", err, res, parts)
	}
}

func TestAnthropicStreamAndRoles(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("anthropic-version") == "" {
			w.WriteHeader(400)
			return
		}
		fmt.Fprint(w, "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":11}}}\n\n")
		fmt.Fprint(w, "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Salve\"}}\n\n")
		fmt.Fprint(w, "data: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":2}}\n\n")
	}))
	defer srv.Close()
	p := newAnthropic(Config{Kind: KindAnthropic, BaseURL: srv.URL, APIKey: "k"})
	// first message from assistant must be preceded by a user turn; consecutive roles merged
	body := p.build(Request{Messages: []Message{{Role: "assistant", Content: "a"}, {Role: "user", Content: "b"}, {Role: "user", Content: "c"}}}, false)
	if body.Messages[0].Role != "user" || len(body.Messages) != 3 || !strings.Contains(body.Messages[2].Content, "c") {
		t.Fatalf("roles: %+v", body.Messages)
	}
	res, err := p.Stream(context.Background(), Request{Model: "claude", Messages: []Message{{Role: "user", Content: "hi"}}}, func(string) error { return nil })
	if err != nil || res.Text != "Salve" || res.Usage.InputTokens != 11 || res.Usage.OutputTokens != 2 {
		t.Fatalf("anthropic: %v %+v", err, res)
	}
}

func TestHTTPErrorPropagates(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(429)
		_, _ = w.Write([]byte("rate limited"))
	}))
	defer srv.Close()
	p := newOpenAI(Config{Kind: KindOpenAI, BaseURL: srv.URL})
	_, err := p.Generate(context.Background(), Request{Model: "m", Messages: []Message{{Role: "user", Content: "x"}}})
	he, ok := err.(*HTTPError)
	if !ok || he.Status != 429 {
		t.Fatalf("want HTTPError 429, got %v", err)
	}
}

func TestOpenRouterVariablePriceAndReportedCost(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/models" {
			fmt.Fprint(w, `{"data":[{"id":"typesafe/jev-router","pricing":{"prompt":"-1","completion":"-1"}},{"id":"a/b","pricing":{"prompt":"0.000001","completion":"0.000002"}}]}`)
			return
		}
		fmt.Fprint(w, `{"choices":[{"message":{"content":"ok"}}],"usage":{"prompt_tokens":10,"completion_tokens":2,"cost":0.00042}}`)
	}))
	defer srv.Close()
	p := newOpenAI(Config{Kind: KindOpenAI, BaseURL: srv.URL})
	models, err := p.ListModels(context.Background())
	if err != nil || len(models) != 2 {
		t.Fatalf("models: %v %+v", err, models)
	}
	// (Free is true here only because the test server is on 127.0.0.1.)
	if models[0].InputPerM != nil || models[0].OutputPerM != nil {
		t.Fatalf("variable price must stay unknown: %+v", models[0])
	}
	if models[1].InputPerM == nil || *models[1].InputPerM != 1 || *models[1].OutputPerM != 2 {
		t.Fatalf("fixed price: %+v", models[1])
	}
	res, err := p.Generate(context.Background(), Request{Model: "typesafe/jev-router", Messages: []Message{{Role: "user", Content: "hi"}}})
	if err != nil || res.Usage.CostUSD == nil || *res.Usage.CostUSD != 0.00042 {
		t.Fatalf("reported cost: %v %+v", err, res.Usage)
	}
}

func TestProviderCapabilities(t *testing.T) {
	for _, kind := range []string{KindGemini, KindOpenAI, KindAnthropic} {
		p, err := New(Config{Kind: kind})
		if err != nil {
			t.Fatal(err)
		}
		if _, ok := p.(TextModel); !ok {
			t.Errorf("%s must be a TextModel", kind)
		}
		if _, ok := p.(Decider); ok {
			t.Errorf("%s must not be a Decider", kind)
		}
	}
	jev, _ := New(Config{Kind: KindJev})
	if _, ok := jev.(Decider); !ok {
		t.Error("jev must be a Decider")
	}
	if _, ok := jev.(Generator); ok {
		t.Error("jev must not pretend to generate text")
	}
}
