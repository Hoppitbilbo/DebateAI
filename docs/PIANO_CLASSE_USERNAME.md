# Classe permanente con username e password

Data: 29 ottobre 2026. Stato: **T1 e P1–P4 implementate sul branch `feat/classe-username`
(non pushato, non unito a master); P5–P7 e T2–T4 da fare**. Vedi «Stato di avanzamento» qui sotto.

## Stato di avanzamento (per chi riprende il lavoro)

**Fatto — T1, isolamento classi e inviti** (Codex, completata da Claude Code il 29/10):

- Gli inviti di classe a un account esistente non lo iscrivono più subito: `classService.Invite`
  crea sempre un invito; l'iscrizione avviene solo in `authService.Register` con la password
  dell'account (la pagina `/register` mostra già «Accetta invito» quando `userExists`).
  Il mittente vede sempre `invited`, senza sapere se l'account esiste. Account disabilitati → 403
  `disabled`. Uno studente invitato come docente resta studente nella classe.
  Rimossi `addExisting`, il template email `added` e la traduzione `platform.invite.status.added`.
- `sessionService.Load` non usa più `TeachesStudent` (rimosso): il docente legge e valuta
  solo il lavoro di una classe che gestisce, via `assignment_id` oppure via la nuova
  `activity_sessions.class_id`. La pratica libera resta visibile solo a studente e admin.
- `activity_sessions.class_id` (migrazione additiva, `json:"-"`, mai dal client): impostata
  dall'import di un'aula lampo (aperta o da file) alla classe di destinazione; i compiti di
  altre classi vengono staccati. Cancellare la classe azzera `class_id` anche senza foreign key.
- `classService.CanManage` richiede ruolo teacher; `Classes.Teaches` ignora appartenenze
  orfane di classi cancellate. Tutti gli endpoint docente passano da `managedClass`,
  `managedAssignment` o `CanManage`; gli endpoint globali sono solo `admin`.
- Test: `app/class_access_test.go`, `httpapi/class_access_test.go` (handler in-process, senza
  socket), `store/classes_test.go`, `store/rooms_test.go`, `migrations_test.go`.
  Verificati: `go vet`, `go test ./...`, `-race` su app e store, lint, TypeScript, Vitest 248,
  `check:i18n` 965, build.

**Fatto — P1 e P2, contratti e schema** (Claude Code, 29/10):

- Dominio: `User.Username`, `Member.Username` (omessi se vuoti; `email` resta stringa, `""`
  senza indirizzo), `NormalizeUsername` (regole §2), `Class.EnrollmentMode`
  (`standard`/`username`), `NewEnrollmentCode` (24 byte, base32, 39 caratteri) e
  `NewClassCode(mode)`, usato da creazione e «Rigenera». Errori `ErrUsernameTaken`,
  `ErrInvalidUsername`, `ErrEnrollmentClosed`.
- Schema: `users.email` nullable, `users.username` univoco `NOCASE`, `users.recovery_class_id`,
  vincolo `CHECK (email IS NOT NULL OR username IS NOT NULL)`; `classes.enrollment_mode`.
  `store/migrate_users.go` ricostruisce la tabella dei database esistenti all'avvio: connessione
  dedicata con foreign key spente (il `DROP` non deve propagarsi), una transazione, ricontrollo
  dopo il lock di scrittura (più avvii insieme la eseguono una volta sola), contatore
  AUTOINCREMENT conservato, `foreign_key_check` che non deve peggiorare. Diversamente da §8
  non c'è un comando separato: la migrazione è sicura anche se più istanze partono insieme.
  **Superato il 30/10 (commit `784e429`): la ricostruzione e le migrazioni additive sono state
  tolte, il database di produzione va ricreato vuoto (vedi «Database nuovo» sotto).**
- Repository: letture con `COALESCE` per email/username, `GetByEmail("")` non trova nulla,
  `GetByUsername`, ricerca anche per username, `Users.CreateStudentInClass` (account +
  appartenenza in una transazione che ricontrolla codice, modalità e classe attiva).
  `Classes.Delete` azzera anche `recovery_class_id`. `ClassSvc.Create` riceve `app.NewClass`
  (con `enrollmentMode`, default `standard`); `POST /api/classes` accetta il campo.
- Test: `store/migrate_users_test.go` (DB vecchio con dati in tutte le tabelle collegate,
  cascata dopo la ricostruzione, ID non riusati, quattro ricostruzioni concorrenti, iscrizione
  atomica, codice standard/rigenerato/classe archiviata, stesso username da 8 richieste insieme),
  `migrate_users_remote_test.go` (stessa migrazione su un server libSQL in Docker, verde;
  si salta senza `LIBSQL_TEST_URL`), `domain/user_test.go`.
- Spostati: tabella `password_resets` e migrazione dei token reset → P4; contatori persistenti
  `auth_rate_limits` → P3, dove vengono usati.

**Fatto — P3, registrazione e login** (Claude Code, 30/10, branch `feat/classe-username-p3`,
commit `b9dd945`, `e18820d`, `d5be42d`; non unito né pushato):

- Limiti persistenti: tabella `auth_rate_limits` (chiave HMAC, conteggio, scadenza) e
  `store.AuthRateLimits.Hit`, un solo upsert condizionale con pulizia delle righe scadute,
  provato anche su libSQL in Docker. `app.authLimits` conta il login per IP+identificatore
  (20/15 min), per identificatore (60) e per rete (1.200; IPv6 per /64), dal più specifico:
  chi ripete un identificatore bloccato non consuma il tetto della rete. Iscrizioni: 120
  tentativi/ora per link. Contatore non disponibile → 503, mai accesso. Il vecchio limite in
  memoria di 20 login/15 min per IP è tolto (restano in memoria `forgot` e `join`).
- `authService.RegisterClassStudent` (username normalizzato, password 8–72 byte, hash prima
  della transazione, `CreateStudentInClass`, nome = username, nessun ruolo/email dal client) e
  `ClassInvite` (solo nome e modalità). `hashPassword` rifiuta oltre 72 byte (prima: 500).
- `Login(identifier)`: con `@` è email, altrimenti username; tempo uguale per account
  inesistente (confronto con un hash fittizio); gli ospiti non entrano; «disattivato» solo con
  la password giusta.
- HTTP: `GET /api/auth/class-invite/{code}` (404 anche con `AllowJoinByCode` spento),
  `POST /api/auth/register-class` (201 + cookie; 400, 403 iscrizioni disattivate o ospite di
  aula lampo, 404, 409, 429, 503), entrambi `Cache-Control: no-store`. `/api/auth/login`
  accetta `identifier`, tiene `email`, 400 `ambiguous_identifier` se diversi.
  `POST /api/classes/join` funziona già col codice lungo (provato).
- Posta: `recipientGuard` avvolge il mailer di tutti i service (mai destinatario vuoto:
  `ErrNoRecipient` o log), la coda non accetta indirizzi vuoti, i notificatori saltano gli
  account senza email.
- Frontend minimo: `authApi.login` invia `identifier`, `classInvite`, `registerClass`; campo
  «Email o username» (`type=text`, `autocomplete=username`) in 5 lingue; tipi `username?`,
  `enrollmentMode`; testi d'errore `username_taken`, `unavailable`, `ambiguous_identifier`.
- Test: `store/rate_limits_test.go` (anche atomicità e libSQL), `app/auth_limits_test.go`,
  `app/class_enrollment_test.go` (doppio, concorrente, link standard/rigenerato/archiviato,
  password, retry dopo risposta persa, disattivato, ospite), `app/mail_guard_test.go`,
  `httpapi/class_enrollment_test.go` (handler in-process: ruolo forgiato, ospite, limiti per
  link, 40 studenti dallo stesso IP con errori che entrano tutti e rientrano, codice lungo),
  `authApi.test.ts`, test della pagina di login. Golden `shapes.json`: 4 risposte nuove.
- Non fatto in P3, da riprendere: limite delle richieste di login *in corso* (§7) non
  aggiunto; `ClassSvc.Join` legge la classe e poi aggiunge il membro in due istruzioni
  (una rotazione concorrente può ancora iscrivere col codice appena sostituito); un utente
  già loggato (non ospite) che usa `register-class` riceve la sessione del nuovo account:
  la pagina P6 deve proporre «Ho già un account»; il testo `inviteOnly` del login va rivisto
  in P6. Test HTTP con socket reali da eseguire in CI/staging.

**Fatto — P4, recupero e notifiche** (Claude Code, 30/10, branch `feat/classe-username-p4`,
commit `388e932`, `2759522`, `2e68c94`, `3452614`; non unito né pushato):

- **Decisione dell'utente (30/10): nessuna migrazione dei dati precedenti.** Il database
  esistente non ha dati da conservare: i token `invites` kind='reset' non vengono spostati in
  `password_resets` (niente migrazione né test relativo, a differenza di §4 e del punto 4 di §8)
  e `store/migrate_users.go` non è stato toccato (la sessione principale toglierà la
  ricostruzione legacy su `feat/classe-username` dopo il merge). Il recupero via email non scrive
  più in `invites`; nessun ripiego per i vecchi token. Tolta la costante `InviteKindReset`.
- Schema: `password_resets` nello schema (`CREATE TABLE IF NOT EXISTS`): `token_hash` univoco,
  `user_id` (CASCADE), `created_at`, `expires_at`, `consumed_at`, `issued_by` e `class_id`
  (CASCADE, impostati insieme solo per il recupero assistito: un link assistito non può mai
  sembrare un reset via email). `Users.Delete` e `Classes.Delete` tolgono i link anche senza
  foreign key.
- `store.PasswordResets`: `Issue` (invalida i precedenti dello stesso utente e pulisce gli
  scaduti; per il link assistito `INSERT … SELECT` con le regole, 0 righe → `ErrResetNotAllowed`),
  `Consume` (in una transazione: `UPDATE … WHERE consumed_at IS NULL AND expires_at > now` con le
  regole ricontrollate in SQL e controllo delle righe, nuovo hash, altri link invalidati, tutte
  le sessioni revocate), `Invalidate`, `Resettable(classID)`. Regole in un solo frammento SQL:
  studente attivo, senza email, non ospite, ancora studente della sua classe d'origine non
  archiviata; emittente attivo admin o docente proprietario.
- `authService` (`app/password_reset.go`): `RequestReset` per user_id (username, indirizzo
  vuoto o account senza email: nessun invio, nessun link, risposta invariata);
  `ResetPassword` calcola l'hash prima, poi `Consume`; `AssistedReset` (15 minuti,
  `assistedResetTTL`) con errori 403 `ErrResetForbidden` (co-docente, docente di altra classe,
  classe non d'origine), 404 `ErrNotClassStudent`, 409 `domain.ErrResetNotAllowed` (email,
  ospite, non studente, disattivato, classe archiviata). Al consumo ricontrollati emittente,
  appartenenza e classe.
- **Sessione dopo il reset:** come già faceva `handleReset` per l'email, il browser che sceglie la
  nuova password riceve una sessione; tutte le altre sono revocate. Aprire il link non dà nulla
  (pagina con i due campi). Chi emette il link non ottiene più di quanto potesse già fare.
  Il recupero via email ora richiede anche l'account attivo al consumo.
- Cambio password (`UpdateProfile`): password attuale e nuova verificate prima di scrivere;
  `Users.ChangePassword` salva nome/lingua/hash in una transazione che invalida i link e revoca
  tutte le sessioni; `PATCH /api/auth/me` dà al browser corrente una nuova sessione. Un errore
  non salva nulla (prima nome e lingua venivano scritti comunque). Il cambio password dall'admin
  invalida i link di reset.
- `ClassSvc.Join` atomico: `Classes.JoinByCode` fa `INSERT OR IGNORE … SELECT … WHERE join_code = ?
  AND archived = 0` e rilegge la classe sotto lo stesso lock (punto rimasto da P3, chiuso).
- HTTP: `POST /api/classes/{id}/members/{userId}/password-reset` → `{url, expiresAt}`,
  `no-store`; `/api/auth/reset` anche `no-store`, contratto invariato. Il dettaglio classe usa
  `ClassSvc.Members`: `Member.canResetPassword` vero solo per il proprietario/admin e gli studenti
  che rispettano le regole.
- Frontend minimo: `Member.canResetPassword`, `requestPasswordReset` in `teacherApi.ts` (con
  test), testo d'errore `reset_not_allowed` in 5 lingue. La pagina di reset funziona con i nuovi
  token senza modifiche (stesso contratto, provato dai test HTTP).
- Test: `store/password_resets_test.go` (uso singolo, sostituzione, scadenza, regole,
  proprietario cambiato, studente rimosso, classe archiviata/cancellata, emittente
  declassato/cancellato, account con email, 8 consumi concorrenti, `ChangePassword` atomico,
  `JoinByCode`), prova su libSQL in Docker (ora `store/remote_test.go`: link usato una volta),
  `app/password_reset_test.go` (proprietario e admin, co-docente, docente estraneo, classe non
  d'origine, ospite, email, archiviata, rimosso, cambio proprietario, emittente declassato o
  cancellato, nuova emissione, scaduto, riuso, due consumi concorrenti, sessioni revocate,
  vecchia password rifiutata, `forgot` per username, `canResetPassword`, password attuale
  sbagliata che non salva neanche nome/lingua), `httpapi/password_reset_test.go` (stessi casi
  attraverso gli handler in-process). Due test esistenti cambiati di proposito (il salvataggio
  parziale del profilo e l'errore del reset). Golden `shapes.json`: `canResetPassword` nei
  membri e la risposta nuova `member password reset`.
  Verifiche: `gofmt`, `go vet`, `go test ./...`, `-race` su app/store/httpapi, lint, TypeScript,
  Vitest 253, `check:i18n` 966, build.
- Non fatto in P4, da riprendere: il cambio password dell'admin (`PATCH /api/admin/users/{id}`)
  scrive i campi e poi la password senza transazione e non revoca le sessioni (invalida solo i
  link); non esiste un endpoint di trasferimento del proprietario (provato cambiando `owner_id`
  e cancellando l'emittente); limite delle richieste di login in corso (§7) ancora assente; i
  punti di P6 elencati in P3. Test HTTP con socket reali da eseguire in CI/staging.

**Fatto — database nuovo, niente migrazioni legacy** (Claude Code, 30/10, commit `784e429`):

- Decisione dell'utente: il database esistente non ha dati da conservare. Tolti
  `store/migrate_users.go` (ricostruzione di `users`), i suoi test e le 14 migrazioni additive
  di colonne: `schema` crea tutte le tabelle nella forma attuale. Il meccanismo
  `applyMigrations` resta, con elenco vuoto, per le modifiche dopo il rilascio.
- `requireCurrentSchema` rifiuta all'avvio un database di una versione precedente (errore
  chiaro invece di un guasto alla prima query). Test `TestOpenRefusesOldDatabase`;
  `store/remote_test.go` prova lo schema su libSQL in Docker (verde).
- **Rilascio:** il database Turso di produzione va svuotato (o sostituito da uno nuovo) prima
  del deploy; il server ricrea le tabelle al primo avvio e l'admin si ricrea da `/setup`.
  Operazione distruttiva: chiedere conferma all'utente in quel momento.

**Da fare, in quest'ordine:** P5 → P6 → T2 → T3 → P7/T4.
Piccola miglioria possibile: il testo dell'email d'invito dice «completa la registrazione»
anche a chi ha già un account; la pagina gestisce comunque il caso.

## 1. Risultato da ottenere

Dalla dashboard, il docente sceglie come iscrivere gli studenti quando crea una classe:

| Scelta | Primo ingresso dello studente | Accessi successivi | Conservazione |
| --- | --- | --- | --- |
| Inviti via email | Flusso attuale | Email e password | Permanente |
| Username e password, senza email | Link del docente → scelta username e password | Username e password | Permanente |
| Aula lampo, già esistente e separata | Codice/QR → nickname e avatar | Cookie o PIN docente | Temporanea, massimo 2 ore |

Il docente della classe permanente deve essere autenticato come docente o amministratore.
Attualmente l'amministratore può creare o invitare il docente; non esiste una registrazione
pubblica che assegni quel ruolo. Su richiesta successiva viene inclusa nel piano anche la
registrazione docente aperta, con verifica email e senza approvazione individuale dell'admin
(sezione 12). Il percorso su invito rimane disponibile. Il link studente non permette di scegliere il ruolo.

La nuova modalità riduce i dati richiesti: username e password, senza nome reale né email.
È un accesso con pseudonimo, non una promessa di anonimato: il docente vede attività,
conversazioni e risultati associati a quello username. L'interfaccia lo spiega in una frase.

## 2. Percorso minimo completo

### Docente

1. Dashboard → Nuova classe → nome, descrizione facoltativa e modalità d'iscrizione.
2. La scelta iniziale resta «Inviti via email», per conservare il comportamento attuale.
3. Con «Username e password» la pagina della classe mostra subito «Copia link» e QR.
4. Il link è condivisibile con tutti gli studenti. «Rigenera link» invalida quello precedente
   per nuove iscrizioni, ma non modifica gli account o le appartenenze già create.
5. Nella lista studenti si vedono pseudonimo, username, attività e azione di recupero quando
   il docente ne ha l'autorizzazione. Gli inviti dei co-docenti restano legati a un account docente.

### Studente

1. Il link apre `/iscriviti?code=…`, con nome classe e due campi: username e password.
2. Username usato anche come nome visualizzato iniziale; il nome reale non è richiesto.
3. Pulsante per mostrare/nascondere la password, indicazioni di lunghezza, supporto al password
   manager e messaggio chiaro se lo username è già occupato. Nessuna verifica pubblica separata
   della disponibilità: risponde l'invio del modulo.
4. Creazione dell'account, iscrizione come studente e accesso automatico.
5. Conferma con username, link al login e invito ad annotare le credenziali; poi dashboard studente.
   La password non entra in URL, log, analytics, email, localStorage o file di promemoria.
6. Chi ha già un account usa «Ho già un account», effettua il login e conferma l'iscrizione.
   Aprire il link con una sessione esistente non iscrive automaticamente e non cambia account.
7. Nei giorni successivi basta il login con username e password; il link classe non è necessario.
8. Menu Account → cambia password, riusando la pagina esistente.

Lo username è univoco sull'intera piattaforma: questo evita di dover chiedere classe o codice
a ogni login e consente allo stesso account di partecipare a più classi. Si normalizza con
trim e minuscole; prima versione: 3–30 caratteri ASCII, lettere, numeri, punto, trattino e
underscore, primo carattere alfanumerico. Sono esclusi `@`, spazi e caratteri di controllo.
La password conserva il requisito minimo di 8 caratteri, con limite esplicito di 72 byte per bcrypt.
La validazione autorevole è sul server; il browser la anticipa senza sostituirla.

## 3. Proprietà e confini dell'architettura

Si mantiene il percorso React → HTTP → service applicativo → repository → SQLite/libSQL.
Un account senza email è un normale `domain.User`, con ruolo `student` e senza `RoomID`.
Non si riutilizzano gli account effimeri dell'aula lampo: la loro scadenza sarebbe sbagliata.
Consegne, conversazioni, voti, dashboard, cookie e autorizzazioni continuano a usare `user_id`.

| Responsabilità | Proprietario |
| --- | --- |
| Normalizzazione username, modalità e invarianti delle entità | `domain/user.go`, `domain/class.go` |
| Validazione credenziali, hash, login, registrazione e recupero | `app/auth_service.go` |
| Modalità classe, autorizzazione del docente, rigenerazione link | `app/class_service.go` |
| Operazioni atomiche e vincoli di unicità | `store/users.go`, `store/classes.go`, repository recupero |
| JSON, cookie, status HTTP, protezioni delle richieste | `httpapi/auth.go`, `httpapi/classes.go`, middleware |
| Chiamate API e invalidazione cache | `features/auth/authApi.ts`, `features/teacher/teacherApi.ts` |
| Moduli, errori, navigazione e accessibilità | Pagine auth e componenti della dashboard docente |

Estendere gli attuali service e le interfacce in `app/repositories.go`, senza aggiungere un
secondo sistema di autenticazione, un service generico per identità, Redis, una gerarchia
di classi per i due tipi di aula o un framework di transazioni. Un file separato nello stesso
package è sufficiente quando la registrazione renderebbe troppo lungo `auth_service.go`.

Le transazioni che attraversano account e appartenenze sono operazioni di repository con
un nome di dominio, ad esempio `Users.CreateStudentInClass`; il service non riceve `*sql.Tx`.
Hash e validazioni che non dipendono dal database avvengono prima della transazione.

## 4. Modello dati e compatibilità

### Account

- `users.username TEXT NULL COLLATE NOCASE`, con vincolo univoco. `NULL` per account esistenti
  che accedono via email e per gli ospiti temporanei.
- `users.email` diventa nullable, mantenendo unicità e confronto senza distinzione di maiuscole.
  Un account nuovo senza email contiene `NULL`, mai una casella inventata o uno username
  mascherato da email. Gli ospiti esistenti non vengono convertiti da questa migrazione.
- `users.recovery_class_id INTEGER NULL`: classe che ha originato l'account senza email e
  il cui proprietario può assistere nel recupero. L'iscrizione ad altre classi non cambia questo campo.
- Password hash, ruolo, lingua, stato attivo, identificativo e timestamp restano quelli esistenti.
- Cancellazione utenti/classi e trasferimento del proprietario devono gestire anche i nuovi
  riferimenti e token, esplicitamente e in transazione dove libSQL non garantisce le foreign key.
  La cancellazione della classe azzera il riferimento di recupero e invalida i relativi token;
  non elimina gli account permanenti.
- `User.Username` e `Member.Username` diventano disponibili nelle risposte, omessi quando assenti.
  Per compatibilità, il JSON `email` rimane stringa: `""` quando non esiste una mail.
  Il repository legge correttamente `NULL` e non scarta righe in caso di errore di scansione.

Non usare `Email != ""` per distinguere studenti permanenti da ospiti: l'invariante resta `RoomID`.
Aggiornare tutte le query dirette che leggono email, incluse liste membri, avanzamento, export,
ricerca admin e import aula. Cercare anche username nella ricerca utenti. La visualizzazione
di username/email viene centralizzata in un piccolo helper frontend solo dove serve la stessa scelta.

### Classi e link

- `classes.enrollment_mode TEXT NOT NULL DEFAULT 'standard'`, valori ammessi `standard` e `username`.
  Le classi esistenti e le classi nascoste delle aule lampo conservano `standard`.
- La modalità riguarda l'iscrizione, non modifica i permessi delle attività né vieta account
  esistenti con email. Nessuna conversione automatica delle classi esistenti nella prima versione.
- Riutilizzare `classes.join_code` come identificatore del link. Per le nuove classi `username`
  generare 24 byte casuali, codificati in base32 senza padding; non riutilizzare il codice breve
  di sei caratteri come autorizzazione pubblica alla creazione di account permanenti.
- Il codice lungo viene mostrato solo tramite le API autorizzate del docente. Gli studenti
  ricevono il link/QR, senza necessità di trascrivere il codice lungo. Non è un token di login.
- La rigenerazione sceglie la lunghezza in base alla modalità e controlla gli errori di generazione
  casuale e le eventuali collisioni. Il codice resta memorizzato come quello attuale, per poter
  ricopiare lo stesso link dalla dashboard; evitare di registrarlo nei log applicativi.
- Riutilizzare `AllowJoinByCode` anche come interruttore degli ingressi dal nuovo link.
  Archiviare una classe blocca nuovi ingressi. Il controllo deve essere sul server.

### Recupero password

Gli attuali token di recupero in `invites` individuano l'account tramite email: questo non basta
per un account senza email. Introdurre `password_resets`, con `token_hash` univoco, `user_id`,
`created_at`, `expires_at`, `consumed_at` e, per il recupero assistito, `issued_by` e `class_id`.
Il token in chiaro viene restituito o inviato una sola volta; in database si conserva solo l'hash.

Spostare anche il recupero email esistente sullo stesso percorso per `user_id`, migrando i token
`kind='reset'` ancora utilizzabili senza cambiarne hash e scadenza. Gli inviti alla piattaforma
restano in `invites`. Un piccolo repository `PasswordResets` possiede emissione, invalidazione
e consumo atomico: è una responsabilità concreta, condivisa dai due percorsi di recupero.

## 5. Registrazione e autorizzazioni

`Accounts.RegisterClassStudent` riceve solo codice, username, password e lingua.
Non accetta ruolo, owner, identificativo studente o email dal nuovo modulo.

1. Valida formato, password e lingua; legge la classe e verifica modalità e stato.
2. Prepara l'hash bcrypt.
3. Il repository, in una transazione di scrittura, ricontrolla codice corrente, modalità,
   classe attiva e disponibilità dello username; inserisce account e appartenenza `student`.
4. Imposta `recovery_class_id` solo durante la creazione dell'account.
5. Commit, poi avvio della sessione con il meccanismo cookie esistente.

L'indice univoco decide in caso di richieste concorrenti per lo stesso username. Un errore
di iscrizione annulla anche l'account; il service non tenta una cancellazione compensativa.
Una rotazione o archiviazione concorrente deve risultare ordinata rispetto all'iscrizione,
mai lasciare un account privo di appartenenza. Provare la semantica anche su libSQL remoto.
Se il commit riesce ma la risposta/cookie si perde, lo studente può usare le credenziali già
scelte: non cancellare un account valido e non crearne un secondo al retry.

Per l'account esistente il link richiede autenticazione e conferma esplicita. Si riusa
`ClassSvc.Join`, rinforzando nello stesso repository i controlli di codice e classe attiva.
L'operazione è idempotente: un membro già presente non cambia ruolo. Gli ospiti di aula
lampo non possono trasformare la propria sessione temporanea in un account permanente.

### Recupero assistito, senza email

- Il proprietario della classe d'origine, oppure un admin, genera un link valido 15 minuti
  dalla riga dello studente. Lo consegna personalmente dopo aver identificato lo studente.
- Si applica solo ad account attivi `student`, senza email, non ospiti, ancora membri della
  classe d'origine attiva. I co-docenti e i docenti di altre classi non hanno questa autorità.
- Un docente che aggiunge alla propria classe un account esistente non acquisisce il diritto
  di reimpostarlo. Il frontend riceve `canResetPassword` dal server, ma il server ricontrolla sempre.
- Il link non dà una sessione né mostra password o conversazioni: permette di scegliere una
  nuova password. Il consumo ricontrolla anche i permessi dell'emittente e l'appartenenza.
- Emissione nuova invalida i precedenti token; consumo, aggiornamento hash, invalidazione
  degli altri token e revoca delle sessioni avvengono nella stessa transazione.
- Due richieste contemporanee con lo stesso token: una sola riesce. Riutilizzo, scadenza,
  cambio proprietario o rimozione dello studente rendono inutilizzabile il link assistito.
- Se la classe d'origine è archiviata o cancellata, interviene l'admin. Rimuovere una classe
  non cancella automaticamente l'account e i lavori in altre classi.

Anche il cambio password dal menu Account verifica prima tutti i dati e la password attuale,
poi salva atomicamente e revoca le vecchie sessioni/token; il browser corrente riceve una nuova
sessione. L'attuale `UpdateProfile` scrive nome/lingua prima di verificare la password: correggere
questa sequenza nell'operazione interessata, evitando salvataggi parziali su un errore.

## 6. Contratto HTTP e frontend

| Endpoint | Evoluzione prevista |
| --- | --- |
| `POST /api/classes` | Campo facoltativo `enrollmentMode`, default `standard`; solo teacher/admin come oggi |
| `GET /api/classes/{id}` | Modalità, link ricostruibile e autorizzazioni di recupero per i membri; solo gestori |
| `POST /api/classes/{id}/code` | Rigenera codice/link in base alla modalità, permessi invariati |
| `GET /api/auth/class-invite/{code}` | Nuovo: nome classe e modalità; niente studenti, email o dati del docente |
| `POST /api/auth/register-class` | Nuovo: `{code, username, password, locale}` → utente e cookie |
| `POST /api/auth/login` | Accetta `identifier` (username o email); mantiene `email` per i client precedenti |
| `POST /api/classes/join` | Riutilizzato per utenti già autenticati; verifiche sul codice in transazione |
| `POST /api/classes/{id}/members/{userId}/password-reset` | Nuovo: autorizzazione stretta descritta sopra → link e scadenza, `Cache-Control: no-store` |
| `POST /api/auth/reset` | Contratto token/password invariato; nuovo consumo atomico per `user_id` |
| `PATCH /api/auth/me` | Nome/lingua e cambio password esistenti, con salvataggio coerente e revoca sessioni |

Il login distingue gli identificatori perché lo username non contiene `@`. Se il client
invia `identifier` ed `email` diversi, la richiesta è ambigua e viene rifiutata. Account disabilitati
e ospiti temporanei non aggirano i controlli tramite il nuovo identificatore.
La ricerca per email rifiuta un valore vuoto: non deve mai selezionare un account senza email.
Errori espliciti: input non valido 400, credenziali errate 401, azione vietata 403, invito
inutilizzabile 404, username occupato 409, troppe richieste 429. Il login non rivela se esiste
un account; nessun errore SQL o hash viene esposto al browser.

Frontend: estendere `ClassCreateDialog`, `ClassMembers`, tipi in `lib/api.ts` e API feature;
aggiungere una pagina compatta d'iscrizione nella cartella auth e la rotta in `App.tsx`.
Riutilizzare layout, campi, azioni occupate, clipboard, QR e pagina Account esistenti.
Login con etichetta «Email o username», `type=text`, `autocomplete=username`; `new-password`
per la creazione. Messaggi in tutte e cinque le lingue, focus sugli errori, controlli da tastiera,
stato di invio che impedisce doppi click, URL `next` limitati a percorsi interni del sito.
Non allargare indiscriminatamente il componente `AuthPages`: estrarre campi/layout condivisi
solo se necessari al riuso, evitando dipendenze circolari tra pagine.

## 7. Accessi simultanei dalla scuola e notifiche

Correggere il limite corrente di 20 login/15 minuti per solo IP, che conta anche gli accessi
riusciti. La chiave principale diventa IP + identificatore normalizzato: una classe di studenti
diversi non condivide più quel contatore. Conservare un tetto di rete molto più ampio contro
tentativi su migliaia di username e un limite per identificatore contro attacchi da IP diversi.

Per la versione distribuita su Vercel, i contatori di autenticazione/iscrizione devono essere
atomici in SQLite/libSQL, non solo nella mappa del singolo processo. Aggiungere un piccolo
repository per finestre a scadenza (`auth_rate_limits`: chiave, conteggio, scadenza), con incremento
condizionale e pulizia delle righe scadute. Riutilizzare la base dati, senza dipendenza Redis.
Riservare il tentativo prima di bcrypt, limitare anche le richieste in corso, fallire senza
autenticare se il controllo dei limiti non è disponibile. Le chiavi persistite sono hash/HMAC,
senza conservare email, username o IP in chiaro nei contatori.

Valori iniziali da fissare in costanti nominate e verificare: 20 tentativi/15 minuti per coppia
IP-identificatore, 60 per identificatore e 1.200 per rete; iscrizioni con limite distinto di
120 nuovi account/ora per link. Il test di classe deve includere 40 studenti sullo stesso IP,
errori occasionali e nuovo accesso. Non riutilizzare il limite del login per bloccare tutta la classe
alla prima password errata. Nessun limite applicativo promette protezione DDoS dell'infrastruttura.

Aggiornare i notificatori: nessuna email per account privi di indirizzo. Consegne e feedback
rimangono visibili in dashboard. Il guard condiviso per l'invio deve evitare destinatari vuoti
anche nel recupero e nella posta in coda; niente email fittizie e niente fallimenti silenziosi.

## 8. Migrazione e rilascio

`users.email` è oggi `NOT NULL UNIQUE`: non basta aggiungere una casella nel modulo.
La modifica richiede una migrazione reale della tabella `users`, preservando ID, hash,
collation, indici e tutti i riferimenti. SQLite non rimuove `NOT NULL` con un semplice
`ALTER COLUMN`. Usare ricostruzione controllata della tabella, non `writable_schema`.

1. Fixture con schema precedente, utenti, ospiti, inviti, sessioni, classi e risultati.
2. Migrazione versionata, transazionale e rieseguibile, con accesso esclusivo alle scritture.
   La migrazione strutturale non va affidata a più cold start simultanei di Vercel: eseguirla
   una volta in finestra controllata; gli avvii verificano la versione. Le attuali migrazioni
   additive restano compatibili, ma non sono sufficienti per questa operazione.
3. Su SQLite seguire la ricostruzione con gestione delle foreign key sulla stessa connessione,
   fuori/dentro transazione dove richiesto; validare `foreign_key_check` prima del rilascio.
   Verificare su libSQL remoto le operazioni realmente supportate: non assumere che PRAGMA,
   DDL e transaction funzionino identicamente al driver locale.
4. Confrontare conteggi e contenuti, riaprire il database, rieseguire la migrazione e simulare
   un errore intermedio. Zero perdita di account, relazioni, password o token reset ancora validi.
5. Backup verificato prima dell'applicazione; prova su database di staging separato dalla produzione.
6. Distribuire backend e frontend compatibili; gli accessi email restano funzionanti. Mostrare
   la nuova modalità solo con backend pronto. Aggiornare i contratti JSON intenzionalmente.
7. Dopo aver creato account con email `NULL`, il vecchio backend non è più un rollback sicuro:
   serve una versione compatibile con il nuovo schema e nuovi account. In caso di guasto,
   disabilitare nuovi ingressi con l'impostazione esistente e correggere in avanti; non ripristinare
   un backup perdendo le attività successive. Il backup serve al ripristino controllato pre-apertura.

## 9. Sequenza di lavoro e prove di accettazione

Ogni fase è una modifica funzionale separata dai task di refactoring. Le caselle si spuntano
solo quando codice e prove della fase sono presenti; questo documento non le dichiara eseguite.

- [x] **P1 — Contratti e test di caratterizzazione.** Fissare accessi email, inviti docenti,
  cambio password, iscrizione e ospiti attuali. Definire DTO, invarianti e casi della nuova modalità.
- [x] **P2 — Schema e repository.** Migrazione, username univoci, modalità/link, creazione
  atomica account+appartenenza, query nullable, recupero per user ID e limiti persistenti.
  Provare migrazione da DB precedente e concorrenza su SQLite e libSQL.
- [x] **P3 — Registrazione e login.** Service, handler, cookie e compatibilità del campo `email`.
  Provare username normalizzato/doppio, password invalida, invito standard o revocato,
  classe archiviata, account disabilitato, ruolo forgiato, rollback e perdita della risposta.
- [x] **P4 — Recupero e notifiche.** Recupero assistito, consumo una sola volta, revoca sessioni,
  cambio password atomico e nessun invio a indirizzi assenti. Provare docente estraneo,
  co-docente, cambio proprietario, studente rimosso, token scaduto e due consumi concorrenti.
- [ ] **P5 — Dashboard docente.** Selettore modalità, copia/QR, rigenerazione, membri e recupero
  autorizzato. Provare doppio invio, errore rete, navigazione da tastiera e schermo mobile.
- [ ] **P6 — Studente e traduzioni.** Iscrizione, login, conferma credenziali, account esistente,
  ritorno alla classe dopo login e pagina Account. Test UI dei percorsi riusciti e degli errori.
- [ ] **P7 — Prova completa e rilascio.** Browser docente → link → studente senza email →
  attività salvata → logout → altro browser → login username → stessi risultati → cambio password
  → vecchia password/sessione rifiutate → recupero assistito. Anche 40 accessi dallo stesso IP,
  classe email preesistente e aula lampo senza regressioni. Una conversazione reale in staging
  verifica il percorso fino al provider AI; i test automatici usano un provider simulato.

Comandi previsti: Go vet e test, race test sulle operazioni concorrenti; lint, TypeScript,
Vitest, build e `check:i18n`. Il golden del contratto è oggi in
`server/internal/httpapi/testdata/shapes.json`; aggiornare con
`UPDATE_SHAPES=1 go test ./internal/httpapi -run ResponseShapes` dalla cartella `server`.
Il percorso in alcune istruzioni storiche del refactoring è precedente allo spostamento in httpapi.

La sandbox corrente non permette i socket dei test HTTP: usare test handler in-process
dove appropriato e completare il percorso con socket in CI/staging. Non dichiarare verde
un test non eseguito. Le verifiche del documento `ACCESSO_CLASSE.md` riguardano il codice
precedente, non certificano questa funzionalità futura.

## 10. Priorità e confine della prima versione

Per l'uso in classe servono tutte le fasi P1–P7: il recupero senza email, i limiti per rete e
la migrazione sicura fanno parte del minimo completo. Non si promette disponibilità per la
lezione prima della prova su staging; l'aula lampo resta l'alternativa già disponibile.

L'email facoltativa proposta nella prima verifica può arrivare in una seconda consegna:
indirizzo di recupero verificato con token, promemoria con username/link del sito, cambio e
rimozione dell'indirizzo protetti dalla password corrente. Mai inviare la password.
L'iscrizione degli studenti è utilizzabile senza SMTP grazie al recupero docente e al promemoria
a video; la nuova registrazione pubblica dei docenti richiede invece email funzionanti.
Questa seconda consegna non è implementata né inclusa nelle caselle P1–P7.

Non rientrano nella prima versione conversione automatica di classi/account esistenti,
cambio username, OAuth, SSO e account separati per ogni classe. La registrazione docente
pubblica è ora inclusa tramite le fasi T1–T4 sotto; deve superarle prima dell'abilitazione.

## 11. Fonti nel repository

Verificati: `AGENTS.md`, `docs/REFACTORING.md`, `docs/ACCESSO_CLASSE.md`, `docs/VERCEL.md`,
`server/internal/domain/{user,class}.go`, `server/internal/store/{schema,users,classes,invites}.go`,
`server/internal/app/{auth_service,class_service,repositories,services,notify}.go`,
`server/internal/httpapi/{auth,classes,admin,server,limits}.go`,
`src/pages/dashboard/teacher/{ClassCreateDialog,ClassMembers}.tsx`,
`src/pages/auth/AuthPages.tsx`, `src/features/{auth/authApi,teacher/teacherApi}.ts`, `src/lib/api.ts`.

## 12. Registrazione pubblica dei docenti — estensione richiesta

### Percorso e attivazione

Login → «Crea account docente» → email → messaggio con link di verifica → scelta nome
visualizzato e password → account docente attivo → dashboard → creazione della prima classe.
La password si sceglie dopo aver aperto il link, così chi inserisce un'email altrui non imposta
in anticipo le credenziali di chi poi la verifica. La verifica prova il controllo della casella,
non una qualifica professionale; non richiedere un dominio scolastico o approvazione individuale.

Aggiungere `GeneralSettings.AllowTeacherSignup`, inizialmente `false` nelle installazioni
esistenti per evitare di aprirle con un aggiornamento. L'admin può attivarlo una volta; da quel
momento chiunque può registrarsi come docente verificando l'email. Esporre in configurazione
pubblica solo la disponibilità effettiva: opzione attiva, setup concluso e SMTP configurato.
Il server verifica queste condizioni all'emissione e al consumo del link; spegnere l'opzione
blocca nuove registrazioni e link pendenti, senza disabilitare i docenti già registrati.

### Riuso del sistema esistente

- `authService` possiede richiesta e completamento; `settingsService` l'impostazione;
  notificatore/outbox e template localizzati esistenti inviano il messaggio.
- Riutilizzare `invites` con un tipo distinto `teacher_signup`: email normalizzata, ruolo
  `teacher` fissato dal server, nessuna classe, nessun inviter, hash del token e scadenza 30 minuti.
  Non creare un account prima della conferma e non introdurre un ruolo «pending».
- `POST /api/auth/teacher-signup` riceve solo email e lingua e risponde 202 generico, senza
  rivelare se l'indirizzo esiste. Il link porta a `/docente/registrati?token=…`.
- `POST /api/auth/teacher-signup/complete` riceve token, nome, password e lingua. In un'unica
  transazione ricontrolla tipo/scadenza del token, crea l'account con email e ruolo teacher,
  consuma il token e invalida gli altri token di signup per quell'indirizzo; poi avvia la sessione.
  È un metodo concreto del repository account, non una sequenza di scritture indipendenti.
- La registrazione già esistente su invito deve accettare solo `kind=invite`; quella nuova
  solo `kind=teacher_signup`. Un link di reset, studente o admin non può essere scambiato per questo.
- Un indirizzo già associato a un account non crea duplicati e non ne cambia ruolo/password.
  Uno studente esistente resta studente: l'eventuale cambio ruolo continua a essere amministrativo.
- Apertura GET del link non consuma il token, per tollerare gli scanner delle email. Errori di
  invio o consegna lasciano la richiesta ripetibile, senza account mezzo creato. Pulsante «Invia
  di nuovo» con attesa, limiti per indirizzo e rete e pulizia dei token scaduti. Non invalidare un
  link ancora valido a ogni richiesta anonima di reinvio; il completamento invalida gli altri.
- Token e credenziali esclusi dai log, risposte `no-store`, nessun invio della password.
  Migliorare il percorso `next` solo con destinazioni interne; dopo signup andare alla dashboard.

### Isolamento obbligatorio prima dell'apertura

La verifica del codice ha trovato due comportamenti esistenti incompatibili con la nuova apertura:
`classService.Invite` aggiunge subito gli utenti esistenti tramite `addExisting`, e
`sessionService.Load` usa `TeachesStudent` come ripiego anche quando la sessione appartiene
a una consegna di un'altra classe. Non basta aggiungere il pulsante di registrazione.

1. Gli inviti email dei docenti a utenti esistenti diventano proposte da accettare con l'account
   corretto o verificandone la password; nessuna appartenenza immediata basata sulla conoscenza
   di un indirizzo. Conservare il ruolo corrente e non rivelare stato/nome dell'account al mittente.
2. La lettura e il feedback del docente richiedono una relazione con la **classe del lavoro**,
   non soltanto con lo studente. Se la consegna appartiene a un'altra classe, rifiutare senza
   ricadere sul controllo generico. Le esercitazioni libere restano visibili a studente e admin.
3. Per i risultati importati da aula lampo senza `assignment_id`, conservare una provenienza
   esplicita tramite `activity_sessions.class_id` nullable, impostata dal server alla classe
   di destinazione dell'import. Il browser non può scriverla. Controllare tale classe per
   lettura, feedback ed export; non dedurla dalle appartenenze attuali dello studente.
   Se un import storico ha perso la provenienza, non inventarla: resta accessibile a studente
   e admin finché non può essere associato con prove. Classe cancellata → nessun nuovo accesso docente.
4. Estendere P2/P4/P7 con questa migrazione e questi controlli, centralizzati nel service delle
   sessioni e nei repository. Provare anche accesso diretto per ID, export, feedback, classi
   archiviate/cancellate, import e docenti co-responsabili. La gestione dell'aula temporanea
   mantiene la propria autorizzazione tramite docente/chiave host.
5. I nuovi docenti non accedono a elenco globale utenti, configurazione, chiavi AI, altri docenti
   o classi altrui. Rivedere gli endpoint docente con questo vincolo, oltre al solo ruolo teacher.

Queste sono modifiche funzionali di autorizzazione, da dichiarare nei test e nel registro:
la compatibilità con i vecchi inviti non significa conservare l'aggiunta automatica dello studente.

### Limiti di iscrizione e uso AI

Riutilizzare i contatori atomici previsti nella sezione 7 per richiesta/reinvio e consumo dei
token; nessun captcha o provider di identità aggiuntivo nella prima versione.
Oggi `httpapi.aiAllowed` applica la quota giornaliera solo agli studenti: aggiungere una quota
docente esplicita (`TeacherRequestsPerDay`, default 400, positiva quando il signup è aperto),
usando il conteggio e l'ammissione delle richieste esistenti, con prenotazione atomica per non
superare il limite con richieste concorrenti. Vale per tutti i docenti, così non si creano due
categorie di account con permessi diversi. Gli admin conservano la gestione delle quote.
La verifica comprende chat, utility, valutazione e voce: nessun percorso deve aggirare
l'ammissione. Restano i limiti degli studenti e delle aule e il budget condiviso del gateway.
Prima dell'apertura verificare un tetto di spesa finito con blocco dei modelli a pagamento
nel sistema di budget già esistente; non cambiare automaticamente provider, prezzi o budget
di produzione durante la scrittura del piano. Nessuna quota per account elimina gli abusi
tramite molti account: il tetto globale resta necessario per contenere la spesa.

### Fasi aggiunte e accettazione

- [x] **T1 — Isolamento classi e inviti.** Correggere i due comportamenti sopra, preservare
  la provenienza degli import e provare due docenti con uno studente in comune. Nessuno deve
  leggere o valutare il lavoro dell'altra classe, nemmeno conoscendo email o ID della sessione.
- [ ] **T2 — Signup e verifica email.** Impostazione, API, inviti tipizzati, template, consumo
  atomico e cookie. Test email già registrata, account disabilitato, escalation di ruolo,
  token sbagliato/scaduto/riutilizzato, doppio consumo concorrente, SMTP assente ed errore invio.
- [ ] **T3 — Interfaccia e quote.** Registrazione da login, messaggio email inviata, reinvio,
  scelta credenziali dopo verifica, errori comprensibili e traduzioni. Quota docente e limiti
  signup verificati su più istanze; chiusura signup rispettata anche da richieste dirette.
- [ ] **T4 — Prova completa.** Email reale in staging → verifica → docente → classe con username
  → studente → attività → risultati visibili solo al docente corretto. Provare anche classe
  standard, inviti admin preesistenti e chiusura iscrizioni. Completa P7 per il flusso pubblico.

L'apertura pubblica richiede T1–T4 oltre alle fasi pertinenti P1–P7. Questa estensione aggiorna
il piano; nessun endpoint, impostazione o permesso di produzione è stato modificato.
