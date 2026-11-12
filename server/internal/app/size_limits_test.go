package app

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Investigation 11/11, C4: what a student or a room guest sends is bounded
// before it is stored, judged or evaluated.

func TestStartRefusesAnOversizedContext(t *testing.T) {
	s := newTestServer(t)
	u := newRoomTestUser(t, s, "s@x.it", domain.RoleStudent)
	big := json.RawMessage(`{"x":"` + strings.Repeat("a", maxSessionContextBytes) + `"}`)
	if _, err := s.SessionSvc.Start(u, NewAttempt{AppType: "wiki-chatbot", Context: big}); !IsInvalid(err) {
		t.Fatalf("context over %d bytes: %v", maxSessionContextBytes, err)
	}
	if _, err := s.SessionSvc.Start(u, NewAttempt{AppType: "wiki-chatbot", Context: json.RawMessage(`{"page":{"title":"Galileo"}}`)}); err != nil {
		t.Fatal(err)
	}
}

func TestStartIsLimitedPerUserPerDay(t *testing.T) {
	s := newTestServer(t)
	u := newRoomTestUser(t, s, "s@x.it", domain.RoleStudent)
	for i := range maxAttemptsPerDay {
		if _, err := s.SessionSvc.Start(u, NewAttempt{AppType: "wiki-chatbot"}); err != nil {
			t.Fatalf("attempt %d: %v", i+1, err)
		}
	}
	if _, err := s.SessionSvc.Start(u, NewAttempt{AppType: "wiki-chatbot"}); !errors.Is(err, ErrTooManyAttempts) {
		t.Fatalf("attempt %d of the day: %v", maxAttemptsPerDay+1, err)
	}
	other := newRoomTestUser(t, s, "o@x.it", domain.RoleStudent)
	if _, err := s.SessionSvc.Start(other, NewAttempt{AppType: "wiki-chatbot"}); err != nil {
		t.Fatal("the limit is per user")
	}
}

func TestSaveTranscriptBoundsMessagesAndTotal(t *testing.T) {
	s := newTestServer(t)
	u := newRoomTestUser(t, s, "s@x.it", domain.RoleStudent)
	ss, err := s.SessionSvc.Start(u, NewAttempt{AppType: "wiki-chatbot"})
	if err != nil {
		t.Fatal(err)
	}
	d, _, _ := s.SessionSvc.Load(u, ss.ID)

	huge := []TranscriptMessage{{Role: "user", Content: strings.Repeat("è", maxTranscriptMessageBytes)}}
	if _, err := s.SessionSvc.SaveTranscript(context.Background(), u, d, TranscriptUpdate{Messages: huge}); err != nil {
		t.Fatal(err)
	}
	d, _, _ = s.SessionSvc.Load(u, ss.ID)
	var stored []TranscriptMessage
	_ = json.Unmarshal(d.Transcript, &stored)
	if len(stored) != 1 || len(stored[0].Content) > maxTranscriptMessageBytes {
		t.Fatalf("one message is cut to %d bytes, got %d", maxTranscriptMessageBytes, len(stored[0].Content))
	}

	var many []TranscriptMessage
	for i := range 100 {
		many = append(many, TranscriptMessage{Role: "user", Content: strings.Repeat(string(rune('a'+i%26)), 20000)})
	}
	if _, err := s.SessionSvc.SaveTranscript(context.Background(), u, d, TranscriptUpdate{Messages: many}); err != nil {
		t.Fatal(err)
	}
	d, _, _ = s.SessionSvc.Load(u, ss.ID)
	if len(d.Transcript) > maxTranscriptBytes {
		t.Fatalf("the stored transcript is at most %d bytes, got %d", maxTranscriptBytes, len(d.Transcript))
	}
	_ = json.Unmarshal(d.Transcript, &stored)
	if last := stored[len(stored)-1].Content; last != many[len(many)-1].Content {
		t.Fatal("the newest messages are kept")
	}
}

func TestEvaluationPromptKeepsTheNewestLinesWithinTheCap(t *testing.T) {
	var msgs []TranscriptMessage
	for i := range 400 {
		msgs = append(msgs, TranscriptMessage{Role: "user", Content: strings.Repeat("x", 2000) + itoa(int64(i))})
	}
	_, prompt := evaluationPrompt(EvaluationRequest{Activity: "WikiChat", Locale: "it"}, nil, nil, msgs)
	if len(prompt) > maxEvaluationTranscriptBytes+10000 {
		t.Fatalf("evaluation prompt of %d bytes", len(prompt))
	}
	if !strings.Contains(prompt, "x399") || strings.Contains(prompt, "x0\n") {
		t.Fatal("the newest lines are kept, the oldest dropped")
	}
	if !strings.Contains(prompt, "earlier messages omitted") {
		t.Fatal("the evaluator is told that lines were left out")
	}
}

func TestJevStateTrimsLargeConversationsQuickly(t *testing.T) {
	msgs := make([]TranscriptMessage, 1000)
	for i := range msgs {
		msgs[i] = TranscriptMessage{Role: "user", Content: strings.Repeat("y", 8000)}
	}
	start := time.Now()
	st := jevState(judgeInput{Instructions: "x", Transcript: msgs}, []string{"g"}, 24000)
	if took := time.Since(start); took > 2*time.Second {
		t.Fatalf("jevState took %v", took)
	}
	if n := len(mustJSON(st)); n > 24000 {
		t.Fatalf("state of %d bytes over the limit", n)
	}
	if st["earlier_messages_omitted"] == nil {
		t.Fatal("omitted messages are counted")
	}
}
