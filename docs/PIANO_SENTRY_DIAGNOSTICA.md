# Piano: Sentry per la diagnostica dei test

Data: 3 novembre 2026. Stato: **F0 sul branch `feat/sentry-diagnostica` (codice fatto, variabili Sentry su Vercel da aggiungere); F1–F6 da fare; decisioni prese in §4**.
Specifica di riferimento: «10. Miglioramento di Sentry e monitoraggio dei futuri test» (sezioni A–L).
Branch suggerito: `feat/sentry-diagnostica`, da `master` dopo l'unione di `feat/classe-username`.

## 1. Punto di partenza (cosa c'è già)

| Area | Stato attuale | File |
|---|---|---|
| Init browser | `@sentry/react` 11.8, tracing 100% dev / 10% prod, `tracePropagationTargets: /^\/api\//`, console e DOM breadcrumb spenti, raccolta dati personali spenta, `genAI` input/output spenti | `src/instrument.ts` |
| Init server | `sentry-go` 0.50 + `sentryhttp`, stesse regole privacy, `Repanic` | `server/sentry.go` |
| Release | Vite: `SENTRY_RELEASE` → altrimenti `git rev-parse HEAD`; Go: `SENTRY_RELEASE` → `buildRelease` → `vcs.revision` | `vite.config.ts`, `server/sentry.go` |
| Source map | upload con `@sentry/vite-plugin` solo se c'è `SENTRY_AUTH_TOKEN`, poi cancellate | `vite.config.ts`, `docs/SENTRY.md` |
| Replay, Logs, Metrics, Feedback | **non attivi** | — |
| Errori AI | il gateway prova la catena di fallback (`retryable`, `runFallbackChain`), ma l'handler risponde sempre `502 ai_error` con `err.Error()`: nessuna categoria, nessun evento Sentry | `server/internal/app/gateway.go`, `fallback.go`, `httpapi/ai.go:180` |
| Risposte non valide | `checkAnswer`/`screenAnswers` riconoscono rifiuti e risposte vuote, ma non producono segnali | `server/internal/app/answer_check.go` |
| Valutazione | `parseEvaluation` (voti 0–10), giudice JEV con obiettivi e soglia | `app/evaluation.go`, `app/judge.go` |
| Voce | Gemini Live (`liveConversationService`, `useLiveAi`), dettatura Web Speech (`useSpeechDictation`), sintesi nel tutorial (`useTutorialPlayer`) | `src/services`, `src/hooks` |

### Problemi già visibili da correggere in F0

1. **Release vuota su Vercel (da verificare con `find_releases`)**: il build Vercel non ha `.git`, quindi `git rev-parse` fallisce; anche `vcs.revision` manca nel binario Go. Gli eventi di produzione rischiano di non avere release → impossibile confrontare le versioni (criterio L). Correzione: fallback su `VERCEL_GIT_COMMIT_SHA` in `vite.config.ts` e in `releaseName()`.
2. **Source map su Vercel**: `SENTRY_AUTH_TOKEN` è documentato solo per GitHub Actions/Docker; va aggiunto alle variabili di build del servizio `app` su Vercel (solo Production e Preview, mai `VITE_*`).
3. **Messaggi d'errore del provider inviati allo studente** (`err.Error()` in `ai.go`): possono contenere dettagli del provider. Si risolve con la classificazione di F1.
4. Il campionamento al 10% perde quasi tutte le generazioni AI in produzione: serve un `tracesSampler` (F1).

## 2. Decisioni di architettura

1. **Un solo modulo di telemetria per lato**, nessuna integrazione duplicata:
   `src/lib/telemetry.ts` e `server/internal/obs/` (pacchetto piccolo, usato da `httpapi` e `app`). Tutto il resto del codice chiama solo questi helper, mai `Sentry.*` direttamente. Così privacy, nomi degli eventi e livelli stanno in un punto solo.
2. **Il segnale giusto per ogni evento** (sezione C):

   | Tipo | Quando | Esempi |
   |---|---|---|
   | Span | ogni operazione con durata | `ai.generate`, `audio.stt`, `audio.tts`, `audio.playback`, `session.save`, `activity.evaluate` |
   | Log strutturato (Sentry Logs) | ogni esito, anche positivo; è il denominatore delle metriche | `ai.request` (esito, durata, tentativi), `activity.transition` |
   | Warning (issue con fingerprint) | anomalia applicativa che uno sviluppatore deve guardare | `ai.language_mismatch`, `scoring.anomaly`, `activity.answer_mismatch`, `activity.progression_blocked`, `ai.duplicate_request` |
   | Errore | guasto tecnico | `ai.request_failed` (5xx/timeout/auth), `session.save_failed`, `audio.*_failed` ripetuti |

   Ogni warning/errore ha `fingerprint: [evento, categoria, app]`, così lo stesso problema è **una** issue che cresce di conteggio, non cento notifiche.
3. **Tag indicizzati solo a bassa cardinalità**: `event`, `outcome`, `error_category`, `ai.provider`, `ai.model`, `ai.task`, `app_type`, `expected_language`, `actual_language`, `test_mode`, `test_run_id`, `scenario_id`.
   **Solo attributi/contesto** (non tag): `session_ref`, `turn_id`, `request_id`, `prompt_version`, `rubric_version`, durate, conteggi.
   `test_run_id` è un tag perché ha pochi valori per ciclo di test ed è il filtro principale.
4. **Identificativi** (sezione E):
   - `trace_id`: già propagato da `sentry-trace`/`baggage` sulle chiamate `/api/`; va aggiunto anche al `fetch` manuale di `postEventStream` (oggi passa da `fetch` nativo, coperto da `browserTracingIntegration`: da verificare nel test).
   - `turn_id`: UUID creato dal client quando lo studente invia un messaggio; `request_id`: UUID per ogni tentativo HTTP. Header `X-Turn-Id`, `X-Request-Id`, `X-Retry-Of` (se è un retry autorizzato).
   - `session_ref`: HMAC-SHA256 troncato di `session_id` con `APP_SECRET` — pseudonimo stabile, mai l'id reale né lo username.
   - `prompt_version`: hash breve calcolato all'avvio dai template di `app/prompts.go` (nessuna costante da aggiornare a mano). `rubric_version`: idem dal prompt di `evaluationPrompt`.
   - `app_release`: la release Sentry (F0).
5. **Modalità test** esplicita: attivata da `/test?run=<id>&scenario=<id>` solo per utenti `admin` o `teacher` (o in ambiente non `production`), salvata in `sessionStorage`, banner visibile «Modalità test: run X». Aggiunge `test_mode`, `test_run_id`, `scenario_id` allo scope Sentry e agli header `X-Test-Run`/`X-Test-Scenario`. Il server li accetta solo dallo stesso tipo di utente.
6. **Privacy prima del contenuto**: non si inviano mai testi di messaggi, trascrizioni, audio, nomi o risposte. Si inviano lunghezze, codici lingua, conteggi, esiti, hash. `beforeSend`, `beforeSendLog` e `beforeSendSpan` passano da un'unica allowlist di chiavi in `telemetry.ts` / `obs`. In Sentry: *Prevent Storing of IP Addresses* attivo in entrambi i progetti; data scrubber lato server attivi.

## 3. Fasi

Ogni fase è un PR separato, verificabile da sola. Ordine scelto per dare valore subito ai test.

### F0 — Fondamenta (sezione A)

**Stato (3/11/2026):** fatto nel codice — release da `VERCEL_GIT_COMMIT_SHA` e ambiente da `VERCEL_ENV` (preview → `test`) in `vite.config.ts` e `server/sentry.go`; `tracesSampler` Go che tiene tutte le richieste AI; browser al 100% fuori produzione. Test in `server/sentry_test.go`, build simulata di un preview controllata nel bundle. **Scoperto:** su Vercel mancano `SENTRY_DSN`, `VITE_SENTRY_DSN` e `SENTRY_AUTH_TOKEN`, quindi oggi la produzione su Vercel non manda nulla a Sentry; vanno aggiunte dall'utente (scrittura di segreti). Log: entrambi gli SDK li inviano appena si usa l'API (`Sentry.logger`, `sentry.NewLogger`), nessuna opzione da attivare. Rimandati a F1, dove nasce il primo chiamante: i moduli `telemetry.ts`/`obs` con l'allowlist (crearli ora senza chiamanti sarebbe codice speculativo).


- Fallback release su `VERCEL_GIT_COMMIT_SHA` (browser e Go) + test in `server/sentry_test.go`.
- `SENTRY_AUTH_TOKEN` nelle env di build Vercel; verificare che un errore di produzione abbia frame leggibili.
- `enableLogs: true` (browser) ed `EnableLogs` (Go) — verificare il supporto in `sentry-go` 0.50; senza supporto, log strutturati come breadcrumb + attributi dello span.
- `tracesSampler`: 100% in `development`/`test`/modalità test; in produzione 100% per `POST /api/ai/generate` ed `/evaluate`, 10% per il resto. Rivedere dopo una settimana di volumi reali.
- Ambiente `test` per i deployment di prova (oggi i preview Vercel rispondono 500 per `APP_SECRET`: impostare `APP_SECRET` e `SENTRY_ENVIRONMENT=test` anche per Preview, oppure un database Turso separato per i test).
- Moduli `telemetry.ts` e `obs` con allowlist privacy e test unitari che verificano che un campo non ammesso venga scartato.

### F1 — Chiamate API e AI (sezione B, `ai.request_failed`, `ai.response_invalid`, `ai.duplicate_request`)

**Server** (`httpapi/ai.go`, `app/gateway.go`, `app/fallback.go`):
- `obs.ClassifyAIError(err) → categoria`: `auth_config` (401/403, chiave mancante), `rate_limit` (429), `provider_5xx`, `timeout`, `network`, `canceled` (client chiuso: **non** è un errore), `invalid_response` (vuota, JSON non interpretabile, rifiuto), `budget` (budget mensile), `bad_request`. Si appoggia a `retryable()` e ai tipi d'errore di `ai/types.go`.
- Lo span `ai.generate` registra: endpoint, metodo, stato HTTP, durata, esito, categoria, provider, modello, numero di tentativi e di fallback (contati in `runFallbackChain`), `turn_id`, `request_id`, `session_ref`, lingua attesa, release.
- La risposta al client diventa `502 {error: "<categoria>", message: <testo localizzabile>}` invece di `err.Error()`; il frontend ha già le chiavi `platform.aiErrors.<code>` (aggiungere le nuove nelle 5 lingue, `npm run check:i18n`). È un cambio di contratto voluto: rigenerare `TestResponseShapes` e spiegarlo nel Registro di `REFACTORING.md`.
- Riusare ciò che `usage_log` già registra (`first_delta_ms`, `first_text_ms`, `estimated`) come attributi dello span, senza duplicare la misura.
- Un log `ai.request` per ogni chiamata (anche riuscita) = denominatore per percentuale di fallimenti e p95.
- Stream: l'errore a metà stream (`evt.error`) e la disconnessione del client vanno distinti (`canceled` vs `provider_5xx`).
- **Doppie richieste**: il server tiene un piccolo LRU (in memoria, TTL 2 min) di `turn_id` già visti. Stesso `turn_id` senza `X-Retry-Of` = `ai.duplicate_request` (warning). Limite noto: su Vercel la memoria è per istanza, quindi il controllo lato server è «best effort»; il controllo affidabile è lato client.
- `session.save_failed` (errore) nei salvataggi di `session_service.go` (transcript, voti, chiusura).

**Client** (`src/services/aiService.ts`, `src/lib/api.ts`):
- Wrapper unico attorno a `generate`/`generateStream`/`evaluate`: crea `request_id`, propaga `turn_id`, misura, classifica `AbortError` come `canceled`, `TypeError` come `network`.
- Mappa delle richieste in corso per `turn_id`: un secondo invio dello stesso turno mentre il primo è aperto viene **bloccato** e registrato come `ai.duplicate_request` (questo corregge anche il bug, oltre a segnalarlo).

### F2 — Anomalie didattiche (sezioni C, D: lingua, voto, avanzamento)

- **Lingua** (`ai.language_mismatch`): rilevatore leggero in Go per le 5 lingue dell'interfaccia (it/en/fr/de/es) basato su parole funzionali, applicato **dopo** la generazione, solo a testi di almeno ~12 parole, con soglia di confidenza. Nessuna dipendenza nuova; testato su frasi campione per lingua. Il warning registra lingua attesa, lingua rilevata, confidenza, lingua STT/TTS (dal client), fase (`opening`/`reply`/`evaluation`), `prompt_version`. **Mai il testo.**
- **Valutazione** (`scoring.anomaly`): regole deterministiche in `app/evaluation.go`, dopo `parseEvaluation`:
  - tutti gli obiettivi del giudice raggiunti al primo tentativo e `scoreConversation` sotto la soglia della rubrica;
  - voto fuori 0–10 o non estratto (questo è `ai.response_invalid`);
  - contraddizione fra esito del giudice e voto (es. obiettivi falliti e voto ≥ 9).
  Registra corretto/errato, tentativi, suggerimenti richiesti, voto, eventuale bonus, `rubric_version`. Le soglie stanno in un'unica tabella in Go, con test.
- **Risposta corretta non riconosciuta** (`activity.answer_mismatch`): dove l'app confronta una risposta attesa (es. *personaggio-misterioso*, dove oggi decide JEV con il motivo `identified`), se la risposta è rifiutata ma molto vicina (distanza di modifica normalizzata, senza accenti/maiuscole) → warning con sola distanza e lunghezze.
- **Avanzamento** (`activity.progression_blocked`): piccola macchina a stati dichiarata in `useActivityFlow`/`useEvaluationFlow` e nei passaggi del percorso dell'aula lampo:
  `answer_submitted → answer_validated → feedback_ready → activity_completed → next_level_available`.
  Ogni transizione è un log `activity.transition`; un watchdog (timeout per transizione, es. 30 s per la valutazione) o un'operazione fallita producono il warning con stato precedente, stato atteso e operazione fallita.

### F3 — Voce (sezione D «Problemi vocali», `audio.*`)

- Span separati: `audio.record` (getUserMedia/permessi), `audio.stt`, `ai.generate`, `audio.tts`, `audio.playback`, sotto uno span `voice.turn` con lo stesso `turn_id`.
- `audio.stt_failed`: codici di `SpeechRecognition.onerror` (`not-allowed`, `no-speech`, `audio-capture`, `network`…) e errori di Gemini Live. `no-speech` e `aborted` sono solo log, non issue.
- `audio.tts_failed` e `audio.playback_failed`: rifiuti di `play()`/`AudioContext` (`NotAllowedError` per autoplay), errori di `speechSynthesis`.
- Registrate lingua STT/TTS e nome della voce scelta (`voiceSelectionService`), mai audio o trascrizioni.

### F4 — Modalità test, «Segnala problema», Replay (sezioni E, F, I)

- Pagina `/test` e banner (decisione 5).
- **«Segnala problema»**: visibile solo in modalità test. Form con le 7 categorie e descrizione libera (avviso: «non scrivere nomi o dati personali»). Invio con `Sentry.captureFeedback` (Feedback nativo di Sentry, nessuna tabella nuova) con tag categoria, `test_run_id`, `scenario_id`, `turn_id` corrente, release, e `associatedEventId` = ultimo evento Sentry della sessione. Niente screenshot, trascrizioni o audio. Lo sviluppatore lo ritrova in *User Feedback* filtrando per `test_run_id`.
- **Replay**: caricato in modo pigro (`lazyLoadIntegration`), **solo in modalità test**, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0`, `maskAllText`, `maskAllInputs`, `blockAllMedia`, nessun dettaglio di rete. In produzione solo sugli errori (decisione 3, §4).

### F5 — Dashboard e alert (sezioni G, H)

- Definizioni versionate in `docs/sentry/` (JSON delle dashboard e delle regole), applicate con uno script `scripts/sentry-setup.mjs` che usa l'API Sentry con un token personale (mai nel repository). Le regole di alert si possono creare anche dal plugin Sentry di Claude Code.
- 4 dashboard: *Affidabilità tecnica*, *Qualità didattica*, *Voce*, *Release* (widget come da sezione G; denominatori dai log `ai.request`, `activity.transition` e dagli span).
- Alert, separati per ambiente `test` e `production`:
  - critici: tasso di fallimento di `ai.generate` > X% su 10 min con almeno N richieste; `activity.progression_blocked` o `session.save_failed` ripetuti; picco di errori `/api/ai/generate`;
  - alti: nuove issue o picchi di `ai.language_mismatch`, `scoring.anomaly`, `audio.stt_failed`/`audio.tts_failed`.
  Soglie iniziali basse in `test`, da tarare dopo il primo ciclo; in produzione proporzionali al volume. Una notifica per issue (fingerprint) e frequenza massima di una ogni 30–60 min.

### F6 — Scenari simulati e report (sezioni J, K)

- **Iniezione di guasti** solo fuori da `production` (il server rifiuta di avviarsi se è attiva in produzione): header `X-Test-Fault: 500|429|timeout|wrong_lang|bad_score|bad_json`, accettato solo in modalità test, gestito da un decoratore del provider in `ai/decorators.go`.
- I 10 scenari della sezione J come test automatici:
  - Go: test con un transport Sentry finto che cattura gli eventi e verifica nome, categoria, identificativi (scenari 1–6, 10);
  - Vitest: telemetria mockata per duplicati, avanzamento bloccato, STT/TTS (scenari 4, 7–9);
  - un giro manuale contro l'ambiente `test` con `test_run_id` dedicato, per verificare che gli eventi arrivino davvero in Sentry.
- **Report**: `scripts/sentry-test-report.mjs --run <test_run_id>` interroga l'API Sentry (issue, eventi, feedback, log) filtrando per `test_run_id` e release, e produce un Markdown con: release, scenari eseguiti/superati (`test_result` inviato dal tester o dallo script), errori per categoria con frequenza e gravità, sessioni/turni coinvolti (`session_ref`, `turn_id`), link agli eventi, issue nuove (`firstSeen` nella release) vs già note vs regredite, risolte vs aperte.

## 4. Decisioni prese (3 novembre 2026)

1. **Lingua attesa** — verificata nel codice: *non* è la lingua dell'interfaccia del docente. È quella che `languageRules` (`app/prompts.go:309`) impone al personaggio: `config.language` del compito se il docente l'ha fissata (anche `pt` e `la`), altrimenti la lingua dell'interfaccia dello **studente** (`recipe.uiLang`). Il controllo usa la stessa funzione come unica fonte, così attesa e prompt non possono divergere. Il latino non viene rilevato (nessun warning), il portoghese sì. La valutazione usa `EvaluationRequest.locale`, da controllare a parte.
2. **Voto** — una risposta corretta al primo tentativo deve avere almeno **8**. Sotto 8 → `scoring.anomaly`.
3. **Replay** — attivo anche in produzione, solo sugli errori (`replaysOnErrorSampleRate: 1.0`, `replaysSessionSampleRate: 0`), con il mascheramento predefinito di testi e input di Sentry; in modalità test anche sessioni campionate.
4. **Database di test** — creato su Vercel il 3/11/2026: risorsa Turso `debateai-test` (`store_Dc3lBJRkHGaxi5vG`), stessa installazione Starter della produzione. Prima Preview e Development usavano il database di **produzione** (`TURSO_*` collegate a tutti e tre gli ambienti). Il 3/11 il database di produzione `debateai` è stato ricollegato al solo ambiente Production (URL e token invariati, verificati con hash e `select 1`) e `debateai-test` collegato a Preview e Development (`TURSO_*` diverse, `select 1` = 200). Poi aggiunti per Preview `APP_SECRET` proprio e `SENTRY_ENVIRONMENT=test`. Verificato con il redeploy `debateai-ixa9a29os…`: `/api/public/config` = 200 con `setupRequired: true` (database di test vuoto), mentre la produzione resta `setupRequired: false`. Al primo uso: creare l'amministratore del database di test dalla pagina di setup del preview.

## 5. Criteri di completamento (sezione L)

- [ ] Ogni chiamata AI fallita reale ha categoria, provider, modello, tentativi e identificativi.
- [ ] `turn_id` e `trace_id` collegano click, chiamata, generazione, voce e salvataggio.
- [ ] Le anomalie di lingua, voto, risposta e avanzamento producono warning raggruppati.
- [ ] Nessun testo, audio, trascrizione o dato personale negli eventi (test dell'allowlist + controllo manuale di un evento per tipo).
- [ ] I 10 scenari simulati producono gli eventi previsti.
- [ ] Il report confronta due run su release diverse.

## 6. Costi e rumore

- Log ed eventi positivi solo come log/span campionati, non issue.
- Warning con fingerprint stabili: una issue per tipo di problema.
- Replay solo in modalità test e solo su errore.
- Rivedere quote Sentry (errori, span, log, replay) dopo il primo ciclo di test.
