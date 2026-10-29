# Audit 2026-10-29: handoff for the next agent

Read this instead of re-deriving the work. The source audit is `REVIEW.md` in this folder; numbers like `#4` refer to its sections. This file says what is already done, what must not be broken, and what to do next, with pointers.

## Ground rules

- Repo: `DebateAI/` (Go server in `server/`, React/Vite frontend in `src/`).
- `AGENTS.md` → read `docs/REFACTORING.md` first. Audit fixes are **behaviour changes, not refactoring**: do not tick refactoring tasks. Add one row per commit to the *Registro* table and keep the "Correzioni dell'audit" line in *Stato attuale* current. Copy commit hashes from `git log`, never from memory. The document is written in Italian; keep it that way.
- One fix = one commit, e.g. `fix(<area>): <what> (audit #N)`.
- Branch: `fix/audit-pass1`, based on `master@f1d7178`. Pushed; **PR #21** is open, not merged. Merging to `master` deploys to production on Vercel, so ask the user before merging. Push new commits to the same branch (the PR follows).
- Verification (all were green at hand-off):
  - `cd server && go vet ./... && go test ./...`; for concurrent code also `go test -race ./internal/...`. Sockets work in this environment, so the `httptest` suites run.
  - `npm run lint && npx tsc --noEmit -p tsconfig.app.json && npm test && npm run build` (228 Vitest tests).
  - `npm run check:i18n` (955 keys, 5 locales: it, en, es, fr, de). Every new UI string goes into all five `src/i18n/locales/*/platform.json`.
  - API contract: `TestResponseShapes` compares against `server/internal/httpapi/testdata/shapes.json`. If a change is intended, regenerate with `cd server && UPDATE_SHAPES=1 go test ./internal/httpapi -run ResponseShapes` and say so in the Registro.

## Done on the branch (commits after `b9c5991`, which adds the audit doc; the second session starts at `b1711aa`)

| Audit | Commit | What |
|---|---|---|
| #6 | `17e31dc` | `src/context/AuthContext.tsx` `switchIdentity`: when the user id changes (not on the first load), it cancels and clears all React Query data and calls `resetAiStatus()`. |
| #7 | `8085eb6` | `server/internal/httpapi/clientip.go` `proxyTrust`: forwarding headers are trusted only from a trusted peer, and `X-Forwarded-For` is read right-to-left. `TRUSTED_PROXIES` env: empty means private networks and loopback, `*` trusts all (the default when `VERCEL` is set), `none` trusts nobody, or a list of CIDRs. Use `s.clientIP(r)`; the old free function is gone. |
| #3 (part) | `ca1fe34` | `sessionService.Complete` rejects scores outside 0–10 (400). |
| #4 (part) | `a74982b` | `maxTokens` clamped to `maxGenerateOutputTokens` (8192). **No default cap on purpose:** reasoning models count thinking tokens in `max_tokens`, so a low default could return empty answers. `/api/ai/generate` body is limited to 1 MB (`readJSONLimit`). `SpendSince`, `CountUserRequestsSince` and `CountRoomRequestsSince` now return `(n, error)`; limit checks fail closed: `BudgetExceeded()` becomes true, and a 503 `usage_unavailable` is returned. |
| #2 | `b4e9cba` | See *Invariants*. New columns `activity_sessions.revision` and `judged_revision`. `TranscriptSync.revision` and `SessionDetail.revision` are added (shapes regenerated). |
| #1 | `e07a825` | See *Invariants*. New component `src/features/activity/components/SaveNotice.tsx`. |
| #5 | `c6da46d` | New table `live_grants` (`store/live_grants.go`, `domain/live.go`). `/api/ai/live/token` returns `grantId`. `/api/ai/live/usage` takes `{grantId, inputTokens, outputTokens}` only. One report per grant, by the same user (or anonymous for an anonymous grant). Provider, model, session and duration come from the grant (TTL `liveGrantTTL` = 1 h). Otherwise it answers 409 `bad_grant`. |
| docs | `3a1f482` | Registro and Stato attuale updated. |
| #4 | `b1711aa` | Table `ai_inflight` (`store/inflight.go`, `app/admission.go`): generation slots (`Gateway.Admit`, caps in `httpapi/limits.go`: 3 per user, 40 per room, 30 per network without an account) and budget reservations (`aiGateway.reserve`, called in `tryTarget` and in the judge per target). Each check-and-insert is one atomic statement; rows expire after `inflightTTL` (10 min). `BudgetExceeded` = spend + reservations. Unpriced models: logged `unpriced`, reserved at `unpricedReserve`. Streams with text but no usage: logged `estimated`. `boundHistory` drops oldest messages beyond `maxChatInputChars` (413 `too_large` if the last one alone does not fit). 429 `busy` beyond the caps. |
| #10 | `da50954` | Five indexes in `schema` (it runs on every open, so no migration needed); `TestFrequentQueriesUseIndexes` checks the plans. |
| #9 | `37bfee3` | `BestPerUser`, `LatestPerAssignment` (window functions, `rankedSessions`), `StatsForClass`, `CountMemberships()`, `SpendPerUserSince`. |
| test | `2821bb8` | MarkdownViewer highlight check waits up to 5 s (flaky under the full parallel run). |
| #3 | `adb16af` | `POST /api/sessions/{id}/evaluate` (SSE, `app/evaluation.go`, `httpapi.handleEvaluateSession`): the server grades the stored transcript and hands in. `/complete` is reflection-only and once-only (409 `session_completed`). Client: `session.evaluate` in `useActivitySession`, `evaluateSession`/`postEventStream` in `aiService.ts`. |
| #8 | `51bede5`, `1ce5cb4`, `74672ff`, `38b370e` | Intent preloading (`features/navigation/intentPreload.ts`; `data-preload` on non-link elements). i18n: Italian bundled, other languages and tutorial namespaces through a small backend in `src/i18n/index.ts`; `main.tsx` renders after `i18nReady`; tutorial routes use `withTexts` in `App.tsx`. Voice SDK and diffusion lazy. Chunk budget 750 kB. |
| #13 | `525fd43` | Composer enabled while busy, Stop (`engine.stop`, one `AbortController` per `withBusy`), IME-safe Enter. |
| #14 | `90e321c` | Mystery: prompt confirms a correct name; judge question `identified` (also without goals); `domain.ReasonIdentified`; client `ask()` in `PersonaggioMisteriosoPage` forces judging when the name appears and falls back to `isCorrectGuess` when the turn was not judged (`session.judgedLastTurn()`). Unchanged transcripts are not re-judged. |
| #11 | `0b225ed`, `f08a62b` | `lobbyDelay`/`roomIsGone` in `roomApi.ts`; `cachedSettings` (`app/settings_cache.go`), `memoPrices` (`routing.go`). |
| #12 | `b4eb55a`, `35ec5ae` | Hold only for chat; `firstTextBudget`/`generateDeadline`; `targetHealth` (`app/target_health.go`); `first_delta_ms`/`first_text_ms` via `firstDeltaClock` + `meterTimed`. |
| #15 | `7c22709` | `mail_outbox`, `store/outbox.go`, `app/outbox.go` (`outboxMailer`, `mailOutbox.Run/Deliver`); started in `NewServer`, also run by the cron. |
| fixes | `f04cbf1`, `6fe2214` | Found in the browser walkthrough: evaluation now survives a disconnect (`context.WithoutCancel`, `evaluationDeadline`); stopped held-back streams are estimated from the provider's text. |

## Invariants: do not break

1. **Transcript writes are conditional** (`store/activity_sessions.go`):
   - `SaveTranscript(id, domain.TranscriptSave)` bumps `revision`. With `BaseRevision` set, a mismatch returns `domain.ErrStaleRevision` (HTTP 409 `stale_revision`).
   - A `completed` session is never rewritten: `domain.ErrSessionCompleted`, HTTP 409 `session_completed`.
2. **Judgements only move forward**: `SaveJudgement(..., revision)` writes only if `judged_revision < revision`. A dropped stale verdict yields an empty `JudgeResult` and no state transition.
3. **Status changes are compare-and-set**: `SetStatus(id, from, to)`. If nothing moved, `sessionService.currentStatus` reports the stored status.
4. **Never hold a DB transaction across an AI call.** The judge runs after the transcript tx commits.
5. **Client saves are serialized** (`useActivitySession.ts`):
   - `saveQueue` chains the PUTs, and each one sends `baseRevision` from the last response.
   - After a `stale_revision` error, the next save goes out without a base.
   - `complete()` awaits `saveQueue` before POSTing.
   - `seq`/`syncSeq` still drops superseded answers for UI state only.
6. **Hand-in happens once, graded by the server.** `store.Complete` only updates a non-completed attempt (`domain.ErrSessionCompleted`). Scores and evaluation are written only by `sessionService.Evaluate`; `Completion` carries the reflection alone. `session.evaluate` awaits `saveQueue` like `complete()`.
7. **Admission before AI calls.** `/api/ai/generate` and `/evaluate` go through `Server.admit` (quotas, then slots); every paid target reserves its estimate before dispatch and releases it after. Do not add an AI endpoint that skips them.
8. **Mystery character final guess still works.** `PersonaggioMisteriosoPage.submitGuess` calls `afterTurn({ judge: true })` while the session is ended but not completed. The server re-judges ended attempts only on request. Because `complete()` waits for the queue, the guess is saved and judged before the hand-in; with a slow judge, the hand-in can wait up to `judgeRequestTimeout` (90 s). Covered by `TestSaveTranscriptJudgesAnEndedAttemptOnlyOnRequest`. Don't change the order to "complete first": the transcript save would then be refused.
9. **`judge: false` is forwarded** by `sync` (it used to be dropped). You Moderate's `speakAlone` saves with `{ judge: false }`, because a line spoken without a moderator turn is not a student turn.
10. **Start of assigned work**: `useActivityFlow.begin` returns `false` and stays on setup when a logged-in user has an assignment but the session could not be created. All six pages do `if (!(await flow.begin(...))) return;`. Free practice continues, with `session.startFailed` driving the "not being saved" notice.
11. The submission notice distinguishes `submitted` (assignment, "Handed in") from `savedToHistory` (free practice). AI feedback and hand-in are separate states.

## Remaining work, in suggested order

### Correctness leftovers

- **#1 local draft and resume.** A local draft of unsent text (scoped to user and session, with expiry) and a resumable session route: hydrate from `GET /api/sessions/{id}`, which includes `revision`; set `revisionRef` from it. Restart must clearly mean a new attempt.
- **#3 prompts built by the browser.** Each page builds the character's system prompt (`features/activity/prompts.ts`) and sends it to `/api/ai/generate`; checking the saved `context` against the assignment would only make the record match, not the prompt. Real protection means building prompts on the server for the six apps (a large change: prompts, i18n, Wikipedia bios). Decide with the user before starting.
- **#4** Reservations use a fixed estimate, released after the call rather than reconciled; live voice is granted but not reserved.

### Pass 2 leftovers

- `Grades` still runs two queries per assignment. Leave `SetMaxOpenConns(1)` unless measured.
- #8: Prism Light with only the needed languages, if code highlighting matters (the optional chunk is ~640 kB).
- #13: the active message still reparses its Markdown on every streamed update; profile on a slow device before changing.
- #14: `EvaluateEvery` defaults to 1; raising it is a cost/accuracy decision for the user.
- #7 (multi-instance): provider cache invalidation only reaches the instance that handled the admin change.

### Pass 3 (UI)

See the "UI and usability" section of `REVIEW.md`:
- Phone header overflow at 390 px.
- Compact app selection.
- `WikiSearchSelect.tsx` search states, stale-request aborts and locale normalization.
- Error versus empty states in StudentDashboard and AdminCosts (HostRoomPage is done in `0b225ed`).
- `index.html` has a hard-coded `lang="it"`.
- Pale amber/sky text colors on light backgrounds.
- WikiChat tutorial card copy.
- Status semantics: `turn_limit` and `goal_reached` versus submitted.

### Browser walkthrough recipe

A full flow was run with the real Go server (`go build`, `PORT=8091 DATA_DIR=… APP_SECRET=… ADMIN_EMAIL=… ADMIN_PASSWORD=…`), a Node mock of an OpenAI-compatible provider (free model via `/models` pricing `"0"`, slow SSE answers, an evaluation answer with `SCORE_` lines) added through `POST /api/admin/providers`, and Playwright from `node_modules/playwright` (skip the tour with the text "Salta"; the character search is the `combobox`). Kill the old server before restarting: it was started as `./debateai`.

## Gotchas learned

- `session.evaluate` and `/evaluate`: the evaluation keeps running after the browser disconnects; do not tie it back to the request context.
- Chat answers shorter than 160 characters become visible only when complete (refusal check); `first_text_ms` shows it.
- Old browsers still on the previous frontend hand in through `/complete` with their own evaluation: it is now ignored, so those attempts are stored without evaluation/scores until reload. Mention at deploy time.
- `useActivitySession.test.tsx` also mocks `@/services/aiService` (only `evaluateSession`).
- Vitest has **no jest-dom matchers**: use `el.textContent`, `container.innerHTML`, etc. Component tests mock `react-i18next` with `t: (k) => k`.
- `useActivitySession.test.tsx` mocks `@/lib/api` with only `api`, so importing `ApiError` there breaks the mock. Duck-type `(e as { code?: string }).code`.
- `server/internal/httpapi/e2e_test.go` asserts the exact session cost and per-task request counts. Add extra AI calls at the end of the test (before the budget block), without a `sessionId`.
- The `byClass` rows in `shapes.json` rely on one usage row without a session (the live-usage call in `shapes_test.go` uses a session-less grant on purpose).
- `AuthProvider` now needs a `QueryClientProvider` above it; `App.tsx` already has one, and tests must wrap it.
- Old browsers still on the previous frontend send the old live-usage payload and get a 409, so that usage goes unrecorded until reload. This is acceptable but worth mentioning at deploy time.
- No live UI walkthrough was done for the new notices; they are covered by hook and component tests. A browser check of a failed save (offline) and of the hand-in states is still worth doing.
