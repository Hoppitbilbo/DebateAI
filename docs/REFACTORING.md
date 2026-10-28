# Refactoring: Clean Code + Design Pattern

Ultimo aggiornamento: 27 ottobre 2026 · Branch: `vercel` (fasi 0-8 sul branch `go`, fase 9 su `feat/tutorial-studenti-8bit`, fasi 10-11 su `vercel`)

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

- **Fasi 0-8 completate** il 2026-10-18 e unite in `master` (PR #9, merge `c0246a3`).
- **Fase 9 completata** il 2026-10-26 (revisione del codice aggiunto dopo il piano: Sentry, giochi e transizioni, tutorial studenti), sul branch `feat/tutorial-studenti-8bit`, pushata su `origin`.
- **Fase 10 completata** il 2026-10-27 sul branch `vercel`: ottimizzazione della chat condivisa, commit locale `b372168`. Verifiche automatiche verdi; benchmark visivo desktop/mobile ancora da eseguire per i limiti dell'ambiente (vedi Note).
- **Fase 11 completata** il 2026-10-27 sul branch `vercel`: revisione del restyling (`5478a3d`) e dei punti aperti, commit locali `30c38fa`…`798009b`, nessun push.
- **Fasi 10-11 e modifiche del 2026-10-28** (Personaggio misterioso, guide interattive, tutorial tradotti) portate su `master` il 2026-10-28.
- **Lavoro a metà:** nessuno in questo piano (la funzione "Aula lampo" ha un suo documento, `docs/AULA_LAMPO.md`).
- **Punti aperti:** la pagina Tutorial mostra "Tutorial in arrivo" per WikiChat, anche se `/apps/wiki-chatbot/tutorial` esiste (ha solo il tutorial per studenti, non le slide per docenti): da decidere se collegarlo, è un cambio di comportamento. `anthropic.go` antepone ancora un proprio messaggio utente `(start)`, ormai coperto da `userFirst` nel gateway ma lasciato perché l'adapter deve funzionare anche da solo.
- **Test:** Vitest 161 test verdi; lint 0 errori e 0 avvisi; TypeScript e build verdi; `check:i18n` 694 chiavi letterali in 5 lingue, più le chiavi costruite dal catalogo controllate da `catalogTexts.test.ts`. Go (pacchetti `ai`, `app`, `domain`, `httpapi`, `store`, `main`) verificato nella fase 9 anche con `-race`, invariato nella fase 10.

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

### Fase 7: pagine rimaste con chiamate API dirette

- [x] **7.1** (`19b49de`) `features/auth/authApi.ts` usato da `AuthContext` e `AuthPages`.
- [x] **7.2** (`d81884b`) `features/student/studentApi.ts` (dashboard studente, dettaglio sessione); `teacherApi` con `saveAssignment`, `inviteToClass`, `inviteToPlatform`; `InviteForm` riceve il mittente invece dell'URL; `AssignmentForm` usa `AiClient`.

### Fase 8: punti aperti e nuove funzioni per il docente (richiesta del 2026-10-18)

- [x] **8.1** (`8f788ea`) Tutorial: allineare gli id delle slide ai testi esistenti, tenere il necessario, migliorare i testi poco chiari.
- [x] **8.2** (`a25b47a`) Personaggio misterioso: confronto del tentativo severo; la partita termina quando JEV giudica raggiunto l'obiettivo, con un messaggio.
- [x] **8.3** (`6c65719`) Eliminare gli avvisi `react-refresh/only-export-components`.
- [x] **8.4** (`7567de7`, `a734dc0`, `4250894`) Docente: stampa/PDF della chat, feedback scritto a mano (visibile allo studente), export dei voti in Excel. Voti in dashboard e revisione della chat in qualsiasi momento esistono già (pagina di avanzamento del compito e `/sessions/{id}`).
- [x] **8.5** Pull request da `go` a `master`: esisteva già la #9 (https://github.com/Hoppitbilbo/DebateAI/pull/9), che include tutti i commit; aggiunto un commento con il riepilogo del refactoring e delle nuove funzioni.

### Fase 9: revisione del codice aggiunto dopo il piano (richiesta del 2026-10-26)

Il codice di Sentry (`845ef66`), dei tutorial studenti (`982debd`) e di giochi e transizioni (`dcfa299`) è stato scritto fuori dal piano. Controllato con le stesse regole: test verdi, ma alcuni punti tornano indietro rispetto alle fasi 1-7.

- [x] **9.0** (`8599747`) Registro: hash reali dei commit delle tre funzioni e della correzione Netlify (`1a95712`); *Stato attuale* aggiornato.
- [x] **9.1** (`cc5c5b4`) Costanti `ai.RoleUser`, `ai.RoleAssistant`, `ai.EffortLow` al posto delle stringhe sparse negli adapter, nel gateway, nel giudice e nel service delle sessioni (numeri e stringhe magiche, fase 1.3).
- [x] **9.2** (`89e5909`) `aiGateway.Generate` (circa 65 righe, quattro compiti): tentativo su un target in un metodo a parte, ripiego sull'ultimo rifiuto in una funzione; `refusalProbeChars*2` diventa una costante con nome.
- [x] **9.3** (`7042fdc`) `server/sentry.go`: `sentryOptions` fa tre cose (environment, release, opzioni). Estrarre `releaseName` e `tracesSampleRate`; costanti per i campionamenti e per il timeout di `Flush`.
- [x] **9.4** (`8ca6486`) `useChatEngine`: il blocco `setBusy(true) / try / finally` è ripetuto in `open`, `retry`, `runTurn` e in `YouModeratePage.speakAlone` (DRY). Un unico `withBusy`; YouModerate apre il dibattito con `engine.open` come le altre cinque app invece del parametro `cue` dentro `speak`.
- [x] **9.5** (`6840710`) `TutorialPlayerPage.tsx` contiene la modalità di rendering per il video (API su `window`, timeline, WAV in base64): spostarla in `src/features/tutorials/student/` così la pagina resta solo instradamento (fase 7).
- [x] **9.6** (`653f22a`) Test di `src/lib/lazyPage.ts` (precaricamento, nuovo tentativo dopo un errore di rete, `preloadPath` con query e hash), oggi senza rete di sicurezza.

### Fase 10: prestazioni della chat (richiesta del 2026-10-27)

- [x] **10.1** (`b372168`) Isolare cronologia e singoli messaggi dall'input; raggruppare gli aggiornamenti visivi dello streaming; caricare l'evidenziazione del codice su richiesta; saltare il layout dei messaggi fuori schermo con le API native del browser. Test di comportamento prima del refactoring e verifiche su 200 messaggi, completamento dello streaming, trascrizione Live, reset, smontaggio, StrictMode, scroll e download fallito del codice opzionale.

### Fase 11: revisione del restyling e punti aperti (richiesta del 2026-10-27)

Il restyling (`5478a3d`) è stato scritto fuori dal piano. Controllato con le stesse regole, insieme ai punti aperti rimasti dalla fase 9.

- [x] **11.0** (`30c38fa`) Test di caratterizzazione: link e ordine delle app in home, pagina App e Tutorial; chat animata della home (statica con `prefers-reduced-motion`, avanzamento con lo scroll); avatar delle chat; navigazione con morph.
- [x] **11.1** (`e038d83`) Un solo catalogo delle app: percorsi e chiavi i18n vengono da `APPS` (già esistente in `features/activity/types.ts`); `src/features/apps/catalog.ts` dice solo quali app mostra ogni pagina e in che ordine, più l'app annunciata `prompt-engineer`. Usato da `HeroSection`, `FeaturesSection`, `AppsPage` (`AppCard` riceve l'app), `TutorialsPage` e `appArt.ts`; tolto il prop `isNew`, non più passato da nessuno.
- [x] **11.2** (`e12ac90`) `prefersReducedMotion` in un solo punto (`src/lib/motion.ts`, con test), usato da `HeroSection`, `DebateStory` e `morph.ts`. Unica differenza: la hero non va più in errore nei browser senza `matchMedia`.
- [x] **11.3** (`12fa887`) `DebateStory` (170 righe, quattro compiti) diviso: copione e stato puro `storyState` in `features/story/script.ts`, `scrollProgress` e `useScrollScript` in `features/story/useScrollScript.ts` (il `0.8` diventa `END_SLACK`), tutti con test; `StorySteps` e `StoryChat` in `components/story/`. `DebateStory` resta sotto le 40 righe e compone i pezzi.
- [x] **11.4** (`323c8d8`) Scelta dell'avatar in `features/activity/speakerAvatar.ts` (`wikiTitleOf`, `fallbackIcon`, nomi speciali `???` e `AI` come costanti), con test; `ChatMessages` solo disegna.
- [x] **11.5** (`8802130`) `TutorialsPage` (316 righe prima della fase, 211 dopo): passi, risorse e consigli generati da dati, `Section`, `TutorialCard` e `UpcomingCard` come componenti; tolti 4 import inutilizzati e il campo `available` mai letto. I bottoni dentro `<Link>` (HTML non valido) diventano `Button asChild`, come nel resto del sito.
- [x] **11.6** (`798009b`) `src/hooks/useBusyAction.ts` (con test) al posto del blocco `setBusy(true) / try / catch → toast / finally` ripetuto 6 volte in `AuthPages` (4 form, tramite `useAuthAction` con i testi d'errore tradotti), `AddProviderDialog` e `InviteForm` (punto aperto della fase 9). Prima, test di caratterizzazione dei form di accesso e reimpostazione password. `useChatEngine.withBusy` resta a parte: non mostra toast, gli errori finiscono nel messaggio della chat.

---

## Note e decisioni

- **Limiti del Personaggio misterioso, guide interattive e tutorial tradotti (2026-10-28):** modifiche funzionali richieste dall'utente, fuori dalle fasi; commit `bd50601` (gioco), `46844e8` (guide), `433514d` (tutorial). (1) Nel form del compito domande, minimo e massimo di messaggi potevano contraddirsi (es. 7 domande annunciate ma massimo 5: il server chiudeva con `turn_limit` a metà gioco; minimo sopra il massimo). `reconcileLimits` (`src/features/teacher/assignmentLimits.ts`) li adatta al salvataggio e mostra all'insegnante cosa ha cambiato: nel gioco le domande diventano il massimo di messaggi, il minimo non supera mai il massimo. Per i compiti già salvati la pagina usa `availableQuestions` (`mystery.ts`), che non supera mai il `maxTurns`; per calcolarlo senza stato copiato, `useActivityFlow` accetta ora `context` anche come funzione dell'assegnazione (come `live`). (2) Fine partita non più brusca: a domande finite (conteggio, `turn_limit` o JEV) la chat resta visibile e bloccata con un messaggio, e il modulo della risposta finale compare solo quando lo studente preme «Prova a indovinare»; prima sostituiva la chat appena arrivava l'ultima risposta. (3) Guide interattive in `src/features/tour/` (dati in `tours.ts`, elementi marcati con `data-tour`): overlay con riflettore, puntatore animato e scheda; partono da sole la prima volta che un utente collegato apre dashboard docente, pagina classe, dashboard studente o un'attività. Si possono saltare, disattivare ("Non mostrare più le guide" o interruttore in Account) e rivedere dal menu utente. Preferenze in `localStorage` per id utente (non sul server: su un altro browser la guida riparte). Testi delle guide verificati in 5 lingue da `tour.test.ts`. (4) In modalità voce la fine delle domande tagliava l'audio dell'ultima risposta (Gemini segnala la fine del turno quando ha generato tutto, non quando l'audio è finito): nuovo `finishLive` in `useLiveAi` chiude subito il microfono e la connessione solo a fine riproduzione; usato anche da `useChatEngine` quando il server chiude l'attività. (5) Tutorial 8-bit per studenti tradotti in tutte le lingue (`src/i18n/studentTutorials/{en,es,fr,de}.json`, registrati in `src/i18n/index.ts`). Il font pixel (Press Start 2P) non ha maiuscole accentate: nelle scritte in maiuscolo disegnate con quel font (titoli, etichette dei voti, pulsante start) gli accenti sono tolti, e in tedesco Ä/Ö/Ü diventano AE/OE/UE. Verificati nel browser fr, de, en, es. 161 test, lint, TypeScript, build e i18n verdi; guida verificata in Chromium a 1280 e 390 px con API simulate.
- **Navbar che spariva aprendo un menu (2026-10-28):** correzione di un bug segnalato dall'utente. Con la pagina scrollata, aprire il menu dell'account o della lingua spostava la navbar fuori dallo schermo: Radix blocca lo scroll con `overflow: hidden` sul `body`, ma `html { overflow-x: clip }` impediva di passare il blocco alla finestra, così il `body` diventava un contenitore a scroll 0 e la navbar sticky si fissava in cima al documento. In `index.css`, finché `body[data-scroll-locked]` è presente, `html` torna `overflow-x: visible`. Verificato in Chromium (desktop e 390 px) con il menu della lingua; WebKit non installato.
- **Fase 11 (2026-10-27):** il restyling è stato registrato in un commit `feat` a parte (`5478a3d`) prima dei refactoring, così ogni task resta un cambio puro. Differenze volute e minime: la hero non va più in errore senza `matchMedia`; l'app proposta a caso nella hero non cambia più quando si cambia lingua (prima la lista si ricreava con `t`). Le pagine pubbliche ora costruiscono le chiavi i18n dal catalogo (`features.items.${app.i18nKey}…`): `check-i18n.mjs` legge solo chiavi letterali, per questo il conteggio scende da 704 a 679 e le chiavi costruite sono controllate da `src/features/apps/catalogTexts.test.ts`. `morph.ts` ora ha test con una `startViewTransition` finta.
- **Testi delle pagine pubbliche (2026-10-27):** riscritti in 5 lingue home, pagina App, Tutorial, footer, menu e 404: frasi concrete al posto di "coinvolgente/innovativo/trasformare", sentence case, nessun trattino lungo (tolti anche da `aboutPage` e `guessLog`). Un solo nome per app ovunque (`features`, `appsPage`, `tutorialsPage`, `platform.appNames`, `apps/*.json`), e "app" come termine unico. Corretta la descrizione di Doppia intervista in home (prima descriveva Modera tu) e quella di Personaggio misterioso ("sfida l'IA a indovinare": è lo studente che indovina). Tolta l'etichetta "Nuovo"/"Disponibile" presente su tutte le card. Intestazioni di App e Tutorial con lo stesso stile della home.
- **Restyling grafico, seconda passata (2026-10-27):** palette viola (azioni) e giallo (evidenziatore) su carta chiara; illustrazioni ricolorate in viola. Logo nuovo disegnato a mano in SVG (`LogoMark`: stella di Galileo + tocco dello studente; le icone Icons8 non si possono usare come logo). La chat d'esempio della home è sostituita da `DebateStory`: dialogo Galileo–studente che si costruisce con lo scroll (sezione sticky, bolle con animazione "bump", passi 1-4 evidenziati), testi in `hero.story` nelle 5 lingue; con `prefers-reduced-motion` è statica. Card delle app: `AppArt` (icona Icons8 a colori su macchia gialla; su desktop con mouse, all'hover sale l'illustrazione dell'app). Modera tu (tribunale con martelletto che batte) e Doppia intervista (schermo diviso stile "Le Iene", bocche e microfoni che si alternano) sono SVG animati disegnati in casa, perché Icons8 non ha queste scene nello stile; percorsi in `src/lib/appArt.ts`. Nelle chat ogni bolla ha l'avatar: foto Wikipedia della pagina del parlante (`wikiImage.ts`, una richiesta per titolo) o icona Icons8 (studente, persona, pagina per WikiChat, maschera per il personaggio misterioso, che non rivela mai il nome). Nei test `wikiImage` è simulato in `src/test/setup.ts`. Rimossi `prose-invert` rimasti dal tema scuro.
- **Restyling grafico (2026-10-27):** modifica visiva richiesta dall'utente, fuori dalle fasi. Tema chiaro "editoriale caldo" (carta avorio, inchiostro, terracotta per le azioni, salvia per le illustrazioni), font Fraunces + DM Sans; i token sono in `src/index.css` e `tailwind.config.ts` (`education` ora legge le variabili CSS, quindi le classi esistenti seguono il tema). Illustrazioni Icons8 stile `anthropic-claude-hand-drawn` ricolorate in salvia (`public/illustrations/`, elenco in `icons8.json`); un solo video animato, nella hero, rallentato e in pausa fuori schermo o con `prefers-reduced-motion`. Rimossi i resti di Lovable (immagine og, `@lovable_dev`, script `gptengineer.js`, `lovable-tagger`); nuova anteprima social `public/og-image.png` e favicon. Bottoni dei tutorial distanziati (`flex gap-4` con `Button asChild` al posto di `space-y` su `<Link>` inline). Lint, 103 test, i18n e build verdi.
- **Prestazioni chat (2026-10-27):** responsabilità separate: `ChatPanel` gestisce input e comandi, `ChatMessages` e `ChatMessage` memorizzano il rendering, `useMessageState` conserva subito il transcript completo e pubblica i parziali al massimo una volta per frame. Completamento, errore e reset pubblicano subito e cancellano il frame pendente; salvataggio e giudice continuano a leggere tutti i token. `useChatScroll` conserva l'autoscroll sui nuovi messaggi e segue i cambi di altezza differiti quando il lettore è in fondo. I renderer Markdown hanno identità stabile; `CodeBlock` mostra codice leggibile durante il download di `HighlightedCode` e in caso di errore, che viene registrato in console. Aspetto finale, lingue supportate, retry, API e dati restano invariati.
- **Cronologie lunghe e Pretext:** scelta l'occlusione nativa con `content-visibility: auto` e altezza ricordata dal browser; ultima riga e stampa restano sempre renderizzate. Il DOM completo conserva ricerca, selezione e accessibilità; nei browser senza supporto resta il layout normale. Nessuna nuova dipendenza o stima JavaScript delle altezze Markdown. Pretext resta da valutare soltanto se una misura reale mostra un limite nel layout nativo.
- **Prove della fase 10:** prima delle modifiche, 16 test di caratterizzazione verdi; dopo, `npm run lint`, `npm test` (103), `npx tsc --noEmit -p tsconfig.app.json`, `npm run build` e `npm run check:i18n` verdi. Il test con 200 risposte verifica zero nuove elaborazioni Markdown durante la digitazione e una sola quando cambia l'ultima risposta. Chunk Markdown: 777,56 → 143,58 kB (gzip 274,77 → 44,60 kB); evidenziazione separata: 634,46 kB, scaricata al primo blocco di codice. Le dimensioni misurano il download, non la latenza su un dispositivo reale. Source map Sentry non caricate durante queste build locali. La sandbox impedisce l'ascolto del server locale (`listen EPERM`) e l'avvio di Chromium; la policy del browser collegato vieta le pagine `file:`. Fixture temporanee rimosse; restano da verificare visivamente scroll, ridimensionamento e fluidità su browser desktop e smartphone reali. Nessun deploy o push eseguito.
- **Deploy su Vercel (2026-10-26):** aggiunta funzionale richiesta dall'utente, fuori dalle fasi. `vercel.json` con due servizi (`app` Vite su `/`, `server` Go su `/api/*`), nessun binding. Vercel non ha disco persistente, quindi `store.OpenRemote` apre un database libSQL (Turso) quando c'è `TURSO_DATABASE_URL`; senza, resta il file SQLite (Docker invariato). Con il database remoto il server non scrive nulla su disco e richiede `APP_SECRET`. Guida in `docs/VERCEL.md`.
- **Tutorial video per studenti (2026-10-26):** aggiunta funzionale richiesta dall'utente, fuori dalle fasi 0-8. Sei tutorial in pixel art 8-bit (uno per app, sei slide ciascuno: missione, consegna, percorso, barra Avanzamento, valutazione, consigli) con un personaggio storico guida, un PC retrò e un morph orizzontale tra le slide. Codice in `src/features/tutorials/student/`: dati in `studentTutorials.ts`, testi in `src/i18n/studentTutorials/it.json` (namespace `studentTutorial`, solo italiano: le altre lingue ricadono sull'italiano), clock puro in `timeline.ts` (lo stesso frame si disegna dal vivo e per il video). Nell'app: scheda "Per lo studente" in `/apps/<app>/tutorial` (anche per WikiChat, che prima non aveva tutorial), con voce sintetica del browser ed effetti chiptune; modalità presentazione in `/tutorial-player/:app`. Video MP4: `npm run render:tutorials` (voci macOS `say`, frame con Playwright, ffmpeg) in `tutorial-videos/`, ignorata da git. Il piano dei testi è in `docs/TUTORIAL_STUDENTI_PIANO.md`.
- **Giochi e transizioni (2026-10-26):** modifiche funzionali richieste dall'utente. (1) Ogni gioco si apre con il personaggio che parla nella propria voce, generato da una direzione di scena nascosta (`openings` in `prompts.ts`, `engine.open`); se nessun modello risponde compare il vecchio testo fisso. (2) Il gateway scarta le risposte vuote e i rifiuti "da IA" (`answer_check.go`, controllo sui primi 160 caratteri prima di mostrarli) e passa al modello successivo; se rifiutano tutti, mostra l'ultimo rifiuto. Le cronologie che iniziano con il personaggio ricevono un primo messaggio utente (Anthropic e Gemini lo richiedono). Errori del gateway mostrati allo studente con un testo comprensibile e pulsante "Riprova". (3) Transizioni con View Transitions API (`src/features/navigation/`): pagina precaricata prima di navigare (`lazyPage`), card dell'app che si apre nell'intestazione, scroll in cima; rimossi `AnimationContext` e `PageFlipAnimation`.
- **Sentry (2026-10-19):** aggiunta funzionale richiesta dall'utente, fuori dalle fasi 0-8. Progetti `aidebate-sx/debateai-web` e `aidebate-sx/debateai-server`; init nel frontend prima dell'app e nel composition root Go, middleware ufficiale `net/http` con hub per richiesta. Errori e tracing (100% sviluppo, 10% produzione), raccolta automatica di dati personali/corpi/header/cookie/query disattivata. DSN opzionali; source map private tramite plugin Vite e secret BuildKit, mai emesse senza token. SHA condiviso tra build web e Go. Il test Go verifica privacy, acquisizione panic e stack leggibile; verificato il 2026-10-26 con errori reali dall'app in esecuzione in entrambi i progetti. Nessun deploy eseguito.
- Schema della fase 3: il repository vive in `server/internal/store` (tipo concreto, es. `store.Settings`), mentre l'interfaccia la definisce chi la usa in `app` (es. `settingsStore` in `settings.go`). `Server` ha un campo per repository, inizializzato in `NewServer` (spostato in `main.go` al task 4.4). Ogni repository ha i suoi test in `store` con un DB temporaneo.
- Entità condivise in `server/internal/domain` (`User`, `Invite`, `UserPatch`, ruoli, `Now`/`ParseTime`). In `app/repositories.go` ci sono le interfacce dei repository e gli alias temporanei (`User`, `inviteRow`, `Class`, `Member`, `Assignment`, `AssignStats`, `SessionSummary`, `SessionDetail`), da rimuovere quando gli handler useranno direttamente `domain` (fase 4). Lo schema SQL e `Open` sono in `store/schema.go`.
- (Fatto nel task 8.2) `isCorrectGuess` del personaggio misterioso accetta anche tentativi cortissimi contenuti nel nome (es. "Da" per "Leonardo da Vinci"); fissato da `mystery.test.ts`.
- **(Risolto nel task 8.1) Gap di contenuto dei tutorial:** il codice usa gli id di slide `thinkAloud`, `reflectionAndGrowth`, `examples` (e i punti elenco di altre 3 slide) che nei file `src/i18n/tutorials/*.json` hanno nomi diversi (`thinkAloudProtocols`, `reflectionGrowth`, `implementationExamples`, ...): 30 testi mostrano la chiave in tutte le lingue. Inoltre DoppiaIntervista in en/fr/es ha un set di slide diverso (ricade sull'italiano). Correggerli è lavoro sui contenuti; `tutorials.test.tsx` conta i 30 testi mancanti e fallirà (in meglio) quando verranno sistemati.
- Go non ha ereditarietà: Template Method si realizza con funzioni o interfacce passate come parametro (composizione).
- L'API HTTP e lo schema SQLite non cambiano durante il refactoring.
- Task 1.2: unica eccezione voluta alla regola "nessun cambio di comportamento". Solo quando una scrittura sul DB fallisce: le scritture principali rispondono 500 invece di un falso OK, quelle di contorno (ultimo login, pulizia sessioni, costi, prezzi importati, `email_sent`) vengono loggate con `execOrLog`, e gli handler con più update usano `sqlBatch`. Restano volutamente le letture `_ = ...QueryRow(...).Scan(...)` che hanno un valore di default sensato (nome classe, somme dei costi): verranno riviste nei repository (fase 3).
- La risposta di `PUT /api/sessions/{id}/transcript` ha tre forme diverse (sessione libera o già chiusa: `ended,progress,status,turns`; compito attivo: in più `jev,maxTurns,reason`). È fissata da `TestSaveTranscript*`: il DTO del task 1.4 deve mantenerla, usando `omitempty` dove serve.

---

## Registro

| Data | Task | Commit | Chi | Note |
|---|---|---|---|---|
| 2026-10-28 | Personaggio misterioso, guide, tutorial tradotti | `bd50601`, `46844e8`, `433514d` | Claude Code | Modifiche funzionali (vedi Note): limiti coerenti e fine partita morbida anche in voce, guide interattive al primo accesso, tutorial 8-bit in 5 lingue. 161 test, lint, TypeScript, build e i18n verdi; guide e tutorial verificati in Chromium. |
| 2026-10-27 | 11.0-11.6 | `30c38fa`, `e038d83`, `e12ac90`, `12fa887`, `323c8d8`, `8802130`, `798009b` | Claude | Revisione del restyling: test di caratterizzazione, catalogo unico delle app, `prefersReducedMotion`, `DebateStory` diviso, scelta dell'avatar pura, pagina Tutorial guidata dai dati, `useBusyAction`. 140 test, lint, TypeScript, build e i18n verdi. |
| 2026-10-27 | 10.1 | `b372168` | Codex | Chat: rendering isolato per cronologia/riga, streaming raggruppato per frame con transcript immediato, evidenziazione lazy con fallback leggibile, occlusione CSS e scroll seguito sui resize. Nessuna dipendenza nuova. 103 test, lint senza avvisi, TypeScript, build e i18n verdi. Chunk Markdown ridotto da 777,56 a 143,58 kB; verifica browser impedita dall'ambiente, dettagli nelle Note. |
| 2026-10-26 | Tutorial studenti | `982debd` | Claude Code | Tutorial 8-bit per studenti in app (player con voce ed effetti, modalità presentazione) ed export MP4. Nuove dipendenze `@fontsource/press-start-2p`, `@fontsource/vt323`, dev `playwright`. Lint 0 problemi, Vitest 77 test, build e 700 chiavi i18n verificati. Branch `feat/tutorial-studenti-8bit`. |
| 2026-10-26 | Giochi e transizioni | `dcfa299` | Claude Code | Apertura in personaggio, controllo risposte vuote/rifiuti con fallback, "Riprova", transizioni con morph. Nei dati locali la chiave OpenRouter risulta scaduta (401) e Nemotron free va in timeout. Go test verdi, Vitest 55 test, lint 0, build e 687 chiavi i18n verificati. |
| 2026-10-26 | Sentry `[x]` | `845ef66` | Claude Code | Verifica nell'app in esecuzione (porte e dati isolati): `DEBATEAI-WEB-1` e `DEBATEAI-SERVER-1` arrivati con stack leggibile (`sentry-verify.ts:4`, `sentry_verify.go:18`), release uguale nei due progetti, environment `development`, nessun header/cookie/corpo. Suite Go completa verde. Trigger temporanei e script di verifica rimossi. Upload delle source map: restano da impostare `VITE_SENTRY_DSN` e `SENTRY_AUTH_TOKEN` su GitHub. |
| 2026-10-19 | Sentry (avvio) | — | Codex | Installati SDK React 11.8.0, plugin Vite 11.8.0 e sentry-go 0.50.0; configurazione locale, Docker/CI, privacy e guida `docs/SENTRY.md`. Lint, 52 test frontend, build e 687 chiavi i18n verificati; Go vet e test del middleware passano. Suite Go completa bloccata dalla sandbox sulle porte di `httptest`; verifica Sentry reale ancora da completare. |
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
| 2026-10-18 | 7.1 | `19b49de` | Claude Code | `authApi` (config pubblica, me, login, logout, info invito, registrazione, password dimenticata, reset, setup, profilo). Test `context/AuthContext.test.tsx` (2). |
| 2026-10-18 | 7.2 | `d81884b` | Claude Code | Nessun file in `src/pages`, `src/components` o `src/context` chiama più `api` direttamente: le chiamate stanno in `src/features/*` (e `services/` per l'AI). `InviteForm` ha la prop `invite` (rimosso `extraBody`, mai usato). Test `pages/dashboard/studentPages.test.tsx` (3). Vitest 48 test. |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `a9fd39c` (fine fase 7: `test`, `web`, `image`). |
| 2026-10-18 | 8.1 | `8f788ea` | Claude Code | Riscritti i tutorial di ImpersonaTu e DoppiaIntervista: 6 slide brevi ciascuno (benvenuto, come funziona, consigli, cosa si impara/confronto, riflessione e valutazione, in classe) aderenti a cosa fa l'app, in it/en/es/fr/de; prima descrivevano sessioni con facilitatori tra pari inesistenti e 30 testi mostravano la chiave. Aggiunti i 3 punti mancanti di YouModerate in en/fr. `tutorials.test.tsx` ora richiede ogni testo in ogni lingua. |
| 2026-10-18 | 8.2 | `a25b47a` | Claude Code | `isCorrectGuess` severo: giusto solo con il nome completo o con una parola intera del nome di almeno 4 lettere ("Vinci", "Leonardo"); frammenti, particelle e errori di battitura sono sbagliati. Quando JEV giudica raggiunto l'obiettivo del compito (`goal_reached`, serve `autoEnd`), le domande si fermano, compare il messaggio `apps.personaggioMisterioso.judgeEnded` (5 lingue) e si passa alla risposta finale. Test in `mystery.test.ts` e `activityPages.test.tsx`. |
| 2026-10-18 | 8.3 | `6c65719` | Claude Code | Lint a 0 avvisi. `useAuth`/`dashboardPath` in `context/auth.ts` e `useAnimation` in `context/animation.ts` (i provider restano nei `.tsx`; i test mockano `@/context/auth`); `formatDate`/`usd` in `lib/format.ts`; `copy` in `lib/clipboard.ts`; `LOCALES` in `i18n/languages.ts`; `APP_ICONS`/`APP_TYPES` in `features/activity/appCatalog.ts`. In `eslint.config.js` la regola è spenta solo per `src/components/ui` (componenti shadcn generati). |
| 2026-10-18 | 8.4a | `7567de7` | Claude Code | Feedback del docente: colonne `teacher_feedback`, `teacher_score` (0-10), `teacher_feedback_at`; prima migrazione del progetto (`migrations` in `store/schema.go`, solo aggiunte, idempotente). `SessionService.GiveFeedback` (docente della classe o admin, mai il proprietario), evento `feedbackListener` → `feedbackMailer` (mail "feedback" in 5 lingue), `PUT /api/sessions/{id}/feedback`. Test di migrazione su DB vecchio e delle regole. |
| 2026-10-18 | 8.4c | `a734dc0` | Claude Code | Export Excel con `github.com/xuri/excelize/v2`: `GET /api/classes/{id}/grades.xlsx` e `GET /api/assignments/{id}/grades.xlsx`, una riga per studente e compito (stato, progresso, voti IA, voto docente, tentativi), intestazioni nella lingua del docente. `AssignmentService.Grades`. Test che scarica e rilegge il file. |
| 2026-10-18 | 8.4b | `4250894` | Claude Code | Pagina sessione: pulsante Stampa / PDF (`window.print`, stili `print:` e `@media print` in `index.css`), `TeacherFeedbackForm` per il docente e `TeacherFeedbackView` per lo studente (e nella stampa). Pulsanti "Esporta voti (Excel)" in classe e compito; colonna voto docente e voto docente nella matrice. Voti in dashboard e revisione della chat in qualsiasi momento esistevano già. Test `sessionFeedback.test.tsx` (3). Vitest 52 test. |
| 2026-10-18 | 8.5 | — | Claude Code | La PR #9 (`go` → `master`, aperta in precedenza) contiene tutto il lavoro; commento di riepilogo: https://github.com/Hoppitbilbo/DebateAI/pull/9#issuecomment-6254869651 |
| 2026-10-18 | — | — | Claude Code | CI GitHub verde su `4abb18e` (fine fase 8: `test`, `web`, `image`). |
| 2026-10-18 | — | `c0246a3` | Claude Code | PR #9 unita in `master` (merge commit, su richiesta). |
| 2026-10-26 | Netlify | `1a95712` | — | Netlify costruisce il frontend invece di pubblicare i sorgenti (registrato a posteriori nel task 9.0). |
| 2026-10-26 | 9.0 | `8599747` | Claude Code | Revisione del codice aggiunto dopo il piano: suite verde (Go, Vitest 80, lint 0, i18n 701), aperta la fase 9 con 6 task. Hash mancanti presi da `git log`. |
| 2026-10-26 | 9.1 | `cc5c5b4` | Claude Code | `ai.RoleUser`, `ai.RoleAssistant`, `ai.EffortLow` negli adapter (Anthropic, Gemini, OpenAI), gateway, giudice e `countStudentTurns`; `roleSystem` in `app/judge.go` per gli avvisi dell'app nel transcript. Nessuna stringa di ruolo rimasta fuori dai test. |
| 2026-10-26 | 9.2 | `89e5909` | Claude Code | `Generate` da 65 a 42 righe: `genCall`, `tryTarget` (timeout, screening, log dell'uso; in caso di rifiuto restituisce la risposta insieme all'errore) e `deliver`. Costante `refusalScanChars`. `go test -race ./internal/app` verde. |
| 2026-10-26 | 9.3 | `7042fdc` | Claude Code | `releaseName`, `tracesSampleRate`, costanti `defaultEnvironment`, `devTracesSampleRate`, `prodTracesSampleRate`, `sentryFlushTimeout` (usata da `main.go`). Valori invariati; test di `sentry_test.go` verdi. |
| 2026-10-26 | 9.4 | `8ca6486` | Claude Code | `withBusy` in `useChatEngine` usato da `open`, `runTurn`, `retry` e da `YouModeratePage.speakAlone`; il motore esporta `withBusy` al posto di `setBusy`. YouModerate apre con `engine.open` (helper `systemOf`); `speak` non ha più il parametro `cue`. |
| 2026-10-26 | 9.5 | `6840710` | Claude Code | `RenderStage`, `TutorialRenderApi` e `toBase64` in `src/features/tutorials/student/RenderStage.tsx`; la pagina sceglie solo tra player, render e 404. Verificato in Chromium headless (Playwright, server Vite): `window.__tutorial` pronto, 6 voci, timeline ricalcolata, WAV generato, nessun errore di pagina. |
| 2026-10-26 | 9.6 | `653f22a` | Claude Code | `src/lib/lazyPage.test.ts` (6 test): sospensione e render immediato, un solo download, nuovo tentativo dopo un errore, `preloadPath` con query/hash e mai in errore, `preloadPrefix`. Suite completa: Go verde (anche `-race`), Vitest 86, lint 0, build ok, 701 chiavi i18n. Fase 9 completata. |
| 2026-10-26 | Vercel | `47f9dfd` | Claude Code | `vercel.json`, driver `libsql-client-go` (Go puro, `CGO_ENABLED=0` invariato), `Config.DatabaseURL/DatabaseToken/Storage`, `app.OpenDB(cfg)`. Verificato contro `libsql-server` in Docker: i 13 test di `store` uno per uno su database vuoto, più un controllo temporaneo di chiavi esterne e `ON DELETE CASCADE/SET NULL`; binario vero: health, admin dal bootstrap, login, `me`; senza `APP_SECRET` il server si ferma. Non verificati: deploy reale e streaming SSE sul runtime Go di Vercel. |
| 2026-10-26 | Vercel | — | Claude Code | Primo deploy reale: progetto `debateai` collegato al repo, database Turso dal Marketplace (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`), `APP_SECRET` e `PUBLIC_URL` in produzione. https://debateai-steel.vercel.app: frontend e `/api/*` rispondono 200, log `database: remote libSQL`. Senza database il server si fermava (`./data` in sola lettura). `.gitignore`: `.vercel`, `.env*` (tranne `.env.example`). Resta da verificare lo streaming SSE. |
