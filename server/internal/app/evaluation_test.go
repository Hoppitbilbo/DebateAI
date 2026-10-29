package app

import (
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

func TestParseEvaluationReadsAndRemovesTheScores(t *testing.T) {
	ev := parseEvaluation("## Title\n\nText.\n\n\n\nscore_conversation = 12\nSCORE_REFLECTION: 7 / 10\n")
	if ev.ScoreConversation == nil || *ev.ScoreConversation != 10 || ev.ScoreReflection == nil || *ev.ScoreReflection != 7 {
		t.Fatalf("scores (clamped to 10): %+v", ev)
	}
	if ev.Markdown != "## Title\n\nText." {
		t.Fatalf("markdown: %q", ev.Markdown)
	}
	if none := parseEvaluation("no scores"); none.ScoreConversation != nil || none.ScoreReflection != nil {
		t.Fatalf("missing scores stay missing: %+v", none)
	}
}

func TestEvaluationPromptUsesAssignmentAndJudgement(t *testing.T) {
	a := &domain.Assignment{Title: "Napoleone", Instructions: "Intervista", Goals: []string{"Chiede della Russia"}}
	jev := &JudgeResult{Progress: 50, Goals: []GoalStatus{{Text: "Chiede della Russia", Score: 0.95, Met: true}}}
	msgs := []TranscriptMessage{{Role: "user", Content: "Ciao"}, {Role: "assistant", Content: "Salve"}, {Role: "system", Name: "x", Content: "Fine"}}
	system, prompt := evaluationPrompt(EvaluationRequest{Activity: "WikiChat", StudentRole: "giornalista", Locale: "de-DE"}, a, jev, msgs)
	if !strings.Contains(system, "in German") {
		t.Fatalf("language: %s", system)
	}
	for _, want := range []string{"TEACHER ASSIGNMENT: Napoleone\nIntervista", "1. Chiede della Russia", "- met (95%): Chiede della Russia",
		"Schüler/in (giornalista): Ciao", "AI: Salve", "SYSTEM: Fine", "STUDENT SELF-REFLECTION:\n(none)"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt lacks %q:\n%s", want, prompt)
		}
	}
}
