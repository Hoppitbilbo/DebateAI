// mockai is a fake OpenAI-compatible provider for load tests: it answers
// /models and /chat/completions (streamed or not) after a realistic delay,
// so a load test measures DebateAI and not a real provider's quota.
//
// Env: PORT (8090), MOCK_FIRST_TOKEN_MS (800), MOCK_TOKENS (60),
// MOCK_TOKEN_MS (30).
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

func envInt(key string, def int) int {
	if n, err := strconv.Atoi(os.Getenv(key)); err == nil && n >= 0 {
		return n
	}
	return def
}

var (
	firstToken = time.Duration(envInt("MOCK_FIRST_TOKEN_MS", 800)) * time.Millisecond
	tokens     = envInt("MOCK_TOKENS", 60)
	tokenGap   = time.Duration(envInt("MOCK_TOKEN_MS", 30)) * time.Millisecond
)

// The judge and the evaluator ask for JSON; a valid object keeps them on
// their normal path.
const jsonAnswer = `{"score":7,"feedback":"Buon lavoro.","goals":[],"progress":50,"offTopic":0,"identified":0}`

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /models", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]any{"data": []map[string]any{{"id": "mock-chat", "object": "model"}}})
	})
	mux.HandleFunc("POST /chat/completions", chat)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}
	log.Printf("mockai on :%s (first token %v, %d tokens every %v)", port, firstToken, tokens, tokenGap)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func chat(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Stream         bool           `json:"stream"`
		ResponseFormat map[string]any `json:"response_format"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	wantJSON := in.ResponseFormat != nil

	select {
	case <-time.After(firstToken):
	case <-r.Context().Done():
		return
	}
	usage := map[string]int{"prompt_tokens": 500, "completion_tokens": tokens, "total_tokens": 500 + tokens}

	if !in.Stream {
		text := jsonAnswer
		if !wantJSON {
			var b strings.Builder
			for i := range tokens {
				fmt.Fprintf(&b, "parola%d ", i)
			}
			text = b.String()
		}
		time.Sleep(time.Duration(tokens) * tokenGap)
		writeJSON(w, map[string]any{
			"model":   "mock-chat",
			"choices": []map[string]any{{"index": 0, "message": map[string]string{"role": "assistant", "content": text}, "finish_reason": "stop"}},
			"usage":   usage,
		})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	flusher, _ := w.(http.Flusher)
	send := func(v any) bool {
		b, _ := json.Marshal(v)
		if _, err := fmt.Fprintf(w, "data: %s\n\n", b); err != nil {
			return false
		}
		if flusher != nil {
			flusher.Flush()
		}
		return true
	}
	delta := func(s string) map[string]any {
		return map[string]any{"model": "mock-chat", "choices": []map[string]any{{"index": 0, "delta": map[string]string{"content": s}}}}
	}
	if wantJSON {
		send(delta(jsonAnswer))
	} else {
		for i := range tokens {
			if !send(delta(fmt.Sprintf("parola%d ", i))) {
				return
			}
			select {
			case <-time.After(tokenGap):
			case <-r.Context().Done():
				return
			}
		}
	}
	send(map[string]any{"model": "mock-chat", "choices": []map[string]any{{"index": 0, "delta": map[string]string{}, "finish_reason": "stop"}}, "usage": usage})
	fmt.Fprint(w, "data: [DONE]\n\n")
	if flusher != nil {
		flusher.Flush()
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
