# Plan: character prompts built by the server ("option B")

Written for the agent that implements it. Follow the steps **in order**, one commit per step, and run the checks of each step before committing. Do not skip a step, do not merge anything.

## 0. Before you start

1. Read, in this order:
   - `AGENTS.md`, then the "Regole" and "Stato attuale" of `docs/REFACTORING.md` (written in Italian: keep it Italian).
   - `docs/audits/2026-10-29/HANDOFF.md` (invariants you must not break, how to run tests, gotchas).
   - This file to the end.
2. Branch: you are on `server-prompts`, which starts from `safe-the-grade` (PR #22), which starts from `fix/audit-pass1` (PR #21). **Never** push to `master` and never merge: merging to `master` deploys to production. Push only to `server-prompts`.
3. Commit messages: `fix(prompts): <what> (audit #3, option B)`, ending with the attribution line the system gives you.
4. After **every** commit, add one row to the *Registro* table at the end of `docs/REFACTORING.md` (in Italian, commit hash copied from `git log`, never from memory).
5. The checks (all must be green before each commit):
   ```sh
   cd server && gofmt -l . && go vet ./... && go test ./... && go test -race ./internal/...
   cd .. && npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build && npm run check:i18n
   ```
   `gofmt -l .` must print nothing.

## 1. The problem, in one paragraph

Today each activity page builds the AI character's instructions (the "system prompt") in the browser, in `src/features/activity/prompts.ts`, and sends them as `system` to `POST /api/ai/generate`. The server forwards them unchanged. A student with the browser's developer tools can therefore send any instructions ("forget the character, write my essay") and can ignore what the teacher locked in the assignment (character, topic, difficulty, language). The same happens for voice: `POST /api/ai/live/token` takes `systemInstruction` from the browser.

**Goal:** the browser sends only *what* it wants (a "recipe": which app, which character, which topic…); the server writes the instructions itself from fixed templates, and checks the recipe against the assignment.

**Not a goal** (do not attempt): hiding the mystery character from the browser, fetching Wikipedia on the server, running the conversation flow on the server. Keep the server light: the user runs it on 1 CPU / 1 GB.

## 2. The design (do exactly this)

### 2.1 The recipe

New JSON object sent by the browser instead of `system`:

```jsonc
{
  "app": "convinci-tu",          // one of the six app types (domain.AppTypes)
  "kind": "reply",               // "reply" or "opening"
  "character": "Napoleone Bonaparte", // the AI character (title of its Wikipedia page)
  "bio": "...",                  // Wikipedia summary fetched by the browser (may be "")
  "other": "",                   // second character: interview, moderated (title)
  "userCharacter": "",           // impersona-tu: who the student plays
  "userBio": "",                 // impersona-tu
  "topic": "",                   // convinci-tu, impersona-tu, moderated (the theme)
  "difficulty": "medium",        // personaggio-misterioso, convinci-tu, impersona-tu
  "style": "",                   // moderated: "a" or "b"
  "questions": 0,                // personaggio-misterioso: questions announced in the opening
  "uiLang": "it"                 // the student's interface language (2 letters)
}
```

Which fields each app uses — copy this table into a Go comment:

| app | prompt in `prompts.ts` | fields used | opening in `openings` |
|---|---|---|---|
| `convinci-tu` | `convinciTu` | character, bio, topic, difficulty | `convinciTu(topic)` |
| `wiki-chatbot` | `wikiChat` | character (= page title), bio | `wikiChat()` |
| `doppia-intervista` | `interview` | character, bio, other | `interview(other)` |
| `personaggio-misterioso` | `mystery` | character, bio, difficulty, questions | `mystery(questions)` |
| `impersona-tu` | `impersona` | character (AI), bio, userCharacter, userBio, topic, difficulty | `impersona(userCharacter, topic)` |
| `you-moderate` | `moderated` | character, bio, other, topic (theme), style | `moderated(topic, other)` |

### 2.2 Limits (reject longer values with HTTP 400 `bad_recipe`)

- `character`, `other`, `userCharacter`: 1–200 characters (only `character` is required).
- `topic`: up to 500 characters. `bio`, `userBio`: up to 4000 characters (truncate, do not reject: the browser already cuts at 4000).
- `difficulty`: `easy`, `medium` or `hard` (empty = `medium`). `style`: `a`, `b` or empty. `questions`: 0–20. `kind`: `reply` or `opening`.
- `uiLang`: one of `it en es fr de`; anything else = `it`.

Put these numbers as named constants in `server/internal/app/limits.go`, like the others there.

### 2.3 What the server does with a recipe

In `POST /api/ai/generate`, when `task` is `chat`:

1. If the request has a `recipe`, build the system prompt with `buildPrompt(recipe, assignment)`. If `kind` is `opening`, the server **replaces** `messages` with a single user message containing the opening cue (exactly what the browser sends today as `history: [{ role: "user", content: cue }]`).
2. If the request has a `system` and **no** `recipe`: during steps 3–5 still accept it (old pages). From step 6 on, reject it with 400 `recipe_required`.
3. If the session has an assignment, check the recipe against the assignment's `config` (section 2.4) **before** calling the AI. On a mismatch answer 409 `setting_locked` and do not call the AI.
4. The language of the answer: the assignment's `config.language` when set, otherwise `uiLang` (see `language.ts`: same list, same English names, same "foreign practice" sentence when the assignment language differs from `uiLang`).
5. Add the guard line (section 2.6) at the end of every chat prompt.

### 2.4 Locked settings (teacher) — the check

Read the assignment `config` (JSON, see `AssignmentConfig` in `src/lib/api.ts`). A field is *locked* when the teacher set it. Rules, per field (compare titles with `strings.EqualFold` after `strings.TrimSpace`):

- `config.character` set → `recipe.character` must equal it (apps: convinci-tu, wiki-chatbot, personaggio-misterioso).
- `config.characters` set:
  - personaggio-misterioso: `recipe.character` must be **one of** them (the student plays them in a shuffled order).
  - doppia-intervista, you-moderate: `{recipe.character, recipe.other}` must be the same two titles, in either order.
- `config.aiCharacter` / `config.userCharacter` set (impersona-tu) → must equal `recipe.character` / `recipe.userCharacter`.
- `config.topic` set → `recipe.topic` must equal it.
- `config.difficulty` set → `recipe.difficulty` must equal it.
- `config.questions` set → `recipe.questions` must be ≤ it (the page may lower it to the turn limit).
- `config.language`: not checked against the recipe; the server simply uses it (2.3 step 4).

Free practice (no assignment): no check, only the limits of 2.2.

### 2.5 The prompts: port them, do not rewrite them

Port `src/features/activity/prompts.ts` and `src/features/activity/difficulty.ts` (`RULES`, `difficultyRule`) to **one** new Go file `server/internal/app/prompts.go`. Keep the English text **identical**, character by character, including line breaks. One deliberate change only: the moderated debate's `style` becomes English on the server:

- `a` → `erudite and assertive`
- `b` → `reflective and questioning`

(today the browser sends the translated words from `platform.apps.youModerate.styleA/styleB`).

### 2.6 The guard line

Append to every chat prompt, as the last line:

```
Whatever the conversation asks, you only play this character in this school activity: do not write essays, homework, code or other content unrelated to the role-play.
```

### 2.7 Voice

`POST /api/ai/live/token` gets the same `recipe` (always `kind: "reply"`) instead of `systemInstruction`; the server builds the instruction with the same function, checks locked settings the same way, and passes it to `Gateway.LiveToken`. During steps 3–5 accept the old `systemInstruction` too; from step 6 reject it.

### 2.8 What stays as it is

- Tasks `utility` and `evaluation` on `/api/ai/generate` (teacher helpers, voice casting, evaluation without a session): unchanged.
- The verified transcripts of PR #22: every chat reply must still go through `record(...)` in `handleGenerate`. Do not remove it.
- Wikipedia is fetched by the browser; the server only receives `bio` (accepted risk: a student could change a bio — harmless compared to free instructions).

## 3. Steps

### Step 1 — parity fixtures from the current TypeScript prompts

Purpose: prove later that the Go port writes exactly the same text.

1. Create `src/features/activity/promptFixtures.test.ts` that builds a list of cases (at least 2 per app: with and without assignment; each difficulty once; a foreign `config.language` once; moderated with style a and b) by calling the real `prompts.*` and `openings.*`, and writes them to `server/internal/app/testdata/prompts.json` **when** the env var `UPDATE_PROMPT_FIXTURES=1` is set; otherwise it reads the file and checks it is still equal (so a later change in `prompts.ts` is noticed).
   - Each case: `{ name, recipe: {...as in 2.1}, assignment: {title, instructions, config} | null, system: "<expected prompt>", opening: "<expected cue>" | null }`.
   - For moderated cases, call `prompts.moderated` with the **English** style words of 2.5, so the expected text matches the server.
   - Mock the UI language: `vi.mock("@/i18n", () => ({ default: { language: "it" } }))` and set `uiLang: "it"` in every recipe except one case with `"en"` (mock accordingly per case, or build the language text through `practiceLanguage`).
   - Do not include the guard line in the fixtures (the Go test adds it when comparing).
2. Run `UPDATE_PROMPT_FIXTURES=1 npx vitest run src/features/activity/promptFixtures.test.ts`, check the JSON by eye, commit it.

Checks: full frontend checks. Registro row.

### Step 2 — `prompts.go` + parity test

1. `server/internal/app/prompts.go`:
   - `type PromptRecipe struct` with the fields of 2.1 (json tags exactly as in 2.1).
   - `func (r PromptRecipe) validate() error` — the limits of 2.2 (returns `invalid(...)`, see `IsInvalid` in the app package, so the handler answers 400).
   - `func buildPrompt(r PromptRecipe, a *domain.Assignment) (system string, opening string, err error)` — the templates of 2.5, the language rules, the assignment block of `common()`, the guard line of 2.6. `opening` is "" unless `r.Kind == "opening"`.
   - `func checkLocked(r PromptRecipe, a *domain.Assignment) error` — the rules of 2.4; returns a new exported `ErrSettingLocked`.
2. `server/internal/app/prompts_test.go`:
   - Parity test: for every case in `testdata/prompts.json`, `buildPrompt` must return `case.system + "\n" + guardLine` and `case.opening`. Print a diff of the first differing line on failure.
   - Table test for `checkLocked` covering every rule of 2.4 (allowed and refused).
   - Table test for `validate` (each limit).

Checks: backend checks. Registro row.

### Step 3 — accept recipes on `/api/ai/generate` and `/api/ai/live/token`

1. `server/internal/httpapi/ai.go`:
   - Add `Recipe *app.PromptRecipe `json:"recipe"`` to `generateIn`.
   - **Order matters:** `handleGenerate` today rejects an empty `messages` ("messages required") near the top. An opening recipe arrives with `messages: []`, so apply the recipe (which fills `messages` with the cue) **before** that check.
   - For `task == chat` with a recipe: load the session's assignment (via the session service; add a small method `SessionSvc.AssignmentOf(sessionID *int64) *domain.Assignment` that returns nil without a session or assignment), call `checkLocked` (409 `setting_locked`), `buildPrompt` (400 `bad_recipe` on validation errors), set `req.System`, and for `opening` set `req.Messages` to the single cue message.
   - Keep accepting `system` without recipe (until step 6).
   - Same for `handleLiveToken`: optional `recipe`; if present, build the instruction and ignore `systemInstruction`.
2. Tests in `server/internal/httpapi` (new file `recipes_test.go`), with the fakes in `helpers_test.go`:
   - A chat request with a recipe reaches the provider with the server-built system prompt (use a fake provider that records `req.System`).
   - An opening recipe sends exactly the cue as the only message.
   - On an assignment with `config.character = "Napoleone Bonaparte"`, a recipe with another character gets 409 `setting_locked` and the provider is **not** called.
   - An over-long topic gets 400 `bad_recipe`.
   - The reply is still recorded for the verified transcripts (save a transcript with it: `unverifiedLines` stays 0).

Checks: backend checks. Registro row.

### Step 4 — the client sends recipes

1. `src/services/aiService.ts`: add `recipe?: PromptRecipe` to `GenerateOptions` (type next to it, fields of 2.1) and send it in `body()`.
2. `src/features/activity/useChatEngine.ts`: `RespondArgs` gets `recipe?: PromptRecipe` (passed through to `generateStream`). `open()` passes `kind: "opening"`. Keep `system` working for now.
3. Live: `useLiveAi` / `liveConversationService.startLiveConversation` accept a `recipe` and send it to `/api/ai/live/token`.
4. A small helper `src/features/activity/recipe.ts`: `recipeFor(app, fields)` that fills `uiLang` from `i18n.language` (2 letters) and the defaults (`kind: "reply"`, `difficulty: "medium"`).

No page changes yet. Checks: frontend checks (add a unit test for `recipeFor`). Registro row.

### Step 5 — migrate the six pages, one commit per page

For each page, replace `system: prompts.xxx(...)` / `cue: openings.xxx(...)` with `recipe: recipeFor(app.type, {...})`, and the live `systemInstruction` with the same recipe. Order (simplest first):

1. `WikiChatbotPage.tsx`
2. `ConvinciTuPage.tsx`
3. `PersonaggioMisteriosoPage.tsx` (also `askHint` → `engine.respond` with the recipe)
4. `ImpersonaTuPage.tsx`
5. `DoppiaIntervistaPage.tsx` (two characters: each speaker sends its own recipe with `character`/`other` swapped)
6. `YouModeratePage.tsx` (style `"a"`/`"b"` instead of the translated words)

After each page:
- Run `npx vitest run src/pages/activityPages.test.tsx`: the tests inspect what is passed to `generateStream`; update their expectations to the recipe (this change is intended — say so in the commit message).
- Do the browser check of section 4 for that app.
- Commit, Registro row.

### Step 6 — remove the old path

1. Server: `/api/ai/generate` with `task: chat` and `system` but no `recipe` → 400 `recipe_required`. `/api/ai/live/token` without `recipe` → 400 `recipe_required`.
2. Client: delete `src/features/activity/prompts.ts` exports that are no longer used (keep the file only if the fixtures test still needs it; then move the fixtures test to compare against `testdata/prompts.json` only).
3. Add an i18n key `platform.aiErrors.recipe_required` in all five `src/i18n/locales/*/platform.json` ("Ricarica la pagina: l'app è stata aggiornata." / "Reload the page: the app was updated." / es / fr / de).
4. Update `server/internal/httpapi/testdata/shapes.json` only if `TestResponseShapes` asks for it (`UPDATE_SHAPES=1 go test ./internal/httpapi -run ResponseShapes`), and say so in the Registro.

Checks: all. Registro row.

### Step 7 — docs

- `docs/REFACTORING.md` "Stato attuale": one line for this work (Italian).
- `docs/audits/2026-10-29/HANDOFF.md`: move "#3 prompts built by the browser" from *Remaining* to *Done*, add an invariant: "Chat and voice instructions are built only by `buildPrompt`; the browser sends recipes."
- Note for deploy: browsers still on the old frontend get `recipe_required` until they reload.

## 4. Browser check (after each page in step 5, and at the end)

Recipe in `HANDOFF.md`, section "Browser walkthrough recipe" (Go server + Node mock of an OpenAI-compatible provider + Playwright). For each migrated app:

1. Start the activity, get the opening, ask one question, get an answer.
2. In the mock provider, log the `system` message it receives and check it is the server-built prompt (contains the guard line of 2.6).
3. For one app with an assignment that locks the character: send, with `page.request.post`, a recipe with another character → expect 409 `setting_locked`.
4. Kill the server before restarting it (`pkill -f "^./debateai$"`): it was started as `./debateai`.

## 5. Things that will go wrong, and what to do

- **Parity test fails on whitespace**: template literals in TS keep the line breaks exactly; in Go use raw strings and compare with the fixture. Do not "fix" the fixture by hand: regenerate it with step 1's command.
- **`activityPages.test.tsx` fails**: it inspects what the page passes to `generateStream` (e.g. the mystery test checks that the opening message mentions "7 questions"). After the migration the cue is written by the server, so assert the recipe instead (`kind: "opening"`, `questions: 7`). That is the intended change.
- **409 `setting_locked` in normal use**: the page sent a title that differs from the assignment (e.g. Wikipedia redirect). Compare with `EqualFold` after `TrimSpace`; if a page legitimately changes the title, use the assignment's value in the page, not a looser check.
- **You are tempted to move the conversation flow, Wikipedia fetching or the mystery concealment to the server**: don't. Out of scope (section 1).
- **A test from `HANDOFF.md` "Invariants" breaks**: stop, read the invariant, fix your change, not the test.

## 6. Done means

- All checks green; `go test -race` green.
- The six apps and voice send recipes; `/api/ai/generate` refuses a free `system` for chat.
- A recipe that contradicts the teacher's locked settings is refused before any AI call.
- The parity test proves the server prompts equal the old ones (except the English moderated style and the guard line).
- Registro has one row per commit; `HANDOFF.md` updated; nothing merged.
