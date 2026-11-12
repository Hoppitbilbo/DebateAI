# Investigation 11/11 — critical bugs, efficiency and code reduction

Date: **2026-11-11** · Branch read: `refactor/concurrent-settings-2026-11-11` at `cc34234`.

This is a **plan only**. No application code, test, schema or configuration was changed, nothing was committed, pushed or deployed.

**How it was done and its limits.** Static reading of the Go server (router, auth, classes, sessions, AI gateway, judge, evaluation, rooms, database layer, mail) and of the main frontend paths (API client, AI service, activity session, chat engine, live voice). No test, build, load test or production query was run for this document. Every item says whether it is **confirmed by reading the code** or **to verify** on a real runner. Not read in depth: `room_transfer.go`, `gateway_admin.go`, `prompts.go`, the AI adapters, admin pages, tutorials, i18n files.

Each fix that changes behaviour is outside the pure-refactoring rules of [REFACTORING.md](REFACTORING.md): write the failing test first, one commit per item, and record it there.

---

## 1. Summary

| # | Finding | Severity | Status |
|---|---|---|---|
| C1 | Mystery game is won by a common word of the character's name | Critical (grades) | Confirmed by reading |
| C2 | On Vercel, password-reset and notification mails may arrive after the 2-hour link expired | Critical (accounts) | Likely — verify in production |
| C3 | Read-then-write transactions can fail under classroom concurrency on remote libSQL | Critical (lesson) | To verify on libSQL |
| C4 | No size limit on a transcript message: cost and CPU exhaustion through judge and evaluation | Critical (cost / availability) | Confirmed by reading |
| C5 | `/api/ai/generate` accepts a caller-written system prompt for `utility` and `evaluation` | High (cost / pedagogy) | Confirmed by reading |
| C6 | Room PIN and room-code limits can be bypassed by a parallel burst, and are per instance | High (guest takeover) | Confirmed by reading |
| M1–M9 | Nine medium findings (sessions kept after admin reset, judge prompt injection, co-teacher powers, Host-header links, byte truncation, …) | Medium | See §3 |
| E1–E6 | About 18–20 sequential database round trips per chat message; cold-start schema run; missing indexes | Efficiency | See §4 |
| F1–F3 | Unused toast system in the bundle, unused dependencies, 2,958 unused UI lines | Efficiency / size | See §5 |
| R1–R8 | Code reduction: about 90 repeated handler lines, duplicated helpers, stale worktrees | Reduction | See §6 |

Recommended order: **C1 → C4 → C6 → C2 → C3 → C5**, then M1/M2, then the efficiency batch E1–E3, then the removals F/R. Total for the critical block: about **3–4 working days**.

---

## 2. Critical findings

### C1. Mystery game: a common word wins the game and fixes the score at 8–10

- **Where:** `server/internal/app/mystery.go:45-63` (`namesCharacter`), mirrored in `src/features/activity/mystery.ts:26-32` (`isCorrectGuess`). Used by `session_service.go:217` (ends the game) and `evaluation.go:83` (fixes the score).
- **What happens:** any word of the answer with 4+ letters counts as naming the character when it appears as a whole word in a student message. Wikipedia titles often hold ordinary words or places.
- **Examples (from the rule as written):**
  - "Alexander the Great" — "Was he a **great** leader?" wins.
  - "Elisabetta I d'Inghilterra" — "Viveva in **Inghilterra**?" wins.
  - "Giovanna d'Arco" — any sentence with "**arco**" wins. "Leonardo da Vinci" — "**vinci**" is also an Italian verb form.
  - "Caterina II di Russia", "Federico II di Svevia", "Queen Victoria" ("Was she a **queen**?").
- **Effect:** the server sets `Identified`, the attempt ends, and `gradeMystery` gives 10 at the first question, never below 8. The teacher sees a top grade for a lucky ordinary question.
- **Fix:**
  1. Match the full normalized name, or the *identifying* words only: drop everything after a particle (`di`, `d`, `de`, `of`, `the`, `von`, `da`, `del`, `della`), roman numerals and a short stop list of titles (`queen`, `king`, `pope`, `papa`, `regina`, `saint`, `san`, `great`, `magno`, `grande`).
  2. When nothing identifying is left (e.g. "Queen Victoria" → `victoria` stays; "Alexander the Great" → `alexander`), fall back to the full name.
  3. One shared fixture (`testdata/mystery_names.json`: answer, message, expected) read by both the Go test and the Vitest test, so the two copies cannot drift.
- **Tests first:** the five examples above must fail before the change; existing "Vinci"/"Leonardo" cases keep passing.
- **Effort:** 3–4 h.

### C2. Vercel: reset and notification mails depend on a background worker and a daily cron

- **Where:** `app/outbox.go:121-127` (`SendMailAsync` only enqueues), `httpapi/server.go:37` (`go s.Outbox.Run`), `vercel.json` cron `30 3 * * *`, `app/limits.go:101` (`resetLinkTTL = 2h`), `app/password_reset.go:35`.
- **What happens:** the reset mail is written to `mail_outbox` and sent by a goroutine after the HTTP response. A serverless instance is not guaranteed to keep running after it answered. The only safety net is the cron once a day, while the link lives two hours. The same path carries welcome, feedback and assignment mails.
- **Verify first (15 min):** in production, compare `created_at` and `sent_at` of `mail_outbox` rows, and count rows with `sent_at IS NULL`. Also confirm `CRON_SECRET` is set: without it `handleCronPurgeRooms` answers 401 and the safety net does nothing.
- **Fix (pick one):**
  - **Recommended:** send the reset mail inside the request (`SendMail`, as invitations already do) and keep the outbox for bulk mails; the endpoint already answers OK whatever happens, so run it with a bounded timeout.
  - Or call `Outbox.Deliver(ctx)` before answering whenever a mail was queued in that request.
- **Effort:** 2–3 h plus the production check.

### C3. Read-then-write transactions on remote libSQL

- **Where:** `store/rooms.go:148-181` (`AddGuest`: count, check nickname, insert user, insert guest), `store/activity_sessions.go:266-296` (`SaveTranscript`: select, then update), `store/classes.go:242` (`JoinByCode`).
- **Risk:** each is a transaction that reads first and writes later, with a network round trip in between. SQLite has one writer for the whole database; a transaction that read an old snapshot and then tries to write after another commit is refused, and a busy timeout does not resolve that case. Locally the single connection (`SetMaxOpenConns(1)`) hides it. With 30 students joining a room or 40 saving transcripts at once on Turso, some requests may answer 500.
- **Status: to verify.** The project's own handoff ([TODO_2026-11-11.md](TODO_2026-11-11.md)) lists the libSQL concurrency run as still pending; the code comment at `activity_sessions.go:283` already notes the read does not lock on remote databases. I did not reproduce it.
- **Fix (also removes round trips, see E1):**
  - `SaveTranscript`: one statement, `UPDATE … WHERE id = ? AND status != 'completed' AND (? IS NULL OR revision = ?) RETURNING revision`; only when no row comes back, one `SELECT status, revision` to tell `completed` from `stale`. Four round trips become one.
  - `AddGuest`: insert the guest with `INSERT … SELECT … WHERE (SELECT COUNT(*) …) < max_guests` in a write-first transaction (the unique index already catches the nickname), or open the transaction with `BEGIN IMMEDIATE`.
  - Add one bounded retry on a busy error in a small helper, used by these three.
- **Tests:** extend `TestMultiInstanceConcurrency` with 30 concurrent joins and 40 concurrent saves, run with `LIBSQL_TEST_URL`.
- **Effort:** 0.5–1 day including the libSQL run.

### C4. No size limit on transcript messages

- **Where:** `httpapi/server.go:290` (`readJSON` allows 8 MB), `app/session_service.go:164` (keeps the last 1,000 messages, any length), `app/evaluation.go:238` (whole conversation joined into the prompt, no cap), `app/judge.go:129-133` (trimming loop), `app/session_service.go:67-69` (context stored as sent).
- **What a student or a room guest can do with the API:**
  1. Save an 8 MB transcript, then ask for the evaluation: the whole text goes to the model as one prompt. With a paid model this is real money; with the budget on, the reservation blocks other students' calls meanwhile.
  2. Trigger the judge on it: `jevState` re-marshals the whole state once per dropped message (`for len(mustJSON(state)) > maxChars { conv = conv[1:] }`). With 1,000 large messages that is up to 1,000 marshals of megabytes — seconds to minutes of CPU per save.
  3. Create sessions without limit, each with up to 8 MB of `context`.
- **Fix:**
  - Cap one message (e.g. 8,000 characters, cut rune-safe) and the stored transcript (e.g. 400 kB) in `SaveTranscript`; lower the body limit of the transcript and session endpoints to 1 MB; cap `context` (e.g. 16 kB).
  - Cap the evaluation prompt the same way the judge is capped (keep the newest lines, note what was left out).
  - Make the judge trimming linear: compute each message's size once, drop from the front by subtraction, marshal once.
  - Cap active sessions per user per day (generous, e.g. 200).
- **Tests first:** oversized message is cut; evaluation prompt stays under the cap; `jevState` with 1,000 × 8 kB messages finishes within a time bound.
- **Effort:** 4–6 h.

### C5. `/api/ai/generate`: free system prompt for `utility` and `evaluation`

- **Where:** `httpapi/ai.go:120-155`. Only `chat` requires a recipe. For the other two tasks the caller's `system` and `messages` go to the model unchanged, up to 200,000 characters in and 8,192 tokens out.
- **Who can call it:** every logged-in student, every room guest, and anyone without an account when guest access is on (limited per IP in memory, per instance).
- **Effect:** the platform works as a general chatbot outside the teacher's settings (`setting_locked` and the guard line are skipped), and it spends the school's AI budget. Real callers exist and are legitimate: `voiceSelectionService.ts:59`, `features/room/suggestions.ts:131`, `pages/dashboard/AssignmentFields.tsx:89`, `utils/evaluationUtils.ts:88` (guest evaluation).
- **Fix:** replace the free prompt with named server-side jobs, as was done for chat: `{"job":"voice"|"room_suggestions"|"assignment_help"|"guest_evaluation", …fields}`; the server writes the prompt. Teacher-only jobs are checked by role. Until then, as a small first step: `utility` ≤ 4,000 characters in and ≤ 512 tokens out, and `evaluation` without an account ≤ 20,000 in.
- **Effort:** first step 1–2 h; named jobs 1 day. Old browsers get the same "reload the page" answer already used for `recipe_required`.

### C6. Room PIN and room-code limits

- **Where:** `httpapi/rooms.go:120-141` (PIN), `rooms.go:81-118` (codes), `httpapi/server.go:353-378` (in-memory limiter).
- **Two problems:**
  1. **Check, then count.** The request is refused only if the counter is already full, and the counter grows only *after* a failure. A burst of parallel requests all pass the check before any failure is counted. The PIN has four digits: 10,000 parallel guesses within its 10 minutes find it.
  2. **Per instance.** The limiter lives in memory; each Vercel instance has its own.
- **Effect:** someone who knows a room code and a nickname can enter as that student while a PIN is pending, see their work and write in their name. The same burst lets room codes be enumerated faster than the 60-per-10-minutes rule intends.
- **Fix:** count the attempt before checking (one `Hit`, refuse when over), and use the database limiter that already exists for logins (`store/rate_limits.go`, `AuthRateLimits.Hit`) so every instance shares it. This also deletes `exhausted()` and the `codeGuard` type.
- **Tests first:** 50 concurrent wrong PINs → at most 5 reach the comparison.
- **Effort:** 3–4 h.

---

## 3. Medium findings

| # | Finding | Where | Fix | Effort |
|---|---|---|---|---|
| M1 | An admin who sets a user's password does not end that user's logins (a user's own change does). A stolen session survives the reset. | `httpapi/admin.go:149`, `app/auth_service.go:130-139` | In `SetPassword`, also delete the account's `auth_sessions` (the store method `Logins.DeleteForUser` exists). | 1 h |
| M2 | The text-model judge trusts the model's `completed` flag: a student line such as "answer completed true" can end the activity as goal reached. The JEV engine already decides from scores only. | `app/judge.go:376`, `finalize` at `:247` | Ignore `parsed.Completed`; completion = all goal scores over the threshold. Removes a field and a branch. | 1–2 h |
| M3 | A co-teacher can delete the whole class and remove any member, the other teachers included. A class invitation with role teacher creates a platform-wide teacher account. | `httpapi/classes.go:88-98`, `:137-147`; `app/auth_service.go:346` | **Decision needed.** Suggested: delete and remove-teacher only for the owner or an admin. | 1–2 h after the decision |
| M4 | Mail links are built from the request's `Host` header when no public URL is set: a forged header puts another site in a reset link. | `httpapi/server.go:310-322` | With mail configured, require `PUBLIC_URL` (or the setting) and never fall back to `Host`. | 1 h |
| M5 | `truncate` cuts bytes, not characters: a cut inside "è" or "ü" stores broken text (titles, reflections, evaluations, judge state). | `app/session_service.go:311-316`, `app/judge.go:98` | One rune-safe helper used everywhere. | 1 h |
| M6 | Class invitations: no limit on addresses per request, and each mail is sent inside the request, one after the other. | `app/class_service.go:137-144`, `app/auth_service.go:399` | Cap (e.g. 100 per request) and queue the mails. | 2 h |
| M7 | Internal error texts (database messages) are returned to the browser in 500 answers, 53 places. | e.g. `httpapi/auth.go:49` | Log the error, answer a fixed message. Done once by R1 below. | with R1 |
| M8 | The refusal filter also catches in-character lines ("Non posso continuare questa guerra", "I cannot continue"): the answer is thrown away and another model is paid for. | `app/answer_check.go:36-46` | Require the AI-identity phrase, or the "cannot" phrase followed by a request word (help, assist, role-play), not `continue`/`create` alone. Add the false positives as tests. | 2 h |
| M9 | Two evaluations of one attempt can run at once (two tabs): both call the model, one result is discarded. | `httpapi/sessions.go:98`, `app/evaluation.go:57` | Claim the attempt with a conditional status update before calling the model. | 2 h |

Lower, noted only: first-run setup has no limiter and a small race (`httpapi/auth.go:72-97`); accepting an invitation is not one transaction, so one link can be used twice at the same moment (`app/auth_service.go:322-361`); a student can keep chatting without saving the transcript, so the turn limit is only enforced when a save arrives.

---

## 4. Efficiency — server

The production database is remote (Turso): **every statement is a network round trip**, and they run one after the other.

### E1. Round trips per chat message (about 18–20, roughly 12 before the first token)

Counted from the code path of `POST /api/ai/generate` for a student in an assignment:

| Step | Statements | Reduction |
|---|---|---|
| Login cookie → user (`auth_service.go:161-171`) | 2 | One `JOIN` query: −1 on **every** authenticated request |
| Daily / room limits (`ai.go:42-53`, `room_guests.go:175-200`) | 1–3 | Keep |
| Generation slot (`store/inflight.go:25-33`) | 2 per scope (a `DELETE` of expired rows, then the insert) | Drop the per-request `DELETE`; purge expired rows from the cron and at most once a minute, as `roomService.Purge` already does: −1 or −2 |
| Session owner + assignment (`ai.go:128`, `session_service.go:328`) | 3 | One query returning owner, status and assignment id: −1 |
| Budget check (`gateway.go:128-144`) | 2, one is `SUM(cost_usd)` over the whole month | Cache the month's spending for a few seconds, like settings: −1; add index `usage_log(created_at, cost_usd)` so the sum never touches the table |
| Prices (`gateway.go:104-112`) | 2 per target (price, base URL) | Cache prices with the provider (30 s): −2 or more |
| Budget reservation (`store/inflight.go:37`) | 1, sums the month again | Covered by the index above |
| After the answer: usage row, session cost, release reservation, record reply, release slots | 5–6 | Batch the release and usage write in one transaction: −2 |

Expected result: about 18–20 → 10–11 statements, and about 12 → 6 before the first token.

Other paths:

- **Transcript save:** ownership loads the full row with transcript, judgement and evaluation (`session_service.go:80-100`); the voice flag is read twice (`session_service.go:85` and `verification.go:124`); the save is a four-step transaction (see C3). Reuse `d.Voice`, single-statement save: −4.
- **Login:** about 12 statements, 9 of them writes: three rate-limit hits each preceded by a `DELETE` (`store/rate_limits.go:23`), then session insert, login time, purge of expired sessions (`auth_service.go:155-156`). Move the three purges to the cron: −4. This matters when 40 students log in together.
- **Host screen polling:** `store/rooms.go:192-198` runs five sub-queries per guest. One grouped join gives the same columns.

Effort for E1: 1–1.5 days, each reduction its own commit with `TestResponseShapes` unchanged.

### E2. Cold start

`store/schema.go:298-312` runs the whole schema (about 40 statements, two of them `DROP INDEX`) and three probe queries each time an instance starts. Store a schema version in `settings`; when it matches, skip everything after one read. Effort: 2 h.

### E3. Indexes

| Index | Why |
|---|---|
| `usage_log(created_at, cost_usd)` | Month sums on every paid call (E1) |
| `live_grants(session_id)` | `UsedBySession` scans the table on every session load and save |
| `activity_sessions(class_id)` | Imported work is read by class |
| `invites(class_id)`, `invites(invited_by)` | Class page and teacher invite list |

All are `CREATE INDEX IF NOT EXISTS`, no data change. Effort: 1 h plus a query-plan check.

### E4. Quadratic judge trimming

Part of C4 (`app/judge.go:129-133`).

### E5. Provider cache lock

`gateway.go:68-95` holds the mutex during the database read and key decryption; while one request refreshes, all others wait. Read outside the lock, store under it. Low priority. Effort: 1 h.

### E6. Later, not now

The transcript is rewritten in full at every turn and its AI lines are stored a second time in `ai_replies`. An append-only messages table would remove both, but it is a schema change with a migration: only worth it if measured saves become slow.

---

## 5. Efficiency and size — frontend

Current build output in `dist/assets`: main chunk 726 kB (budget 750 kB), `AdminPage` 420 kB, `MarkdownViewer` 144 kB, total 3.1 MB.

| # | Item | Evidence | Action |
|---|---|---|---|
| F1 | A second toast system is mounted but never used | `src/App.tsx:68` mounts `Toaster`; no file calls `useToast`; all 27 callers use `sonner` | Remove `components/ui/toaster.tsx`, `toast.tsx`, `use-toast.ts`, `hooks/use-toast.ts` (about 350 lines) and `@radix-ui/react-toast`. This one is in the main chunk. |
| F2 | Dependencies with no import in `src` | `@hookform/resolvers`, `zod`, `file-saver`, `@types/file-saver`, `html2canvas`, `date-fns` (zero imports each) | Remove; check `scripts/` first. `date-fns` goes only together with `calendar.tsx` (peer of `react-day-picker`). |
| F3 | 21 UI kit files imported by nothing, 2,958 lines | `sidebar` 761, `chart` 363, `carousel` 260, `menubar` 234, `context-menu` 198, `form` 176, `navigation-menu` 128, `table` 117, `pagination` 117, `drawer` 116, `breadcrumb` 115, `input-otp` 69, `calendar` 64, `alert` 59, `avatar` 48, `scroll-area` 46, `resizable` 43, `hover-card` 27, `collapsible` 9, `aspect-ratio` 5, `use-toast` 3 | Delete, then remove their packages: `embla-carousel-react`, `vaul`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `react-hook-form`, and seven `@radix-ui/*` packages. Not in the bundle (tree-shaken), but less to install, audit and lint. |
| F4 | `AdminPage` chunk 420 kB | `recharts` is imported by `pages/admin/AdminCosts.tsx` | Load the costs tab lazily, so the other admin tabs open without the chart library. |

Check before deleting: `npx tsc -p tsconfig.app.json --noEmit`, `npm test`, `npm run build`, and compare chunk sizes before and after. Effort: 3–4 h for F1–F3, 1–2 h for F4.

---

## 6. Code reduction — server and repository

| # | Item | Evidence | Saving |
|---|---|---|---|
| R1 | One error-to-status table for handlers | `writeErr(w, 500, "internal", err.Error())` appears **53** times and the decode-or-400 block **36** times in `httpapi`; `writeRoomErr`, `writeServiceErr` and several `switch` blocks map errors separately | Two helpers (`decode(w, r, &in) bool`, `fail(w, err)`) and one table. About 150–200 lines, and M7 is fixed in one place. |
| R2 | Cookie code twice | `httpapi/auth.go:26-30` and `httpapi/rooms.go:54-60` | One `setSessionCookie(w, r, token, expires)` |
| R3 | "start session, reload user, answer" five times | `auth.go:94-96`, `144-149`, `246-251`, `298-303`, `335-336` | One `loginAndAnswer(w, r, id, status)` |
| R4 | Best attempt per student computed two ways | `store/activity_sessions.go:205-230` dedups in Go; `rankedSessions` at `:100` does it in SQL | Reuse `rankedSessions`: about 25 lines, less data read |
| R5 | Language names in two maps | `app/evaluation.go:127-133` and inline at `app/judge.go:326` | One map |
| R6 | "First message must be the user's" in three places | frontend `aiService.ts:119-121`, gateway `gateway.go:212-217`, Anthropic adapter (noted as open point in REFACTORING.md) | Keep the gateway's only |
| R7 | In-memory limiter shrinks after C6 | `httpapi/server.go:326-378` | `exhausted()` and `codeGuard` removed; remaining uses can move to the database limiter later |
| R8 | Stale checkouts and leftovers | Four worktrees under `.claude/worktrees/` (`p2`, `p6`, `sentry`, `t1110`) hold about 56,000 lines and cause the lint warnings noted in the handoff; `jules-scratch/` and `netlify.toml` are tracked but unused by the Vercel deployment | **Needs your confirmation** (deletion). `p6` and `t1110` are merged per the memory notes; `sentry` holds unmerged work (`feat/sentry-diagnostica`) and must stay until F1 is rebased. |

R1–R6 are pure refactorings and follow the rules of REFACTORING.md (tests green before and after, `TestResponseShapes` unchanged except the 500 message text of M7, which is a wanted change to record).

---

## 7. Proposed schedule

| Order | Item | Effort | Depends on |
|---|---|---|---|
| 1 | C1 mystery name matching | 3–4 h | — |
| 2 | C4 size limits and linear judge trimming | 4–6 h | — |
| 3 | C6 PIN and code limits on the database limiter | 3–4 h | — |
| 4 | C2 check production outbox, then send reset mails in the request | 2–3 h | Access to production data |
| 5 | C3 single-statement save and join, libSQL concurrency run | 0.5–1 day | Disposable libSQL (already planned in the handoff) |
| 6 | C5 first step (caps), then named jobs | 1–2 h, then 1 day | — |
| 7 | M1, M2, M5, M4 | 4–5 h | — |
| 8 | E1–E3 round trips, cold start, indexes | 1.5–2 days | After C3 (same code) |
| 9 | F1–F4 and R1–R6 | 1.5 days | — |
| 10 | M3, R8 | 2–3 h | Your decisions |

Items 1–6 should come before the classroom pilot planned for 13 November in the handoff; if time is short, 1, 2, 3 and the 15-minute check of item 4 are the minimum.

## 8. Decisions needed from you

1. **M3:** may a co-teacher delete the class and remove other teachers? May a class owner create teacher accounts by invitation?
2. **C5:** is the free prompt for guests' own evaluation still wanted, or can guests without an account lose the AI evaluation?
3. **R8:** delete the merged worktrees `p2`, `p6`, `t1110`, and the tracked `jules-scratch/` and `netlify.toml`?
4. **C2:** may I read `mail_outbox` timings in production (read-only) to confirm the delay?

## 9. Gate for every change

```sh
cd server && go vet ./... && go test -race ./...
cd .. && npm run lint && npm test && npx tsc -p tsconfig.app.json --noEmit && npm run check:i18n && npm run build
```

The 13 socket tests and the libSQL cases need a runner that allows listening sockets, as recorded in [TODO_2026-11-11.md](TODO_2026-11-11.md).
