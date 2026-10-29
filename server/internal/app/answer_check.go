package app

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
)

// Answers are screened before the student sees them: an empty answer, or a
// character answer that is an AI-style refusal ("as a language model I
// can't..."), is passed on to the next model of the route. A character who
// refuses in the story ("I will never accept!") is not a refusal.

var (
	errEmptyAnswer = errors.New("the model returned an empty answer")
	errRefusal     = errors.New("the model refused to play the character")
)

// refusalProbeChars is how much of a streamed answer is held back to check
// it: refusals always start with the very first sentence.
const refusalProbeChars = 160

// refusalScanChars is how much of an answer isRefusal reads: twice the probe,
// so a refusal phrase that straddles the end of the probe is still found.
const refusalScanChars = 2 * refusalProbeChars

// The phrases models use when they step out of the role, in the five
// interface languages and in English (models often refuse in English).
var refusalRE = regexp.MustCompile(`(?i)` + strings.Join([]string{
	`\bas an? (ai|artificial intelligence|language model|llm)\b`,
	`\bi(?:'m| am) (?:just )?an? (ai|language model)\b`,
	`\bi (?:can(?:'|no)t|cannot|won't|am unable to|am not able to) (?:help|assist|comply|fulfil|provide|create|generate|write|engage|role-?play|portray|impersonate|continue|answer this)`,
	`\b(?:sorry|apologi[sz]e)\b[^.!?]{0,40}\b(?:can(?:'|no)t|cannot|unable to)\b[^.!?]{0,30}\b(?:help|assist|comply|provide|create|role-?play|portray|impersonate|continue)`,
	`\bcome (?:un'|una |un )?(?:intelligenza artificiale|ia|ai|modello (?:di )?linguistico|assistente virtuale)\b`,
	`\bsono (?:solo )?(?:un'|una |un )?(?:intelligenza artificiale|ia|modello (?:di )?linguistico)\b`,
	`\bnon posso (?:aiutarti|assisterti|soddisfare|fornire|creare|generare|impersonare|interpretare|continuare|rispondere a (?:questa|questo|tale))`,
	`\bcomo (?:una )?(?:inteligencia artificial|ia|modelo de lenguaje)\b`,
	`\bno puedo (?:ayudar|cumplir|proporcionar|crear|generar|interpretar|continuar)`,
	`\ben tant qu'(?:ia|intelligence artificielle|assistant|modèle de langage)\b`,
	`\bje ne peux pas (?:aider|répondre à cette|fournir|créer|générer|incarner|jouer|continuer)`,
	`\bals (?:ki|künstliche intelligenz|sprachmodell)\b`,
	`\bich kann (?:dir |ihnen )?(?:dabei )?(?:nicht|keine) (?:helfen|unterstützen|erstellen|spielen|verkörpern)`,
}, "|"))

// isRefusal checks only the opening of the answer, where refusals are.
func isRefusal(text string) bool {
	if utf8.RuneCountInString(text) > refusalScanChars {
		text = string([]rune(text)[:refusalScanChars])
	}
	return refusalRE.MatchString(text)
}

// refusedAnswer carries the refusal, which is shown when every model refuses.
type refusedAnswer struct{ text string }

func (r refusedAnswer) Error() string        { return errRefusal.Error() }
func (r refusedAnswer) Is(target error) bool { return target == errRefusal }

// checkAnswer tells whether a complete answer can be shown to the student.
func checkAnswer(task, text string) error {
	if strings.TrimSpace(text) == "" {
		return errEmptyAnswer
	}
	if task == TaskChat && isRefusal(text) {
		return refusedAnswer{text}
	}
	return nil
}

// screenAnswers decorates a TextModel so that a failed checkAnswer counts as
// a failed request (logged, and passed on by the fallback chain). A chat
// stream holds back the opening of the answer until it passes the check,
// then lets the rest through unchanged; other tasks only wait for the first
// non-blank text.
func screenAnswers(m ai.TextModel, task string) ai.TextModel {
	return screenedModel{TextModel: m, task: task}
}

type screenedModel struct {
	ai.TextModel
	task string
}

func (m screenedModel) Generate(ctx context.Context, req ai.Request) (*ai.Response, error) {
	res, err := m.TextModel.Generate(ctx, req)
	if err != nil {
		return res, err
	}
	return res, checkAnswer(m.task, res.Text)
}

func (m screenedModel) Stream(ctx context.Context, req ai.Request, onDelta func(string) error) (*ai.Response, error) {
	var held strings.Builder
	passed := false
	release := func() error {
		if err := checkAnswer(m.task, held.String()); err != nil {
			return err
		}
		passed = true
		return onDelta(held.String())
	}
	res, err := m.TextModel.Stream(ctx, req, func(d string) error {
		if passed {
			return onDelta(d)
		}
		held.WriteString(d)
		// Only character answers are checked for refusals; any other
		// answer is shown as soon as it is not empty.
		if m.task == TaskChat && utf8.RuneCountInString(held.String()) < refusalProbeChars {
			return nil
		}
		if m.task != TaskChat && strings.TrimSpace(held.String()) == "" {
			return nil
		}
		return release()
	})
	if err == nil && !passed {
		err = release() // a short answer is checked once it is complete
	}
	return res, err
}
