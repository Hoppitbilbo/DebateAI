package app

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
	"golang.org/x/text/unicode/norm"
)

// The mystery game is won when the student names the character. The
// platform decides it from the student's own words, not from what the AI
// wrote back (test report 2026-10-29, §4), and grades the game with a fixed
// rubric (§3): a quick right answer is the best result, never a short one.

var (
	nameParens   = regexp.MustCompile(`\(.*?\)`)
	nameNonAlnum = regexp.MustCompile(`[^a-z0-9 ]`)
	nameSpaces   = regexp.MustCompile(`\s+`)
)

// minNameWord: shorter words of a name ("da", "van", "de") identify nobody.
const minNameWord = 4

// normalizeName is normalize in features/activity/mystery.ts.
func normalizeName(s string) string {
	s = norm.NFD.String(strings.ToLower(s))
	s = strings.Map(func(r rune) rune {
		if unicode.Is(unicode.Mn, r) {
			return -1
		}
		return r
	}, s)
	s = nameParens.ReplaceAllString(s, "")
	s = nameNonAlnum.ReplaceAllString(s, " ")
	return strings.TrimSpace(nameSpaces.ReplaceAllString(s, " "))
}

// namesCharacter is isCorrectGuess in features/activity/mystery.ts: the full
// name, or a significant word of it as a whole word of the text.
func namesCharacter(text, answer string) bool {
	t := normalizeName(text)
	if t == "" {
		return false
	}
	if t == normalizeName(answer) {
		return true
	}
	words := map[string]bool{}
	for _, w := range strings.Fields(t) {
		words[w] = true
	}
	for _, w := range strings.Fields(normalizeName(answer)) {
		if len(w) >= minNameWord && words[w] {
			return true
		}
	}
	return false
}

// mysteryAnswer is the hidden character of a mystery attempt, from its saved
// setup. When the teacher fixed the characters only one of them counts, so
// an edited setup cannot pick an easier name. Empty when unknown.
func mysteryAnswer(a *domain.Assignment, context json.RawMessage) string {
	var saved struct {
		Character string `json:"character"`
	}
	if json.Unmarshal(context, &saved) != nil || strings.TrimSpace(saved.Character) == "" {
		return ""
	}
	c, err := configOf(a)
	if err != nil {
		return ""
	}
	fixed := mysteryCharacters(c)
	if len(fixed) == 0 {
		return saved.Character
	}
	for _, title := range fixed {
		if sameTitle(title, saved.Character) {
			return title
		}
	}
	return ""
}

// namedAtTurn is the student turn (from 1) that first names answer, 0 if none.
func namedAtTurn(msgs []TranscriptMessage, answer string) int {
	if answer == "" {
		return 0
	}
	turn := 0
	for _, m := range msgs {
		if m.Role != ai.RoleUser || strings.TrimSpace(m.Content) == "" {
			continue
		}
		turn++
		if namesCharacter(m.Content, answer) {
			return turn
		}
	}
	return 0
}

// MysteryResult is what the browser reports about the end of a mystery game:
// the final guess (empty when the name came up in the chat) and the hints
// the student asked for.
type MysteryResult struct {
	Guess string `json:"guess"`
	Hints int    `json:"hints"`
}

// platformFactStyle keeps the wording of the platform's notes out of what
// the student reads.
const platformFactStyle = " Tell it in your own words, in the evaluation language: never quote this note, its English words or the word \"platform\"."

// maxMysteryGuessChars bounds the final guess quoted to the evaluator.
const maxMysteryGuessChars = 200

// Rubric of the mystery game (score of the conversation, 0-10).
const (
	mysteryBestScore     = 10 // found at the first question
	mysteryLaterPenalty  = 1  // found after other questions, or with the final guess
	mysteryHintPenalty   = 1  // the student asked for hints
	mysteryWrongScoreCap = 5  // a wrong guess never scores above this
	mysteryMinRightScore = 8  // a right answer never scores below this
)

// mysteryGrade is the platform's score of a mystery game and the sentence
// that explains it to the evaluator.
type mysteryGrade struct {
	Correct bool
	Score   int // for a wrong guess, the most the model may give
	Fact    string
}

// gradeMystery grades the game whose hidden character is answer; false when
// the character is unknown, and the model's score is kept.
func gradeMystery(answer string, msgs []TranscriptMessage, r MysteryResult) (mysteryGrade, bool) {
	if answer == "" {
		return mysteryGrade{}, false
	}
	turns := countStudentTurns(msgs)
	hints := min(max(r.Hints, 0), turns)
	at := namedAtTurn(msgs, answer)
	guessed := at == 0 && namesCharacter(r.Guess, answer)
	if at == 0 && !guessed {
		guess := "none"
		if g := strings.TrimSpace(r.Guess); g != "" {
			guess = fmt.Sprintf("%q", truncate(g, maxMysteryGuessChars))
		}
		return mysteryGrade{Score: mysteryWrongScoreCap,
			Fact: fmt.Sprintf("PLATFORM RESULT: WRONG, the student did not find the character (final guess: %s; the answer was %q; questions asked: %d, hints: %d). Do not say the student recognised the character. The conversation score is at most %d/10.",
				guess, answer, turns, hints, mysteryWrongScoreCap) + platformFactStyle}, true
	}
	score := mysteryBestScore
	how := fmt.Sprintf("named in the chat at question %d", at)
	if guessed {
		how = fmt.Sprintf("final guess after %d questions", turns)
	}
	if at != 1 {
		score -= mysteryLaterPenalty
	}
	if hints > 0 {
		score -= mysteryHintPenalty
	}
	score = max(score, mysteryMinRightScore)
	fact := fmt.Sprintf("PLATFORM RESULT: CORRECT, %s, hints asked: %d. The conversation score is fixed by the platform: %d/10.", how, hints, score)
	if at == 1 {
		fact += " The student found the answer at the first attempt without hints: say so and congratulate them for their autonomy (bonus). A quick right answer is excellent work, never short or superficial work."
	}
	fact += platformFactStyle
	return mysteryGrade{Correct: true, Score: score, Fact: fact}, true
}

// apply puts the platform's score in place of the model's: the exact score
// for a right answer, the model's capped for a wrong one.
func (g mysteryGrade) apply(ev *Evaluation) {
	n := g.Score
	switch {
	case g.Correct:
	case ev.ScoreConversation == nil:
		return // no score from the model: none is made up
	default:
		n = min(*ev.ScoreConversation, g.Score)
	}
	ev.ScoreConversation = &n
}
