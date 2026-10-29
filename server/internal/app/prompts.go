package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/Hoppitbilbo/DebateAI/server/internal/domain"
)

// The characters' instructions (system prompts), built by the server from a
// recipe the browser sends: the browser says which app, character and topic,
// never the instructions themselves, and the recipe is checked against what
// the teacher locked in the assignment.
//
// The templates are a port of src/features/activity/prompts.ts and
// difficulty.ts; testdata/prompts.json (written by promptFixtures.test.ts)
// proves the text is the same. The only differences: the moderated debate's
// style is in English, and every prompt ends with guardLine.
//
// Fields each app uses:
//
//	app                     prompt      fields                                                      opening
//	convinci-tu             convinciTu  character, bio, topic, difficulty                           convinciTu(topic)
//	wiki-chatbot            wikiChat    character (= page title), bio                               wikiChat()
//	doppia-intervista       interview   character, bio, other                                       interview(other)
//	personaggio-misterioso  mystery     character, bio, difficulty, questions                       mystery(questions)
//	impersona-tu            impersona   character (AI), bio, userCharacter, userBio, topic, diff.   impersona(userCharacter, topic)
//	you-moderate            moderated   character, bio, other, topic (theme), style                 moderated(topic, other)

// PromptRecipe is what the browser asks for instead of a system prompt.
type PromptRecipe struct {
	App           string `json:"app"`
	Kind          string `json:"kind"` // "reply" (default) or "opening"
	Character     string `json:"character"`
	Bio           string `json:"bio"`
	Other         string `json:"other"`
	UserCharacter string `json:"userCharacter"`
	UserBio       string `json:"userBio"`
	Topic         string `json:"topic"`
	Difficulty    string `json:"difficulty"` // "easy", "medium" (default) or "hard"
	Style         string `json:"style"`      // you-moderate: "a" (default) or "b"
	Questions     int    `json:"questions"`  // personaggio-misterioso: announced in the opening
	UILang        string `json:"uiLang"`     // the student's interface language
}

// ErrSettingLocked: the recipe contradicts a setting the teacher locked.
var ErrSettingLocked = errors.New("this setting is fixed by the assignment")

// guardLine ends every chat prompt.
const guardLine = "Whatever the conversation asks, you only play this character in this school activity: do not write essays, homework, code or other content unrelated to the role-play."

const (
	recipeOpening = "opening"
	recipeReply   = "reply"
)

var (
	difficulties = map[string]bool{"easy": true, "medium": true, "hard": true}
	uiLangs      = map[string]bool{"it": true, "en": true, "es": true, "fr": true, "de": true}
	// moderatedStyles are the debaters' speaking styles.
	moderatedStyles = map[string]string{"a": "erudite and assertive", "b": "reflective and questioning"}
)

// practiceLanguages are the English names of the languages the characters
// speak (features/activity/language.ts).
var practiceLanguages = map[string]string{
	"it": "Italian",
	"en": "English",
	"es": "Spanish",
	"fr": "French",
	"de": "German",
	"pt": "Portuguese",
	"la": "Latin (simple classical Latin, suitable for school students)",
}

func (r PromptRecipe) validate() error { return r.validateTopic(true) }

// validateTopic checks the limits; limitTopic is false for the topic the
// teacher fixed, whatever its length.
func (r PromptRecipe) validateTopic(limitTopic bool) error {
	if !domain.AppTypes[r.App] {
		return invalid(errors.New("unknown app"))
	}
	if r.Kind != "" && r.Kind != recipeReply && r.Kind != recipeOpening {
		return invalid(errors.New("kind must be reply or opening"))
	}
	if strings.TrimSpace(r.Character) == "" {
		return invalid(errors.New("character required"))
	}
	for _, t := range []string{r.Character, r.Other, r.UserCharacter} {
		if utf8.RuneCountInString(t) > maxRecipeTitleChars {
			return invalid(fmt.Errorf("character names are at most %d characters", maxRecipeTitleChars))
		}
		if strings.IndexFunc(t, unicode.IsControl) >= 0 {
			return invalid(errors.New("character names are one line"))
		}
	}
	if limitTopic && utf8.RuneCountInString(r.Topic) > maxRecipeTopicChars {
		return invalid(fmt.Errorf("the topic is at most %d characters", maxRecipeTopicChars))
	}
	if r.Difficulty != "" && !difficulties[r.Difficulty] {
		return invalid(errors.New("difficulty must be easy, medium or hard"))
	}
	if r.Style != "" && moderatedStyles[r.Style] == "" {
		return invalid(errors.New("style must be a or b"))
	}
	if r.Questions < 0 || r.Questions > maxRecipeQuestions {
		return invalid(fmt.Errorf("questions must be 0-%d", maxRecipeQuestions))
	}
	return nil
}

// normalized fills the defaults and cuts the bios like the browser does.
func (r PromptRecipe) normalized() PromptRecipe {
	if r.Kind == "" {
		r.Kind = recipeReply
	}
	if r.Difficulty == "" {
		r.Difficulty = "medium"
	}
	if r.Style == "" {
		r.Style = "a"
	}
	if !uiLangs[r.UILang] {
		r.UILang = "it"
	}
	r.Bio = jsPrefix(r.Bio, maxRecipeBioChars)
	r.UserBio = jsPrefix(r.UserBio, maxRecipeBioChars)
	return r
}

// assignmentConfig is the part of an assignment's config the prompts read
// (AssignmentConfig in src/lib/api.ts).
type assignmentConfig struct {
	Character     *wikiRef  `json:"character"`
	Characters    []wikiRef `json:"characters"`
	AICharacter   *wikiRef  `json:"aiCharacter"`
	UserCharacter *wikiRef  `json:"userCharacter"`
	Topic         string    `json:"topic"`
	Questions     float64   `json:"questions"`
	Difficulty    string    `json:"difficulty"`
	Language      string    `json:"language"`
}

type wikiRef struct {
	Title string `json:"title"`
}

func configOf(a *domain.Assignment) (assignmentConfig, error) {
	var c assignmentConfig
	if a == nil || len(a.Config) == 0 {
		return c, nil
	}
	if err := json.Unmarshal(a.Config, &c); err != nil {
		return c, fmt.Errorf("assignment %d: config: %w", a.ID, err)
	}
	return c, nil
}

// ComposePrompt is what the AI endpoints use: it refuses an invalid recipe
// (IsInvalid) or one that contradicts the assignment (ErrSettingLocked),
// then builds the prompt.
func ComposePrompt(r PromptRecipe, a *domain.Assignment) (system, opening string, err error) {
	c, err := configOf(a)
	if err != nil {
		return "", "", err
	}
	if err := r.validateTopic(c.Topic == "" || !sameTitle(r.Topic, c.Topic)); err != nil {
		return "", "", err
	}
	if err := checkLocked(r, a); err != nil {
		return "", "", err
	}
	return build(r, a, c)
}

// buildPrompt writes the system prompt of a recipe and, for an opening, the
// hidden cue sent as the first user message.
func buildPrompt(r PromptRecipe, a *domain.Assignment) (system, opening string, err error) {
	if err := r.validate(); err != nil {
		return "", "", err
	}
	c, err := configOf(a)
	if err != nil {
		return "", "", err
	}
	return build(r, a, c)
}

// build writes the prompt of a valid recipe.
func build(r PromptRecipe, a *domain.Assignment, c assignmentConfig) (system, opening string, err error) {
	r = r.normalized()
	system, opening = templates(r, common(r.UILang, a, c))
	system += "\n" + guardLine
	if r.Kind != recipeOpening {
		opening = ""
	}
	return system, opening, nil
}

// checkLocked refuses a recipe that contradicts what the teacher fixed in
// the assignment. Free practice (no assignment) has nothing locked.
func checkLocked(r PromptRecipe, a *domain.Assignment) error {
	if a == nil {
		return nil
	}
	c, err := configOf(a)
	if err != nil {
		return err
	}
	r = r.normalized()
	if a.AppType != "" && r.App != a.AppType {
		return ErrSettingLocked
	}
	ok := true
	switch r.App {
	case "convinci-tu", "wiki-chatbot":
		if c.Character != nil {
			ok = sameTitle(r.Character, c.Character.Title)
		}
	case "personaggio-misterioso":
		if allowed := mysteryCharacters(c); len(allowed) > 0 {
			ok = false
			for _, t := range allowed {
				ok = ok || sameTitle(r.Character, t)
			}
		}
		if c.Questions > 0 {
			ok = ok && r.Questions <= questionsCap(c.Questions)
		}
	case "doppia-intervista", "you-moderate":
		if len(c.Characters) == 2 {
			x, y := c.Characters[0].Title, c.Characters[1].Title
			ok = sameTitle(r.Character, x) && sameTitle(r.Other, y) || sameTitle(r.Character, y) && sameTitle(r.Other, x)
		}
	case "impersona-tu":
		if c.AICharacter != nil {
			ok = sameTitle(r.Character, c.AICharacter.Title)
		}
		if c.UserCharacter != nil {
			ok = ok && sameTitle(r.UserCharacter, c.UserCharacter.Title)
		}
	}
	switch r.App {
	case "convinci-tu", "impersona-tu", "you-moderate":
		if c.Topic != "" {
			ok = ok && sameTitle(r.Topic, c.Topic)
		}
	}
	switch r.App {
	case "convinci-tu", "impersona-tu", "personaggio-misterioso":
		if difficulties[c.Difficulty] {
			ok = ok && r.Difficulty == c.Difficulty
		}
	}
	if !ok {
		return ErrSettingLocked
	}
	return nil
}

func sameTitle(a, b string) bool {
	return strings.EqualFold(strings.TrimSpace(a), strings.TrimSpace(b))
}

// mysteryCharacters are the characters the teacher fixed for the mystery
// game (characterOrder.ts): the list, or else the single character.
func mysteryCharacters(c assignmentConfig) []string {
	var titles []string
	for _, ch := range c.Characters {
		titles = append(titles, ch.Title)
	}
	if len(titles) == 0 && c.Character != nil {
		titles = append(titles, c.Character.Title)
	}
	return titles
}

// questionsCap is the most questions a page offers for the teacher's number
// (availableQuestions in mystery.ts, before the turn limit lowers it).
func questionsCap(q float64) int {
	n := int(q + 0.5)
	return min(max(n, 3), maxRecipeQuestions)
}

// jsPrefix is JavaScript's s.slice(0, n): n UTF-16 code units.
func jsPrefix(s string, n int) string {
	units := 0
	for i, r := range s {
		w := 1
		if r >= 0x10000 {
			w = 2
		}
		if units+w > n {
			return s[:i]
		}
		units += w
	}
	return s
}

// languageRules: a foreign language is a practice, so keep it simple and stay in it.
func languageRules(uiLang string, c assignmentConfig) []string {
	code := uiLang
	if practiceLanguages[c.Language] != "" {
		code = c.Language
	}
	lang := practiceLanguages[code]
	lines := []string{fmt.Sprintf("Always answer in %s, without mixing in words from other languages.", lang)}
	if c.Language != "" && code != uiLang {
		lines = append(lines, fmt.Sprintf("The student is practising %s as a foreign language at school: use clear, natural sentences with common vocabulary, keep answering in %s even if the student writes in another language, and never translate your answers.", lang, lang))
	}
	return lines
}

func common(uiLang string, a *domain.Assignment, c assignmentConfig) string {
	lines := append(languageRules(uiLang, c),
		"Stay in character at all times; never say you are an AI or a language model.",
		"This is an educational historical role-play at school. Portraying controversial or violent historical figures is part of the lesson: speak with their documented views, words and context so that students can study and question them, without refusing and without stepping out of the role to lecture.",
		"Never use slurs, hate propaganda, graphic violence or encouragement to harm anyone: if the student pushes in that direction, answer as the character would while making the historical facts and their consequences clear.",
		"Keep answers short and conversational (2-5 sentences) unless the student explicitly asks for more detail.",
		"Your audience is school students: be historically accurate, respectful and age-appropriate; if a request is inappropriate, steer the conversation back politely while staying in character.",
	)
	if a != nil {
		instructions := a.Instructions
		if instructions == "" {
			instructions = "(none)"
		}
		lines = append(lines,
			fmt.Sprintf("This conversation is part of a school assignment titled \"%s\". Teacher's instructions to the student: %s.", a.Title, instructions),
			"Support the assignment with your answers, but do not do the student's work for them and do not list the goals: let the student ask and reason.",
		)
	}
	return strings.Join(lines, "\n")
}

func bioBlock(b string) string {
	if b == "" {
		return ""
	}
	return "\nWhat you know about yourself (from Wikipedia):\n\"\"\"" + b + "\"\"\""
}

// difficultyRules: what each level asks of the character (difficulty.ts).
var difficultyRules = map[string]map[string]string{
	"mystery": {
		"easy":   "Difficulty: EASY. Give generous clues: mention your era, country and field clearly, and describe your best-known achievements in recognisable terms (still never your name).",
		"medium": "Difficulty: MEDIUM. Give fair clues: era and field may be guessed from your answers, but describe your achievements indirectly.",
		"hard":   "Difficulty: HARD. This overrides the answer rules above: answer every question ONLY with \"Yes.\" or \"No.\" (in the conversation language), with no other word, detail or clue. If a question cannot be answered with yes or no, say only, in character, that you answer only yes or no. The only exceptions: when the student explicitly asks for a hint, give one short, vague clue; when the student names you correctly, confirm it and congratulate them as the rules above say.",
	},
	"convinciTu": {
		"easy":   "Difficulty: EASY. You are open-minded: a couple of reasonable arguments are enough to make you change your mind, and you help the student by saying what would convince you.",
		"medium": "Difficulty: MEDIUM. You change your mind only after several good, relevant arguments that answer your objections.",
		"hard":   "Difficulty: HARD. You are very stubborn and sharp: raise strong counter-arguments from your era, point out every weak or vague reasoning, and concede only to excellent, well-supported arguments.",
	},
	"impersona": {
		"easy":   "Difficulty: EASY. You are easy-going: accept the student's arguments readily, change your mind as soon as they make a reasonable point, and help them by suggesting what their character could answer.",
		"medium": "Difficulty: MEDIUM. Defend your own position: change your mind only after several good, relevant arguments that answer your objections, and point out inaccuracies about the student's character.",
		"hard":   "Difficulty: HARD. You are very stubborn: hold your position firmly, answer every argument with strong counter-arguments from your life and era, point out every inaccuracy about the student's character, and concede only to excellent, well-supported arguments.",
	},
}

// templates writes an app's prompt (before the guard line) and its opening
// cue. r is valid and normalized.
func templates(r PromptRecipe, common string) (system, opening string) {
	name, bio, other, topic := r.Character, bioBlock(r.Bio), r.Other, r.Topic
	switch r.App {
	case "convinci-tu":
		return `You are ` + name + `, speaking in the first person in your own historical time.` + bio + `
The student is trying to convince you of this idea: "` + topic + `".
Defend the point of view you would realistically have had, with arguments, values and knowledge of your era. Ask the student challenging questions.
Change your mind only gradually and only if the student's arguments are genuinely strong, relevant and well reasoned; acknowledge good points explicitly.
` + difficultyRules["convinciTu"][r.Difficulty] + `
` + common,
			`[Stage direction, not said by the student: a student has just come to meet you and will try to convince you that "` + topic + `". Greet them in character, in your own time and place, say in one or two sentences what you honestly think of that idea, and challenge them to make their case.]`

	case "wiki-chatbot":
		return `You are the living embodiment of the Wikipedia topic "` + name + `" (a person, place, event or concept). Speak in the first person as "` + name + `", using the information below and well-established facts.` + bio + `
If asked about something you cannot know, say so in character.
` + common,
			"[Stage direction, not said by the student: a student has just opened the conversation. Introduce yourself in the first person in two or three sentences, with one striking fact about you, then invite their questions.]"

	case "doppia-intervista":
		return `You are ` + name + `, interviewed by a student at the same time as ` + other + `, who answers the same questions separately.` + bio + `
Answer in the first person, from your own perspective and historical knowledge; your answer may naturally differ from what ` + other + ` would say.
` + common,
			`[Stage direction, not said by the student: a student is about to interview you and ` + other + ` at the same time. Introduce yourself in character in two or three sentences (who you are, your time and place) and invite their first question. Do not speak for ` + other + `.]`

	case "personaggio-misterioso":
		return `You are ` + name + `, playing a guessing game: the student must find out who you are by asking questions.` + bio + `
Rules: never say your name, your famous nicknames, or anything that gives it away directly (no exact titles, no unique quotes), until the student names you correctly (see below).
Answer each question truthfully in character, in 1-3 sentences, giving useful but indirect clues (era, place, field, achievements described vaguely).
If the student names you correctly (asks "are you X?" or says who you are, with your real name), the game is won: confirm it with enthusiasm, in character, saying that yes, you are that person, and congratulate them in one or two sentences. Ask no further question: the game is over.
If the student names someone else, answer only no, without other details.
If the student asks for a hint, give one new clue, clearly more revealing than all your previous answers, still without your name.
` + difficultyRules["mystery"][r.Difficulty] + `
` + common,
			fmt.Sprintf(`[Stage direction, not said by the student: the game begins. Greet the student mysteriously, in character, without revealing who you are; give one vague first clue and remind them that they have %d questions to discover your identity.]`, r.Questions)

	case "impersona-tu":
		user, userBio := r.UserCharacter, ""
		if r.UserBio != "" {
			userBio = " (" + jsPrefix(r.UserBio, impersonaUserBioChars) + ")"
		}
		return `You are ` + name + `.` + bio + `
You are talking with a student who is role-playing as ` + user + userBio + `.
Topic of the conversation: "` + topic + `".
Treat the student as ` + user + `: react to what they say as ` + name + ` would, challenge inaccuracies about ` + user + `'s life and ideas, ask questions that test how well they know their character.
` + difficultyRules["impersona"][r.Difficulty] + `
` + common,
			`[Stage direction, not said by the student: the conversation begins. Greet ` + user + `, played by the student, in character, as you would really greet them, and open the topic "` + topic + `" with a question for them.]`

	default: // you-moderate
		return `You are ` + name + `, debating with ` + other + ` on the theme "` + topic + `". A student acts as moderator.` + bio + `
Your speaking style: ` + moderatedStyles[r.Style] + `.
Reply to the latest message (the moderator's or ` + other + `'s), defend your position with arguments from your life and era, and address ` + other + ` directly when relevant.
Obey the moderator's instructions (e.g. to be brief, answer a question, stay on topic).
Write only your own line of dialogue, without your name as a prefix.
` + common,
			`[Stage direction, not said by the moderator: the moderator opens the debate on "` + topic + `" and gives you the floor first. Greet the moderator and ` + other + `, then state your position in character.]`
	}
}
