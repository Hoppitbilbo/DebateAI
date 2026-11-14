package app

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// The cases live in testdata/mystery_names.json, read by mystery.test.ts too,
// so the server and the browser cannot drift apart.
func TestNamesCharacterMatchesTheBrowserRule(t *testing.T) {
	raw, err := os.ReadFile("testdata/mystery_names.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Message  string `json:"message"`
		Answer   string `json:"answer"`
		Expected bool   `json:"expected"`
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		if got := namesCharacter(c.Message, c.Answer); got != c.Expected {
			t.Errorf("namesCharacter(%q, %q) = %v, want %v", c.Message, c.Answer, got, c.Expected)
		}
	}
}

func TestMysteryAnswerKeepsToTheTeachersCharacters(t *testing.T) {
	ctx := json.RawMessage(`{"character":"marie curie"}`)
	if got := mysteryAnswer(nil, ctx); got != "marie curie" {
		t.Fatalf("free practice: %q", got)
	}
	a := &domain.Assignment{Config: json.RawMessage(`{"characters":[{"title":"Marie Curie"},{"title":"Isaac Newton"}]}`)}
	if got := mysteryAnswer(a, ctx); got != "Marie Curie" {
		t.Fatalf("one of the teacher's: %q", got)
	}
	if got := mysteryAnswer(a, json.RawMessage(`{"character":"Pippo"}`)); got != "" {
		t.Fatalf("an edited setup does not count: %q", got)
	}
	if got := mysteryAnswer(a, nil); got != "" {
		t.Fatalf("no setup: %q", got)
	}
}

func chat(lines ...string) []TranscriptMessage {
	var msgs []TranscriptMessage
	for _, l := range lines {
		msgs = append(msgs, TranscriptMessage{Role: "user", Content: l}, TranscriptMessage{Role: "assistant", Content: "..."})
	}
	return msgs
}

func TestGradeMysteryRubric(t *testing.T) {
	const answer = "Marie Curie"
	cases := []struct {
		name    string
		msgs    []TranscriptMessage
		r       MysteryResult
		correct bool
		score   int
	}{
		{"first question", chat("Sei Marie Curie?"), MysteryResult{}, true, 10},
		{"later question", chat("Sei una scienziata?", "Sei Curie?"), MysteryResult{}, true, 9},
		{"later with a hint", chat("Un indizio", "Sei Curie?"), MysteryResult{Hints: 1}, true, 8},
		{"final guess", chat("Sei italiana?", "Sei viva?"), MysteryResult{Guess: "Marie Curie"}, true, 9},
		{"final guess with hints", chat("Un indizio", "Un altro"), MysteryResult{Guess: "Curie", Hints: 2}, true, 8},
		{"wrong", chat("Sei italiana?"), MysteryResult{Guess: "Rita Levi-Montalcini"}, false, mysteryWrongScoreCap},
	}
	for _, c := range cases {
		g, ok := gradeMystery(answer, c.msgs, c.r, false)
		if !ok || g.Correct != c.correct || g.Score != c.score {
			t.Errorf("%s: %+v ok=%v, want correct=%v score=%d", c.name, g, ok, c.correct, c.score)
		}
	}
	if g, _ := gradeMystery(answer, chat("Sei Marie Curie?"), MysteryResult{}, false); !strings.Contains(g.Fact, "first attempt") {
		t.Errorf("the first attempt is named to the evaluator: %q", g.Fact)
	}
	if g, _ := gradeMystery(answer, chat("Sei italiana?"), MysteryResult{Guess: "Rita Levi-Montalcini"}, false); !strings.Contains(g.Fact, `final guess: "Rita Levi-Montalcini"`) || !strings.Contains(g.Fact, `"Marie Curie"`) {
		t.Errorf("a wrong guess and the answer are named to the evaluator: %q", g.Fact)
	}
	if _, ok := gradeMystery("", chat("Sei Marie Curie?"), MysteryResult{}, false); ok {
		t.Error("an unknown character is not graded")
	}
}

// A game won by voice is graded at the question where the voice character
// confirmed the name (the transcription may not hold it), and only for an
// attempt that used voice.
func TestGradeMysteryWonByVoice(t *testing.T) {
	const answer = "Frida Kahlo"
	misheard := chat("Sei messicana?", "Sabes por ida, Carlo?")
	if g, ok := gradeMystery(answer, misheard, MysteryResult{VoiceTurn: 2}, true); !ok || !g.Correct || g.Score != 9 || !strings.Contains(g.Fact, "voice") {
		t.Errorf("won by voice at question 2: %+v", g)
	}
	if g, _ := gradeMystery(answer, chat("Por ida, Carlo?"), MysteryResult{VoiceTurn: 1}, true); !g.Correct || g.Score != 10 {
		t.Errorf("won by voice at the first question: %+v", g)
	}
	if g, _ := gradeMystery(answer, misheard, MysteryResult{VoiceTurn: 2}, false); g.Correct {
		t.Errorf("no voice conversation: the claim does not count: %+v", g)
	}
	if g, _ := gradeMystery(answer, misheard, MysteryResult{VoiceTurn: 5}, true); g.Correct {
		t.Errorf("a question that was never asked: %+v", g)
	}
}

func TestMysteryGradeReplacesTheModelsScore(t *testing.T) {
	low, high := 4, 9
	right := mysteryGrade{Correct: true, Score: 10}
	ev := Evaluation{ScoreConversation: &low}
	right.apply(&ev)
	if *ev.ScoreConversation != 10 {
		t.Fatalf("a right answer gets the rubric score: %d", *ev.ScoreConversation)
	}
	wrong := mysteryGrade{Score: mysteryWrongScoreCap}
	ev = Evaluation{ScoreConversation: &high}
	wrong.apply(&ev)
	if *ev.ScoreConversation != mysteryWrongScoreCap {
		t.Fatalf("a wrong guess is capped: %d", *ev.ScoreConversation)
	}
	ev = Evaluation{}
	wrong.apply(&ev)
	if ev.ScoreConversation != nil {
		t.Fatal("no score is made up")
	}
}

func TestActivityLocaleFollowsTheTeachersLanguage(t *testing.T) {
	it := &domain.Assignment{Config: json.RawMessage(`{"language":"it"}`)}
	latin := &domain.Assignment{Config: json.RawMessage(`{"language":"la"}`)}
	if got := activityLocale(it, "es"); got != "it" {
		t.Fatalf("teacher's Italian: %q", got)
	}
	if got := activityLocale(latin, "es"); got != "es" {
		t.Fatalf("Latin is not an interface language: %q", got)
	}
	if got := activityLocale(nil, "fr"); got != "fr" {
		t.Fatalf("no assignment: %q", got)
	}
}
