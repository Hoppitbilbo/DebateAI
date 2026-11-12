package app

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/Hoppitbilbo/DebateAI/server/internal/ai"
	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// Final evaluation of an attempt, run by the server (audit 2026-10-29,
// item 3): the evidence is the stored transcript, the assignment and the
// stored judgement, and the scores are read from the model's answer, so the
// browser cannot hand in its own grade. The browser only describes the
// activity (what it is, who the characters are) and sends the reflection.

// EvaluationRequest is what the student sends to be evaluated and hand in.
type EvaluationRequest struct {
	Reflection  string   `json:"reflection"`
	Activity    string   `json:"activity"`   // e.g. "Convince YOU: persuade Napoleon about ..."
	Characters  string   `json:"characters"` // AI characters involved
	StudentRole string   `json:"studentRole"`
	Topic       string   `json:"topic"`
	ExtraFacts  []string `json:"extraFacts"` // e.g. "Final guess: Cleopatra"
	Locale      string   `json:"locale"`     // language of the evaluation
	// Mystery: how the mystery game ended; the platform grades it.
	Mystery *MysteryResult `json:"mystery,omitempty"`
}

// Evaluation is the stored result of an evaluation.
type Evaluation struct {
	Markdown          string `json:"evaluation"`
	ScoreConversation *int   `json:"scoreConversation,omitempty"`
	ScoreReflection   *int   `json:"scoreReflection,omitempty"`
}

// textGenerator runs an AI task (implemented by aiGateway).
type textGenerator interface {
	Generate(ctx context.Context, task string, req ai.Request, userID, sessionID *int64, onDelta func(string) error) (*GenResult, error)
}

// Bounds of what the browser may add to the evaluation prompt.
const (
	maxEvaluationLabelChars = 2000
	maxEvaluationFacts      = 10
	evaluationOutputTokens  = 2500
)

// Evaluate grades attempt d of u and hands it in with the result. onDelta
// receives the answer as it is generated (scores included).
func (svc *sessionService) Evaluate(ctx context.Context, u *domain.User, d *domain.SessionDetail, in EvaluationRequest, onDelta func(string) error) (*Evaluation, error) {
	if d.Status == domain.SessionCompleted {
		return nil, domain.ErrSessionCompleted
	}
	var a *domain.Assignment
	if d.AssignmentID != nil {
		a, _ = svc.assignments.Get(*d.AssignmentID)
	}
	var msgs []TranscriptMessage
	_ = json.Unmarshal(d.Transcript, &msgs)
	checked := svc.check(d, a, msgs) // only the AI lines the server produced count
	if checked.unverified > 0 && !checked.voice {
		in.ExtraFacts = append([]string{fmt.Sprintf("NOTE: %d AI lines of the saved conversation were not produced by the platform and were left out; judge only what remains.", checked.unverified)}, in.ExtraFacts...)
	}
	var jev JudgeResult
	_ = json.Unmarshal(d.Jev, &jev)
	in.Reflection = truncate(in.Reflection, maxReflectionChars)
	if in.Locale == "" {
		in.Locale = u.Locale
	}
	in.Locale = activityLocale(a, in.Locale)
	grade, graded := mysteryGrade{}, false
	if d.AppType == domain.AppMystery {
		var r MysteryResult
		if in.Mystery != nil {
			r = *in.Mystery
		}
		if grade, graded = gradeMystery(mysteryAnswer(a, d.Context), msgs, r); graded {
			in.ExtraFacts = append([]string{grade.Fact}, in.ExtraFacts...)
		}
	}
	system, prompt := evaluationPrompt(in, a, &jev, checked.evidence)
	res, err := svc.generator.Generate(ctx, TaskEvaluation, ai.Request{System: system, Messages: []ai.Message{{Role: ai.RoleUser, Content: prompt}},
		MaxTokens: evaluationOutputTokens}, &u.ID, &d.ID, onDelta)
	if err != nil {
		return nil, err
	}
	ev := parseEvaluation(res.Text)
	if graded {
		grade.apply(&ev)
	}
	ev.Markdown = truncate(ev.Markdown, maxEvaluationChars)
	if err := svc.sessions.Complete(d.ID, domain.SessionCompletion{Reflection: in.Reflection, Evaluation: ev.Markdown,
		ScoreConversation: ev.ScoreConversation, ScoreReflection: ev.ScoreReflection}); err != nil {
		return nil, err
	}
	return &ev, nil
}

var scoreRE = regexp.MustCompile(`(?i)SCORE_(CONVERSATION|REFLECTION)\s*[:=]\s*(\d{1,2})(?:\s*/\s*10)?`)
var extraBlankLines = regexp.MustCompile(`\n{3,}`)

// parseEvaluation reads the two scores (the last of each, clamped to 0-10)
// and removes their lines from the text shown to the student.
func parseEvaluation(text string) Evaluation {
	var ev Evaluation
	for _, m := range scoreRE.FindAllStringSubmatch(text, -1) {
		n, _ := strconv.Atoi(m[2])
		n = min(max(n, 0), 10)
		if strings.EqualFold(m[1], "CONVERSATION") {
			ev.ScoreConversation = &n
		} else {
			ev.ScoreReflection = &n
		}
	}
	ev.Markdown = strings.TrimSpace(extraBlankLines.ReplaceAllString(scoreRE.ReplaceAllString(text, ""), "\n\n"))
	return ev
}

// evaluationLanguages names the languages of the interface for the model,
// with the word for the student used in the transcript.
var evaluationLanguages = map[string]struct{ name, student string }{
	"it": {"Italian", "Studente"},
	"en": {"English", "Student"},
	"es": {"Spanish", "Estudiante"},
	"fr": {"French", "Élève"},
	"de": {"German", "Schüler/in"},
}

// activityLocale is the language of the texts about an attempt (judge hints,
// evaluation): the one the teacher fixed for the assignment when it is an
// interface language, otherwise fallback (the student's interface).
func activityLocale(a *domain.Assignment, fallback string) string {
	c, err := configOf(a)
	if err == nil {
		if _, ok := evaluationLanguages[c.Language]; ok {
			return c.Language
		}
	}
	return fallback
}

func evaluationLanguage(locale string) (name, student string) {
	if len(locale) > 2 {
		locale = locale[:2]
	}
	l, ok := evaluationLanguages[strings.ToLower(locale)]
	if !ok {
		l = evaluationLanguages["it"]
	}
	return l.name, l.student
}

// newestLines keeps the newest lines that fit in maxBytes (with their line
// breaks), and says how many older ones were left out.
func newestLines(lines []string, maxBytes int) []string {
	size, first := 0, len(lines)
	for first > 0 && size+len(lines[first-1])+1 <= maxBytes {
		first--
		size += len(lines[first]) + 1
	}
	if first == 0 {
		return lines
	}
	return append([]string{fmt.Sprintf("[%d earlier messages omitted]", first)}, lines[first:]...)
}

// evaluationPrompt builds the teacher-like instructions and the evidence.
func evaluationPrompt(in EvaluationRequest, a *domain.Assignment, jev *JudgeResult, msgs []TranscriptMessage) (system, prompt string) {
	lang, student := evaluationLanguage(in.Locale)
	label := func(s string) string { return truncate(strings.TrimSpace(s), maxEvaluationLabelChars) }
	role := label(in.StudentRole)
	var transcript []string
	for _, m := range msgs {
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		speaker := m.Name
		switch {
		case m.Role == ai.RoleUser && role != "":
			speaker = student + " (" + role + ")"
		case m.Role == ai.RoleUser:
			speaker = student
		case m.Role == roleSystem:
			speaker = "SYSTEM"
		case speaker == "":
			speaker = "AI"
		}
		transcript = append(transcript, speaker+": "+m.Content)
	}
	heading := func(it, other string) string {
		if lang == "Italian" {
			return it
		}
		return other
	}
	system = `You are an experienced, encouraging teacher evaluating a learning activity in which a student talked with AI characters, followed by a written self-reflection.
Write the whole evaluation in ` + lang + `, in Markdown, addressed directly to the student ("you").
Structure:
## <a short title>
A 2-3 sentence overall judgement.
### ` + heading("Punti di forza", "Strengths") + ` (bullet list, quote concrete moments of the conversation)
### ` + heading("Cosa migliorare", "What to improve") + ` (bullet list, concrete and actionable)
### ` + heading("Sulla tua riflessione", "About your reflection") + `
If a teacher assignment is given, add a section that checks each goal explicitly (✅ / ⚠️).
Optionally a small Markdown table summarising the criteria.
Finish with EXACTLY these two lines (integers from 0 to 10, no other text on them):
SCORE_CONVERSATION: <n>
SCORE_REFLECTION: <n>
Be fair: short or superficial work gets low scores; never invent things the student did not do.
When a PLATFORM RESULT fixes the conversation score, write exactly that score and explain it; a right answer found quickly is never short or superficial work.`

	parts := []string{"ACTIVITY: " + label(in.Activity), "AI CHARACTERS: " + label(in.Characters)}
	if role != "" {
		parts = append(parts, "STUDENT ROLE: "+role)
	}
	if t := label(in.Topic); t != "" {
		parts = append(parts, "TOPIC: "+t)
	}
	if a != nil {
		parts = append(parts, "TEACHER ASSIGNMENT: "+a.Title+"\n"+a.Instructions)
		if len(a.Goals) > 0 {
			goals := make([]string, len(a.Goals))
			for i, g := range a.Goals {
				goals[i] = fmt.Sprintf("%d. %s", i+1, g)
			}
			parts = append(parts, "GOALS:\n"+strings.Join(goals, "\n"))
		}
	}
	if jev != nil && len(jev.Goals) > 0 {
		lines := make([]string, len(jev.Goals))
		for i, g := range jev.Goals {
			met := "not met"
			if g.Met {
				met = "met"
			}
			lines[i] = fmt.Sprintf("- %s (%d%%): %s", met, int(math.Round(g.Score*100)), g.Text)
		}
		parts = append(parts, fmt.Sprintf("AUTOMATIC JUDGE (JEV) RESULT: progress %d%%\n%s", jev.Progress, strings.Join(lines, "\n")))
	}
	for i, f := range in.ExtraFacts {
		if i == maxEvaluationFacts {
			break
		}
		parts = append(parts, label(f))
	}
	conversation := strings.Join(newestLines(transcript, maxEvaluationTranscriptBytes), "\n")
	if conversation == "" {
		conversation = "(empty)"
	}
	reflection := in.Reflection
	if reflection == "" {
		reflection = "(none)"
	}
	parts = append(parts, "CONVERSATION:\n"+conversation, "STUDENT SELF-REFLECTION:\n"+reflection)
	return system, strings.Join(parts, "\n\n")
}
