# 12 November 2026: report on `docs/investigation 11 11.md`

All of the plan is done. It's 30 commits on a new local branch, `fix/investigation-2026-11-11`, made from where the repo was (`refactor/concurrent-settings-2026-11-11`, commit `cc34234`). The commits run from `d6f93b9` (C1) to `4f9b135`. **Update 12 November, 23:01 UTC: merged with PR #30 (merge `407ece1`) and live in production; smoke test 200.**

Before each commit the full set of checks passed: Go tests with the race detector, lint, TypeScript, the 398 frontend tests, the build and the translation check. Every behaviour change got a test that failed first, except a few where the new test couldn't compile before the code existed. Each commit has its row in `docs/REFACTORING.md` under "Fase 13" (prefix `I11-`).

## Critical fixes

- **C1:** the mystery game is no longer won by an ordinary word in the title ("great", "Inghilterra", "arco", "queen"). One shared list of cases (`server/internal/app/testdata/mystery_names.json`) is checked by both the server and the browser tests. "Vinci" still wins for Leonardo, as the plan required.
- **C4:** size limits on messages (32 kB), the saved conversation (400 kB, oldest messages dropped first), activity setup (16 kB) and the text sent to the evaluator (120 kB). The judge no longer slows down badly on huge conversations, and each user can start at most 200 attempts per day.
- **C6:** each room PIN or room-code attempt is now counted *before* it is checked, in the database, so all servers share the count. Before the fix, 50 parallel wrong PINs all reached the comparison. Correct codes are given back, so a class sharing one school network still gets in.
- **C2:** the password-reset mail is now sent during the request, and queued only if sending fails.
- **C3:** I reproduced the "database is locked" errors with four connections on one database: concurrent room joins failed, and only 4 of 21 saves landed. Saving a conversation is now a single statement, and joining a room writes first. The plan's retry helper turned out not to be needed.
- **C5:** first step only. `utility` requests are capped at 12,000 characters in and 4,096 tokens out; evaluations without an account at 60,000 characters. I used larger numbers than the plan (4,000 / 512 / 20,000) because those would have broken the real callers: voice casting, activity suggestions and guest evaluations.

## Medium fixes (M1–M9)

- **M1:** an admin changing a user's password now logs that user out everywhere.
- **M2:** the judge ignores the model's "completed" flag; only the goal scores end an activity.
- **M3:** only the class owner or an admin can delete a class or remove a teacher; the class page hides both buttons from co-teachers.
- **M4:** links in mails never come from the request's `Host` header. On Vercel the server now uses the address Vercel sets automatically if `PUBLIC_URL` is missing.
- **M5:** text cuts never split a letter like "è".
- **M6:** at most 100 addresses per class invitation. The mails are still sent during the request, not queued, so the page still knows which mails failed.
- **M7:** server errors no longer send database messages to the browser.
- **M8:** in-character lines like "Non posso continuare questa guerra" no longer count as the model refusing.
- **M9:** only one evaluation per attempt can run at a time.

## Speed and cleanup

- **E1–E3:**
  - Several database round trips are gone from each request: the login check is one query, expired rows are cleaned up once a minute instead of on every request, and prices and the budget state are cached briefly.
  - New servers skip the database setup when it hasn't changed.
  - New indexes, including one so the monthly spending total is read from the index alone.
  - Two E1 items skipped as not worth the risk: the host screen query, which is already one round trip, and merging the writes made after each answer.
- **F1–F4:**
  - Removed the unused second toast system: the main bundle went from 726 kB to 712 kB.
  - Removed 20 unused UI files and 20 packages nothing imports.
  - The admin page went from 420 kB to 45 kB by loading the costs chart only when its tab opens.
- **R1–R6:** shared helpers in the request handlers, best attempt per student computed in the database, a single list of language names, and the browser's duplicate "(start)" message removed.

## Decisions (closed 12 November)

- M3: keep owner/admin only.
- R8: done (worktrees, `jules-scratch/`, `netlify.toml` removed; branches kept).
- C5: guests keep the AI evaluation; named jobs deferred.
- C3: run green against a local libSQL server.
- C2: `CRON_SECRET` confirmed in Production. 13 November: production `mail_outbox` is empty (0 rows: nothing queued, so no send has failed since the 10 November wipe). Last step: a real password reset arriving within seconds.

## Original list (for reference)

1. **M3:** the plan's suggested rule is in place. Say so if co-teachers should keep those powers.
2. **R8:** nothing deleted. The worktrees under `.claude/worktrees/`, `jules-scratch/` and `netlify.toml` are still there.
3. **C2:** production not checked. Someone needs to look at the send times in `mail_outbox` and confirm `CRON_SECRET` is set.
4. **C5:** having the server write these prompts itself ("named jobs") isn't done; it depends on whether guests without an account keep their AI evaluation.
5. **C3:** the concurrency test still has to be run against a throwaway libSQL database (set `LIBSQL_TEST_URL`).

## Before deploying

Merging to `master` deploys to production, so nothing is pushed until it's approved. Browsers that still have an old page loaded get a "reload the page" error on chat requests until they refresh.
