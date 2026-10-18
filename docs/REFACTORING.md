# Refactoring: Clean Code + Design Pattern

Ultimo aggiornamento: 18 ottobre 2026 · Branch: `go`

Questo documento è il **punto di passaggio di consegne** tra agenti di coding (e persone).
Chi riprende il lavoro legge prima la sezione *Stato attuale*, poi esegue il primo task `[ ]` della fase in corso.

---

## Punti di ripristino

- Tag `pre-refactoring` (`e4c0fb9`) su GitHub: stato del codice prima di qualsiasi refactoring.
- Il branch `go` va pushato su `origin` alla fine di ogni fase.

---

## Regole per chi lavora qui

1. **Mai cambiare il comportamento.** Ogni task è un refactoring puro. Se serve una modifica funzionale, va annotata in *Note e decisioni* e fatta a parte.
2. **Prima i test, poi il refactoring.** Un'area non coperta da test si copre prima di toccarla (fase 0).
3. **Un task = un commit**, con il messaggio `refactor(<area>): <task id> <descrizione>`.
4. **Dopo ogni task** aggiorna questo file:
   - spunta il task (`[x]`) e scrivi accanto il commit breve;
   - aggiorna *Stato attuale*;
   - aggiungi una riga al *Registro*.
5. **Verifica prima di spuntare.** Comandi:
   - backend: `cd server && go vet ./... && go test ./...` (per codice concorrente anche `go test -race ./internal/...`)
   - frontend: `npm run lint && npm test && npm run build`
   - traduzioni: `npm run check:i18n`
   - contratto API: `TestResponseShapes` confronta la forma JSON di 27 risposte con `server/internal/app/testdata/shapes.json`. Se un cambio è voluto, rigenerare con `UPDATE_SHAPES=1 go test ./internal/app -run ResponseShapes` e spiegarlo nel Registro.
6. **Hash dei commit:** nei riepiloghi e nel Registro copiali sempre da `git log`, mai a memoria.
7. **Se ti fermi a metà**, lascia il task `[~]` e scrivi in *Stato attuale* cosa manca, quali file sono toccati e cosa non funziona.

Legenda: `[ ]` da fare · `[~]` in corso · `[x]` fatto · `[-]` scartato (spiegare perché)

---

## Stato attuale

- **Piano completato** (fasi 0-6) il 2026-10-18 sul branch `go`.
- **Lavoro a metà:** nessuno
- **Test:** Go (pacchetti `ai`, `app`, `domain`, `httpapi`, `store`) verdi anche con `-race`; Vitest 43 test verdi; lint 0 errori (16 avvisi `react-refresh/only-export-components` preesistenti, soprattutto in `src/components/ui` e `pages/dashboard/common.tsx`).
- **Punti aperti (non refactoring, da decidere):**
  1. Contenuti dei tutorial: 30 testi di ImpersonaTu mostrano la chiave; DoppiaIntervista ha slide diverse tra le lingue (vedi Note).
  2. `isCorrectGuess` troppo permissivo con tentativi cortissimi (vedi Note).
  3. Avvisi `react-refresh` rimasti: spostare le funzioni condivise (`formatDate`, `usd`, `copy`, ...) da file di componenti a moduli separati.
  4. Pagine non toccate dal piano e ancora con chiamate `api` dirette: `StudentDashboard`, `SessionDetailPage`, `AssignmentForm`, `InviteForm`, `AuthPages` (stesso schema del 6.2/6.3 se si vuole uniformare).

---

## Principi di riferimento

**Clean Code (Robert C. Martin)**
- Nomi che rivelano l'intenzione, niente numeri magici.
- Funzioni piccole che fanno una cosa sola, a un solo livello di astrazione.
- Nessun errore ignorato in silenzio.
- DRY.
- SOLID: SRP, OCP, LSP, ISP, DIP.
- Boy Scout Rule.
- Test come rete di sicurezza.

**Head First Design Patterns (Eric Freeman, Elisabeth Robson)**
1. Incapsula ciò che varia.
2. Programma verso un'interfaccia.
3. Composizione invece di ereditarietà.
4. Accoppiamento debole.
5. Aperto all'estensione, chiuso alla modifica.
6. Dipendi da astrazioni.
7. Least Knowledge: parla solo con gli amici.
8. Hollywood Principle: "ti chiamiamo noi".
9. Una classe, un motivo per cambiare.

---

## Diagnosi (stato di partenza)

### Backend Go (`server/internal`)

| Problema | Dove | Principio |
|---|---|---|
| `Server` è un God Object: circa 60 handler più config, cache dei provider e rate limiter | `app/server.go`, tutto `app/` | SRP, Least Knowledge |
| 102 chiamate SQL dentro gli handler HTTP | `app/assignments.go`, `app/admin.go`, `app/classes.go` | SRP, DIP |
| Errori ignorati (`_, _ = s.db.Exec(...)`) | `app/assignments.go`, `app/admin.go`, … | Gestione errori |
| `handleSaveTranscript` (85 righe) fa 6 cose | `app/assignments.go` | Funzioni piccole |
| Ciclo "target → log uso → fallback" duplicato | `app/gateway.go` (`generate`), `app/judge.go` (`judge`) | DRY |
| Strategia di routing scelta con `switch` su stringa | `app/gateway.go` (`targets`) | OCP |
| `autoRoute` è uno `switch` per tipo di provider | `app/admin.go` | OCP |
| Jev implementa `Generate`/`Stream` solo per restituire `ErrUnsupported` | `ai/jev.go` | ISP, LSP |
| Risposte costruite con `map[string]any` | vari handler | Tipi espliciti |
| Numeri magici (90s, 60s, 1000, 2000, 0.7) | sparsi | Clean Code |

### Frontend React (`src/`)

| Problema | Dove | Principio |
|---|---|---|
| Le 6 pagine attività ripetono setup → chat → riflessione → feedback | `src/pages/*Page.tsx` | DRY, Hollywood |
| 5 tutorial quasi identici (220-233 righe ciascuno) | `src/components/tutorials/` | DRY |
| Circa 2.100 righe di debug i18n non importate da nessuna pagina | `src/utils/i18nDebugger.ts`, `visualErrorDetector.ts`, `i18nAnalyzer.ts`, `src/components/debug/*`, `src/hooks/useTranslationWithDebug.tsx` | YAGNI |
| Pagine da oltre 400 righe che mescolano dati e UI | `src/pages/admin/AdminAI.tsx`, `AdminPage.tsx`, `src/pages/dashboard/TeacherPages.tsx` | SRP |
| Nessun test frontend | — | Rete di sicurezza |

---

## Architettura obiettivo

### Backend

Struttura reale a fine fase 4 (diversa dal piano iniziale: `service/` e `notify/` sono confluiti in `app/`, che è il livello applicativo).

```
server/
  main.go          composition root: config → store.Open → app.NewServices → Bootstrap → httpapi.NewServer
  internal/
    ai/            adapter dei provider (Gemini, OpenAI-compatibili, Anthropic, Jev), decorator, registry
    domain/        entità (User, Class, Assignment, Session, Invite, Provider, ...), State della sessione
    store/         repository SQLite + schema (unico posto con SQL)
    app/           livello applicativo: Services, authService, classService, assignmentService,
                   sessionService, settingsService, aiGateway (routing, fallback, metering, judge),
                   smtpMailer, mailNotifier (Observer); interfacce dei repository in repositories.go
    httpapi/       Server (router, middleware, rate limit), handler, DTO; parla solo con app.Services
```

| Pattern | Applicazione |
|---|---|
| Strategy | `RoutingStrategy` (`FreeFirst`, `Cheapest`, `AsConfigured`); `Judge` (`JevJudge`, `LLMJudge`) |
| Interface Segregation | `Generator`, `Streamer`, `ModelLister`, `Decider` al posto di un unico `Provider` |
| Decorator | `UsageLoggingProvider`, `FirstTokenTimeoutProvider`; filtro budget sopra la strategia |
| Chain of Responsibility | `FallbackChain` unica per chat, valutazione e giudice |
| Factory + registry | `registry[kind]` con factory e `DefaultRoutePolicy`; sostituisce `ai.New` e `autoRoute` |
| Repository | `UserRepo`, `ClassRepo`, `AssignmentRepo`, `SessionRepo`, `SettingsRepo`, `UsageRepo` |
| Service Layer / Facade | es. `SessionService.SaveTranscript` restituisce un risultato tipizzato |
| State | stato della sessione: `active → goal_reached / turn_limit / completed` |
| Observer | evento `AssignmentCreated` → `MailNotifier` |
| Dependency Injection | `main.go` costruisce tutto e lo passa ai costruttori |

### Frontend

| Pattern | Applicazione |
|---|---|
| Template Method (via composizione) | hook `useActivityFlow` (fasi, sessione, engine, valutazione) + `<ActivityRunner>` che disegna i 4 step; la pagina passa solo setup, chat e testi |
| Data-driven | tutorial come array di step + `TutorialRenderer` |
| Adapter / Facade | `AiClient` sopra `aiService` e `liveConversationService` |
| Container / Presentational | hook dati (`useProviders`, `useUsageSummary`, …) separati dai componenti visuali |

---

## Piano e avanzamento

### Fase 0: rete di sicurezza

- [x] **0.1** (`2aae325`) Test del gateway `generate`: fallback su errore ritentabile, stop su errore non ritentabile, timeout del primo token, salto di Jev, budget esaurito.
- [x] **0.2** (`b3d71ec`) Test del giudice: `finalize` (soglia, `minTurns`, progress) e `judge` con provider finti (Jev e LLM).
- [x] **0.3** (`bc8e02f`) Test HTTP di `handleSaveTranscript`: conteggio turni, `EvaluateEvery`, `AutoEnd`, `MaxTurns`, risposta JSON (snapshot delle chiavi).
- [x] **0.4** (`eb85be2`) Aggiungere Vitest al frontend, con test di `useActivitySession` e `useChatEngine` su un client AI finto.
- [x] **0.5** (`c1b591b`) CI: `go vet`, `go test`, `npm run lint`, `vitest` in `.github/workflows`.

### Fase 1: interventi veloci

- [x] **1.1** (`585116c`) Rimuovere il codice morto del debug i18n (verificare prima con grep che nulla lo importi).
- [x] **1.2** (`999aa75`) Gestire gli errori oggi ignorati (`_, _ =`): restituirli o loggarli con contesto.
- [x] **1.3** (`923bd09`) Sostituire i numeri magici con costanti nominate.
- [x] **1.4** (`4a1c582`, `a625ad9`) DTO tipizzati al posto di `map[string]any` nelle risposte (stesso JSON).

### Fase 2: livello AI (backend)

- [x] **2.1** (`f83dfc5`) Separare le interfacce (`Generator`, `Streamer`, `ModelLister`, `Decider`); rimuovere gli stub `ErrUnsupported` di Jev.
- [x] **2.2** (`bc06137`) Decorator per log dell'uso e timeout del primo token.
- [x] **2.3** (`4343cf9`) `FallbackChain` unica, usata da `generate` e da `judge`.
- [x] **2.4** (`45ea18c`) `RoutingStrategy` e filtro budget.
- [x] **2.5** (`be3d935`) Registro dei provider con `DefaultRoutePolicy` per tipo (sostituisce lo `switch` di `autoRoute`).
- [x] **2.6** (`07d78a1`) `Judge` come Strategy (`JevJudge`, `LLMJudge`).

### Fase 3: repository (backend)

Un'area per task, spostando l'SQL in `internal/store`:

- [x] **3.1** (`5e7cc2b`) settings
- [x] **3.2** (`8403969`) users e invites
- [x] **3.3** (`2a5f8ca`) classes
- [x] **3.4** (`6dd6bca`) assignments
- [x] **3.5** (`0f55532`) sessions
- [x] **3.6** (`d44f124`) usage, prices e providers

### Fase 4: service, State, Observer (backend)

- [x] **4.1** (`07e38cf`) `SessionService` con macchina a stati della sessione; `handleSaveTranscript` sotto le 20 righe.
- [x] **4.2** Service per auth, classes e assignments con handler sottili (lo spostamento in `httpapi/` passa al 4.4, quando `Server` diventa solo router).
  - [x] **4.2a** (`08ed03b`) `authService`
  - [x] **4.2b** (`a07cc6a`) `classService`
  - [x] **4.2c** (`a11df2e`) `assignmentService` (+ `sessionService.Start/Load/Complete`)
- [x] **4.3** (`ec6a61d`) Observer per le notifiche mail.
- [x] **4.4** `main.go` come composition root; `Server` ridotto a router e middleware; handler spostati in `httpapi/`.
  - [x] **4.4a** (`795d8e0`) `settingsService`
  - [x] **4.4b** (`58d1b40`) `aiGateway` (provider, prezzi, budget, routing, generate, judge fuori da `Server`)
  - [x] **4.4c** (`c924d7c`) composition root: `app.NewServices` costruito da `main.go`
  - [x] **4.4d** (`d9ca955`, `b00ca5a`) handler HTTP nel pacchetto `httpapi`

### Fase 5: attività (frontend)

- [x] **5.1** (`2381ff4`) `useActivityFlow` + `ActivityRunner`; migrata ConvinciTu.
- [x] **5.2** (`b708914`) Migrare ImpersonaTu e WikiChatbot.
- [x] **5.3** (`7d1e0f4`) Migrare DoppiaIntervista, PersonaggioMisterioso e YouModerate.
- [x] **5.4** (`cb060a2`) `AiClient` (Adapter) usato dagli hook.

### Fase 6: resto del frontend

- [x] **6.1** (`6bc9dbf`) Tutorial guidati dai dati + `TutorialSlides`.
- [x] **6.2** (`1fca02f`) Dividere `AdminAI.tsx` e `AdminPage.tsx` in hook dati e componenti.
- [x] **6.3** (`b1cdc25`) Dividere `TeacherPages.tsx`.

---

## Note e decisioni

- Schema della fase 3: il repository vive in `server/internal/store` (tipo concreto, es. `store.Settings`), mentre l'interfaccia la definisce chi la usa in `app` (es. `settingsStore` in `settings.go`). `Server` ha un campo per repository, inizializzato in `NewServer` (spostato in `main.go` al task 4.4). Ogni repository ha i suoi test in `store` con un DB temporaneo.
- Entità condivise in `server/internal/domain` (`User`, `Invite`, `UserPatch`, ruoli, `Now`/`ParseTime`). In `app/repositories.go` ci sono le interfacce dei repository e gli alias temporanei (`User`, `inviteRow`, `Class`, `Member`, `Assignment`, `AssignStats`, `SessionSummary`, `SessionDetail`), da rimuovere quando gli handler useranno direttamente `domain` (fase 4). Lo schema SQL e `Open` sono in `store/schema.go`.
- Possibile miglioramento (non fatto, cambierebbe il comportamento): `isCorrectGuess` del personaggio misterioso accetta anche tentativi cortissimi contenuti nel nome (es. "Da" per "Leonardo da Vinci"); fissato da `mystery.test.ts`.
- **Gap di contenuto noto (tutorial ImpersonaTu):** il codice usa gli id di slide `thinkAloud`, `reflectionAndGrowth`, `examples` (e i punti elenco di altre 3 slide) che nei file `src/i18n/tutorials/*.json` hanno nomi diversi (`thinkAloudProtocols`, `reflectionGrowth`, `implementationExamples`, ...): 30 testi mostrano la chiave in tutte le lingue. Inoltre DoppiaIntervista in en/fr/es ha un set di slide diverso (ricade sull'italiano). Correggerli è lavoro sui contenuti; `tutorials.test.tsx` conta i 30 testi mancanti e fallirà (in meglio) quando verranno sistemati.
- Go non ha ereditarietà: Template Method si realizza con funzioni o interfacce passate come parametro (composizione).
- L'API HTTP e lo schema SQLite non cambiano durante il refactoring.
- Task 1.2: unica eccezione voluta alla regola "nessun cambio di comportamento". Solo quando una scrittura sul DB fallisce: le scritture principali rispondono 500 invece di un falso OK, quelle di contorno (ultimo login, pulizia sessioni, costi, prezzi importati, `email_sent`) vengono loggate con `execOrLog`, e gli handler con più update usano `sqlBatch`. Restano volutamente le letture `_ = ...QueryRow(...).Scan(...)` che hanno un valore di default sensato (nome classe, somme dei costi): verranno riviste nei repository (fase 3).
- La risposta di `PUT /api/sessions/{id}/transcript` ha tre forme diverse (sessione libera o già chiusa: `ended,progress,status,turns`; compito attivo: in più `jev,maxTurns,reason`). È fissata da `TestSaveTranscript*`: il DTO del task 1.4 deve mantenerla, usando `omitempty` dove serve.

---

## Registro

| Data | Task | Commit | Chi | Note |
|---|---|---|---|---|
| 2026-10-18 | — | `fb57987` | Claude Code | Creato il documento. Go test verdi. |
| 2026-10-18 | 0.1 | `2aae325` | Claude Code | `server/internal/app/gateway_test.go`: 11 test. Helper riusabili: `newTestServer`, `useProvider` (inietta un provider finto nella cache), `setChatRoute`, `fakeProvider`. |
| 2026-10-18 | 0.2 | `b3d71ec` | Claude Code | `server/internal/app/judge_test.go`: 10 test (Jev, LLM, fallback, soglia, `minTurns`). Fake: `fakeDecider`, `scriptedLLM`, helper `setJudgeRoute`. |
| 2026-10-18 | 0.3 | `bc8e02f` | Claude Code | `server/internal/app/transcript_test.go`: 11 test HTTP (forma della risposta, turni, `autoEnd`, `maxTurns`, `evaluateEvery`, flag `judge`, contesto, troncamento a 1000, solo proprietario). Fixture: `newTranscriptFixture`. |
| 2026-10-18 | 0.4 | `eb85be2` | Claude Code | Vitest 2.1.9 + jsdom + Testing Library; `vitest.config.ts`, script `npm test`. Test in `src/features/activity/*.test.tsx` (18): API, auth, `useLiveAi`, `aiService` sostituiti con `vi.mock`. |
| 2026-10-18 | 0.5 | `c1b591b` | Claude Code | `.github/workflows/docker.yml`: `go vet` nel job `test`, nuovo job `web` (lint, i18n, Vitest, Node 22 come nel Dockerfile); `image` dipende da entrambi. Non ancora verificato su GitHub (nessun push). |
| 2026-10-18 | — | — | Claude Code | Push di `go` su GitHub e tag `pre-refactoring`. |
| 2026-10-18 | 1.1 | `585116c` | Claude Code | Rimossi 7 file, 2.441 righe: `src/utils/i18nDebugger.ts`, `visualErrorDetector.ts`, `i18nAnalyzer.ts`, `src/components/debug/*`, `src/hooks/useTranslationWithDebug.tsx`. |
| 2026-10-18 | 1.2 | `999aa75` | Claude Code | Helper `execOrLog` e `sqlBatch` in `server/internal/app/db.go`. Corretti due bug: reset password (link riutilizzabile se l'update falliva) e forgot (mail con token non salvato). |
| 2026-10-18 | 1.3 | `923bd09` | Claude Code | Nuovo `server/internal/app/limits.go` con limiti, timeout e soglie (valori invariati). Restano inline i `LIMIT` delle query di lista (verranno spostati nei repository, fase 3). Le costanti del frontend vengono rivedute nella fase 5. |
| 2026-10-18 | 1.4 | `4a1c582`, `a625ad9` | Claude Code | Test golden `TestResponseShapes` (prima del refactoring), poi `server/internal/app/dto.go` con tutti i corpi delle risposte; `writeOK` per `{"ok":true}`. Forma JSON invariata. Restano mappe solo nello *state* inviato a Jev (`jevState`, test del provider), che è un input del modello e non una risposta API. |
| 2026-10-18 | 2.1 | `f83dfc5` | Claude Code | `server/internal/ai/types.go`: `ModelLister`, `Generator`, `Streamer`, `TextModel`; `Provider` = solo `ModelLister`. Gateway, giudice e test provider usano type assertion sulla capacità. Rimosso `ErrUnsupported`. Test `TestProviderCapabilities`. I fake dei test ora rispecchiano le capacità reali (`fakeDecider` non ha più `Generate`). |
| 2026-10-18 | 2.2 | `bc06137` | Claude Code | `server/internal/ai/decorators.go` (`WithFirstTokenTimeout`, `ErrFirstTokenTimeout`) e `server/internal/app/metering.go` (`meterText`, `meterDecider`). Usati in `generate` e nel test dei provider. Il giudice registra ancora l'uso a mano: lì un JSON non valido conta come chiamata fallita, quindi si sistema con la `FallbackChain` (2.3). Piccola differenza: il test di un provider Jev fallito ora salva anche il messaggio d'errore nel log. `go test -race` verde. |
| 2026-10-18 | 2.3 | `4343cf9` | Claude Code | `server/internal/app/fallback.go`: `runFallbackChain` + `errSkipTarget` + `stopFallback`; `recordUsage` in `metering.go`. `generate` e `judge` non hanno più il ciclo a mano. Differenze minime: `jev.error` ora ha il prefisso `provider/modello:` come la chat; un provider che non sa giudicare viene saltato senza scrivere nel log invece di contare come errore. |
| 2026-10-18 | 2.4 | `45ea18c` | Claude Code | `server/internal/app/routing.go`: interfaccia `routingStrategy` (`asConfigured`, `freeFirst`, `cheapest`) registrata in `routingStrategies`, Decorator `freeOnly` per il budget, interfaccia `priceBook` (la implementa `Server`). `targets()` spostato qui. Nuova strategia = nuovo tipo + una riga nella mappa. |
| 2026-10-18 | 2.5 | `be3d935` | Claude Code | `ai.New` usa la mappa `factories` e `ai.KnownKind` sostituisce `validKind`. `server/internal/app/route_policies.go`: `routePolicy` per tipo (`jevRoutes`, `geminiRoutes`, `firstModelRoutes`) in `defaultRoutes`; `autoRoute`, `newestFlash`, `pickModel` e `geminiVersion` spostati lì. Nuovo tipo di provider = adapter + factory + (opzionale) policy. Test `TestDefaultRoutePolicies`. |
| 2026-10-18 | 2.6 | `07d78a1` | Claude Code | `judge.go`: interfaccia `goalJudge`, `jevJudge` (Decider) e `llmJudge` (Generator), scelta con `judgeFor`. Ogni motore costruisce il proprio state (`jevState` / `buildState`). `finalize` resta una funzione pura. Fase 2 completata, push su GitHub. |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `938e472` (fine fase 2: `test`, `web`, `image`). Corretti in chat gli hash della fase 2, riportati a memoria in modo sbagliato; quelli in questo documento erano già giusti. Aggiunta la regola 6. |
| 2026-10-18 | 3.1 | `5e7cc2b` | Claude Code | `server/internal/store/settings.go` (`Load`/`Save`) + test; in `app` interfaccia `settingsStore` e helper `loadSetting[T]`; rimossi `getSetting`/`putSetting`. I test usano `s.settings.Save`. |
| 2026-10-18 | 3.2 | `8403969` | Claude Code | `store.Users`, `store.AuthSessions`, `store.Invites` (+ test sullo schema vero) e pacchetto `domain`. `app` non contiene più SQL su users, auth_sessions e invites; restano gli inserimenti in `class_members` e le letture del nome classe (task 3.3) e i conteggi su `usage_log` della lista utenti (3.6). `Users.Update` usa una transazione; `domain.Invite.Usable` contiene la regola "non usato e non scaduto". Nuove costanti `maxListedUsers`, `maxListedInvites`, `maxListedTeacherInvites`. |
| 2026-10-18 | 3.3 | `2a5f8ca` | Claude Code | `store.Classes` (classi + membri) + test; `domain.Class`, `Member`, `ClassPatch`, `NewJoinCode`, `NormalizeJoinCode`. `app` non tocca più `classes` e `class_members`, salvo la sottoquery nell'elenco compiti dello studente (passa al 3.4). La creazione della classe e l'iscrizione del proprietario come docente ora sono un'unica transazione. |
| 2026-10-18 | 3.4 | `6dd6bca` | Claude Code | `store.Assignments` + test; `domain.Assignment`, `NewAssignment`, `AssignmentPatch`, `AppTypes`, `CleanGoals`, `MaxAssignmentGoals` e (anticipati, perché `Assignment` li usa) `SessionSummary`/`SessionDetail` con le costanti di stato in `domain/session.go`. Update in transazione. Helper `valueOr[T]`. |
| 2026-10-18 | 3.5 | `0f55532` | Claude Code | `store.ActivitySessions` + test; `domain.NewSession`, `SessionCompletion`, `ProgressCell` e costanti di stato. Transcript e contesto salvati in un'unica transazione. Formattato `domain/session.go` (era sfuggito nel 3.4). Costante `maxListedSessions`. |
| 2026-10-18 | 3.6 | `d44f124` | Claude Code | `store.Providers`, `store.Prices`, `store.Usage` + test; `domain.Provider`, `ProviderPatch`, `ModelPrice`, `UsageRecord`, `UsageLogRow`, `UsageAggregate`, `UsageGrouping`. Esteso ai provider, che non erano nel piano originale. **`app` non contiene più SQL**: `Server` ha un repository per tabella e nessun `*sql.DB`. Rimossi `sqlBatch`, `execOrLog`, `countRows`, `boolInt`. Nota: nel report costi le chiamate degli ospiti hanno chiave `0` ed etichetta vuota (comportamento preesistente, ora fissato da un test). Fase 3 completata. |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `ee90557` (fine fase 3: `test`, `web`, `image`). |
| 2026-10-18 | 4.1 | `07e38cf` | Claude Code | `server/internal/domain/session_state.go` (State: `activeState`, `endedState`, `StateOf`, `TurnOutcome`) + test della tabella delle transizioni. `server/internal/app/session_service.go`: `sessionService.SaveTranscript` con `shouldJudge`, `evaluate`, `lastMessages`, `countStudentTurns`; dipende da `sessionStore`, `assignmentStore` e dall'interfaccia `goalEvaluator` (oggi implementata da `Server.judge`). `handleSaveTranscript` = 19 righe. Il service è costruito in `NewServer` (dal 4.4c in `NewServices`). |
| 2026-10-18 | 4.2a | `08ed03b` | Claude Code | `server/internal/app/auth_service.go`: `CreateUser`, `SetPassword`, `StartSession`, `UserForToken`, `Logout`, `Login`, `UpdateProfile`, `FindInvite`, `Register`, `RequestReset`, `ResetPassword`, `CreateInvite`. Errori tipizzati (`errInvalidCredentials`, `errAccountDisabled`, `errWrongPassword`, `errInvalidInvite`, `errUserNotFound`) e `invalid(err)` per gli input non validi; `writeServiceErr` risponde 400 o 500. Interfaccia `mailer`. Campo `Server.accounts` (il nome `auth` era già del middleware). Nuovi test in `auth_service_test.go`. Differenza: un errore del DB in creazione utente ora dà 500 invece di 400. |
| 2026-10-18 | 4.2b | `a07cc6a` | Claude Code | `server/internal/app/class_service.go`: `CanManage`, `List`, `Create`, `Update`, `RegenerateCode`, `Invite` (+ `addExisting`), `Join`, `Joined`, `splitEmails`; errori `errBadMemberRole`, `errOnlyOwner`, `errInvalidCode`. Helper `managedClass` per il controllo 403 ripetuto in 6 handler. Test in `class_service_test.go`. |
| 2026-10-18 | 4.2c | `a11df2e` | Claude Code | `server/internal/app/assignment_service.go`: `Managed`, `Visible`, `ListForClass`, `ListForStudent`, `Create`, `Update`, `Progress`, `notifyStudents` (da trasformare in Observer nel 4.3), `dueText`. `sessionService` ora ha anche `Start`, `Load` (regole di accesso) e `Complete`; handler delle sessioni spostati in `sessions.go` con helper `ownSession`; helper `managedAssignment`. Rimossi `getAssignment`, `appTypes`, `canManageClass`, `isClassMember`, `latestSession`, `bestSession`. Test in `assignment_service_test.go`. |
| 2026-10-18 | 4.3 | `ec6a61d` | Claude Code | `server/internal/app/notify.go`: interfaccia `assignmentListener` (`AssignmentPublished`), `mailNotifier` e `dueText`. `assignmentService` ha `listeners` e non conosce più mail o SMTP. L'evento parte solo se il docente ha chiesto la notifica e il compito diventa pubblicato (come prima). Le altre mail (benvenuto, invito, aggiunta alla classe) restano dentro i flussi di `authService`/`classService`, perché il risultato dell'invio serve alla risposta. Test in `notify_test.go`. |
| 2026-10-18 | 4.4a | `795d8e0` | Claude Code | `settingsService` in `settings.go`: `General`, `Budget`, `Routing`, `Jev`, `SMTP`, `MailConfigured`, `Save*` con le regole di normalizzazione (prima nell'handler). Costanti delle chiavi (`settingGeneral`, ...). Campo `Server.settingsSvc`; rimossi i metodi `Server.general/budget/routing/jevSettings/smtp`. |
| 2026-10-18 | 4.4b | `58d1b40` | Claude Code | `aiGateway` (in `gateway.go`, costruttore `newAIGateway`) con 16 metodi spostati da `Server`: cache dei provider, `priceFor`, `monthSpend`, `budgetExceeded`, `logUsage`, `recordUsage`, `meterText`, `meterDecider`, `runFallbackChain`, `targets`, `generate`, `judge`, `autoRoute`, `storeModels`, `insertProvider`, `invalidateProvider`. `aiGateway` implementa `priceBook` e `goalEvaluator`. I test usano `s.gateway.*`. Race detector verde. |
| 2026-10-18 | 4.4c | `c924d7c` | Claude Code | `server/internal/app/services.go`: struct `Services` (repository e service con campi esportati) e `NewServices(cfg, db)`; `Bootstrap(cfg)` spostato lì e chiamato da `main.go`. `Server` = `cfg` + `*Services` incorporato + `static` + `limiter`. `smtpMailer` in `mail.go` sostituisce `Server` come mailer. Campi rinominati (`s.users` → `s.Users`, `s.settingsSvc` → `s.Settings`, `s.gateway` → `s.Gateway`, ...). Avviato il binario vero: health e public config ok, admin creato dal bootstrap. |
| 2026-10-18 | 4.4d | `d9ca955`, `b00ca5a` | Claude Code | (1/2) `gateway_admin.go`: `AddProvider`, `UpdateProvider`, `DeleteProvider`, `RefreshModels`, `TestProvider`, `LiveToken`, `RecordLiveUsage`, `ProviderView`; il bootstrap usa `AddProvider`. (2/2) Nuovo pacchetto `server/internal/httpapi` (server, middleware, handler, DTO, limiti HTTP); `app` esporta service, errori (`ErrX`) e input. Opzione `app.WithProviderFactory` (DI della factory dei provider) usata dai test HTTP per i modelli finti. Rimossi gli alias temporanei: si usano i tipi di `domain`. Test spostati senza perderne nessuno (55 prima, 55 dopo); `TestResponseShapes` e il suo golden ora in `httpapi`. `httpapi` non importa `store` né `database/sql`. Verificato con il binario vero (login, overview admin). **Fase 4 completata: il backend è finito.** |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `9c73d83` (fine fase 4: `test`, `web`, `image`). |
| 2026-10-18 | 5.1 | `2381ff4` | Claude Code | `src/features/activity/useActivityFlow.ts` (`begin`, `finishChat`, `submitReflection`, `restart`, `preset`, `minTurns`; `live(phase, assignment)`) e `components/ActivityRunner.tsx` (props `setup`, `chat` con `ready`/`replacement`, `reflection` con `brief`/`showEndReason`, `feedback`). Al posto di un oggetto `ActivityDefinition` statico si usa la composizione hook + componente, più naturale in React perché le parti variabili dipendono dallo stato della pagina. ConvinciTu: da 157 a 103 righe. Attenzione: la callback `live` riceve l'assignment, così il prompt si costruisce con una funzione (una costante dichiarata dopo l'hook darebbe un ReferenceError a runtime). Test: `useActivityFlow.test.tsx` (5) e `pages/ConvinciTuPage.test.tsx` (render della pagina vera fino alla chat). |
| 2026-10-18 | 5.2 | `b708914` | Claude Code | ImpersonaTu da 161 a 111 righe, WikiChatbot da 135 a 82. I test delle pagine sono ora in `src/pages/activityPages.test.tsx` (mock condivisi, `cleanup` esplicito perché Vitest gira senza globals). Vitest: 26 test. |
| 2026-10-18 | 5.3 | `7d1e0f4` | Claude Code | DoppiaIntervista 175 → 129 righe, YouModerate 214 → 166, PersonaggioMisterioso 268 → 215 (+ `src/features/activity/mystery.ts` con `isCorrectGuess` e `RANDOM_CHARACTERS`, test `mystery.test.ts`). Il personaggio misterioso usa `chat.replacement` per il tentativo finale, `onEnded` personalizzato e `showEndReason: false`. Le sei pagine attività ora usano tutte `ActivityRunner`. Test delle pagine estesi alle tre app (stub di `ResizeObserver` per lo slider Radix). Vitest: 31 test; lint 17 avvisi (uno in meno). |
| 2026-10-18 | 5.4 | `cb060a2` | Claude Code | `src/services/aiClient.ts` (interfaccia `AiClient`, `httpAiClient`, `AiClientContext`, `useAiClient`) e `src/services/AiClientProvider.tsx`. Usato da `useChatEngine`, `useEvaluationFlow` (che lo passa a `evaluateActivity`) e `ActivityShell`; il default è il client HTTP, quindi l'app non ha bisogno del provider. I test iniettano un client finto invece di `vi.mock` sul modulo. Il Live vocale (`liveConversationService`, WebSocket diretto a Google) resta fuori dall'interfaccia. Fase 5 completata. |
| 2026-10-18 | 6.1 | `6bc9dbf` | Claude Code | `src/features/tutorials/tutorials.ts` (dati: `ns`, slide con icona e numero di punti), `TutorialSlides.tsx`, `src/pages/TutorialPage.tsx` (una pagina per tutte le rotte `/apps/*/tutorial`). Rimossi 5 componenti + 5 pagine (−1197/+252 righe). Scelto il layout dei 4 tutorial uguali: ImpersonaTu perde la barra di avanzamento e il titolo "Slide N". Bug corretti: i pulsanti Indietro/Avanti mostravano l'italiano in tutte le lingue (chiavi assenti nel namespace `tutorial`, fallback a it); il pulsante finale ricaricava la pagina con `window.location`, ora usa il router. Test `tutorials.test.tsx`: copertura delle traduzioni (con gap noto, vedi Note) e navigazione fino all'avvio dell'app. |
| 2026-10-18 | 6.2 | `1fca02f` | Claude Code | Livello dati `src/features/admin/adminApi.ts` (overview, utenti, inviti, classi, settings, costi) e `aiAdminApi.ts` (provider, routing, JEV, prezzi; tipo `ModelInfo` spostato qui da `ModelPicker`), dati statici in `aiPresets.ts`. `AdminPage.tsx` 419 → 37 righe (schede in `pages/admin/tabs/`), `AdminAI.tsx` 425 → 42 (componenti in `pages/admin/ai/`). Nessun componente admin chiama più `api` o `useQuery` direttamente. Test `AdminPage.test.tsx`: render delle 7 schede su risposte API finte. Vitest 40 test, lint 16 avvisi. |
| 2026-10-18 | 6.3 | `b1cdc25` | Claude Code | `src/features/teacher/teacherApi.ts` (`useMyClasses`, `useClass` con azioni che ricaricano la classe, `useAssignmentProgress`, `createClass`); `TeacherPages.tsx` (420 righe) diviso in `pages/dashboard/teacher/` (`TeacherDashboard`, `ClassPage` + `ClassAssignments`/`ClassMembers`/`ClassProgress`/`ClassSettings`, `AssignmentProgressPage`, `ClassCreateDialog`, `ClassGrid`) e `pages/dashboard/ConfirmButton.tsx`; `App.tsx` carica le pagine con import di default. Test `teacherPages.test.tsx` (3). **Piano completato.** |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `f26a002` (fine piano: `test`, `web`, `image`). |
