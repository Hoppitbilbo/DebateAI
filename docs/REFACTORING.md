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

- **Fase in corso:** 4 (service, State, Observer, backend)
- **Prossimo task:** 4.1
- **Lavoro a metà:** nessuno
- **Test:** Go 33 test nuovi + quelli esistenti verdi; Vitest 18 test verdi; lint 0 errori (18 warning preesistenti)

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

```
server/internal/
  ai/          provider, decorator, registry, routing
  domain/      User, Class, Assignment, Session (+ macchina a stati), errori di dominio
  store/       repository SQLite (unico posto con SQL)
  service/     auth, classes, assignments, sessions, judge, gateway
  httpapi/     handler sottili, middleware, DTO
  notify/      mail e observer degli eventi
main.go        composition root (costruisce e inietta le dipendenze)
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
| Template Method (via composizione) + Strategy | `ActivityDefinition` per app + `<ActivityRunner>` generico che gestisce le fasi |
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

- [ ] **4.1** `SessionService` con macchina a stati della sessione; `handleSaveTranscript` sotto le 20 righe.
- [ ] **4.2** Service per auth, classes e assignments; handler sottili in `httpapi/`.
- [ ] **4.3** Observer per le notifiche mail.
- [ ] **4.4** `main.go` come composition root; `Server` ridotto a router e middleware.

### Fase 5: attività (frontend)

- [ ] **5.1** `ActivityDefinition` + `ActivityRunner`; migrare ConvinciTu.
- [ ] **5.2** Migrare ImpersonaTu e WikiChatbot.
- [ ] **5.3** Migrare DoppiaIntervista, PersonaggioMisterioso e YouModerate.
- [ ] **5.4** `AiClient` (Adapter) usato dagli hook.

### Fase 6: resto del frontend

- [ ] **6.1** Tutorial guidati dai dati + `TutorialRenderer`.
- [ ] **6.2** Dividere `AdminAI.tsx` e `AdminPage.tsx` in hook dati e componenti.
- [ ] **6.3** Dividere `TeacherPages.tsx`.

---

## Note e decisioni

- Schema della fase 3: il repository vive in `server/internal/store` (tipo concreto, es. `store.Settings`), mentre l'interfaccia la definisce chi la usa in `app` (es. `settingsStore` in `settings.go`). `Server` ha un campo per repository, inizializzato in `NewServer` (spostato in `main.go` al task 4.4). Ogni repository ha i suoi test in `store` con un DB temporaneo.
- Entità condivise in `server/internal/domain` (`User`, `Invite`, `UserPatch`, ruoli, `Now`/`ParseTime`). In `app/repositories.go` ci sono le interfacce dei repository e gli alias temporanei (`User`, `inviteRow`, `Class`, `Member`, `Assignment`, `AssignStats`, `SessionSummary`, `SessionDetail`), da rimuovere quando gli handler useranno direttamente `domain` (fase 4). Lo schema SQL e `Open` sono in `store/schema.go`.
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
