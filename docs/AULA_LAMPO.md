# Aula lampo: accesso con codice, senza registrazione degli studenti

Ultimo aggiornamento: 28 ottobre 2026 · Stato: **specifica approvata nelle scelte, implementazione da iniziare**

Feature aggiuntiva, isolata dal resto: non cambia il comportamento delle classi, delle consegne
o dell'accesso ospite esistente. Va sviluppata su un branch a parte (`feat/aula-lampo`), non
dentro le fasi di `REFACTORING.md` (regola 1: niente cambi funzionali nei task di refactoring).

---

## Obiettivo

Un docente (anche supplente, anche senza account) apre un'aula temporanea in pochi secondi.
Gli studenti vanno su `/entra`, scrivono il codice, scelgono nickname e avatar e lavorano.
Dopo al massimo **2 ore** l'aula e tutti i suoi dati vengono cancellati, a meno che il
docente non li abbia esportati o importati in una sua classe.

## Decisioni prese

| Tema | Scelta |
|---|---|
| Docente | Con account **oppure** senza registrazione (link segreto docente) |
| AI | Provider e chiave dedicati scelti dall'admin (es. modelli gratuiti DeepSeek / Gemini Flash) |
| Dati | Export xlsx + pacchetto JSON firmato; import in una classe abbinando nick → studente, oppure "cancella tutto" |
| Deploy | Vercel Hobby (cron al massimo giornaliero) + Turso |
| Redis | **Non serve** (vedi sotto) |
| Rete scolastica | Molti studenti con lo **stesso IP**: nessun limite per-IP sugli studenti |

---

## Flusso

**Docente**
1. `/aula/nuova`: titolo, attività (o una consegna di una sua classe se ha l'account), durata 30/60/90/120 min.
2. Schermo da proiettare: codice grande, QR, `sito/entra`, conto alla rovescia, lobby con avatar.
3. Comandi: blocca ingressi, espelli, approva rientro, termina e cancella.
4. A 15 minuti dalla fine: "Scarica i risultati o importali in una classe prima che vengano cancellati".

**Docente senza account**: alla creazione riceve un **link docente segreto** (`/aula/gestisci#<token>`)
da salvare; un cookie lo tiene collegato su quel browser. Può solo scaricare l'export: per
importare in una classe serve un account (può crearlo dopo e importare il file).

**Studente**
1. `/entra` (o QR con il codice già compilato) → codice → nickname (max 20 caratteri,
   suggerimento "nome + iniziale") → avatar → dentro.
2. Se chiude la scheda, il cookie lo fa rientrare. Se cambia PC, reinserisce codice e lo stesso
   nickname: il docente vede "Marco vuole rientrare" e approva.

---

## Modello dati (Turso/SQLite, stesso DB)

**Ogni ospite è un account studente effimero** (`users`, e-mail segnaposto `guest-…@aula.invalid`,
senza password) legato all'aula da `room_guests`. Così chat, giudice JEV, stati della sessione,
limite giornaliero per studente ed export funzionano senza modifiche: le pagine attività
vedono un utente loggato. Il cookie di login dell'ospite scade insieme all'aula.

```sql
CREATE TABLE rooms (
  id, code UNIQUE, host_token_hash UNIQUE, teacher_id NULL, assignment_id NULL,
  title, instructions, app_type, locked, max_guests, created_at, expires_at
);
CREATE TABLE room_guests (
  user_id PRIMARY KEY → users, room_id → rooms, nickname COLLATE NOCASE, avatar,
  rejoin_pin_hash, rejoin_expires_at, UNIQUE (room_id, nickname)
);
```

- Nessuna colonna nuova sulle tabelle esistenti: `User.RoomID` è letto con una sottoquery su
  `room_guests`. Gli ospiti sono esclusi da elenco utenti e conteggi admin.
- La cancellazione **non si affida a `ON DELETE CASCADE`** (su Turso le foreign key potrebbero
  non essere applicate): `store.Rooms` cancella esplicitamente, in una transazione, sessioni,
  login, account e righe dell'aula; in `usage_log` azzera solo `user_id` (i costi restano).
- Import in classe: `UPDATE activity_sessions SET user_id = <studente>` per gli ospiti abbinati,
  poi cancellazione dell'aula.
- **Rientro:** il docente genera un PIN di 4 cifre (valido 10 minuti) per un ospite; lo studente
  inserisce codice aula + nickname + PIN su qualsiasi PC.

## Cancellazione (Vercel Hobby)

1. **Blocco immediato:** ogni richiesta ospite/docente controlla `expires_at`; scaduta → 410,
   cookie rifiutato. I dati sono inaccessibili dal minuto esatto di scadenza.
2. **Purge pigro:** `rooms.PurgeExpired(now)` all'inizio di ogni richiesta `/api/room*`
   e `/api/guest*` (una `DELETE ... WHERE expires_at < ?` indicizzata, costo trascurabile).
3. **Cron di sicurezza giornaliero** (`/api/cron/purge-rooms`, protetto da `CRON_SECRET`):
   copre il caso di un'aula scaduta senza più traffico. Su Hobby non si può fare più spesso, e
   non serve grazie ai punti 1 e 2.
4. In Docker/locale: goroutine con ticker ogni 5 minuti.
5. Pulsante **"Termina e cancella ora"**.

## Redis: serve?

Valutato Upstash Redis dal Marketplace Vercel. **Conclusione: no.**

| Cosa darebbe Redis | Perché non serve qui |
|---|---|
| TTL nativo: le chiavi si cancellano da sole | Le sessioni devono finire nelle stesse tabelle di `activity_sessions` per riusare chat, giudice, xlsx e import: con Redis dovremmo copiarle in Turso, quindi due repository e un trasferimento. Il blocco su `expires_at` + purge pigro dà lo stesso risultato. |
| Rate limit globale tra istanze Vercel | Per gli ospiti il limite si conta in DB (`usage_log` per sessione/aula, come `CountUserRequestsSince`), già globale. Il limiter in memoria resta solo come prima difesa anti-flood. |
| Lobby in tempo reale (pub/sub) | Polling della lobby ogni 3 s solo dallo schermo del docente: 40 req/min, irrilevante. |
| Costo/complessità | Un servizio, una variabile d'ambiente e un modo di guasto in più per una feature secondaria; il piano gratuito ha un tetto di comandi al giorno che una classe in chat può consumare. |

Da riconsiderare solo se servisse un rate limit globale per **tutto** il sito.

## Stesso IP per tutta l'aula PC

Dietro il router della scuola 25-30 PC escono con lo stesso IP (spesso anche lo stesso del
docente). Regole:

- **Nessun limite per-IP sulle richieste AI degli ospiti.** Limiti per ospite (cookie) e per aula:
  `requestsPerGuestPerHour` e `maxRequestsPerRoom`, contati in DB.
- **Join:** limite per **codice aula** (`max_guests` + aula bloccabile), non per IP.
- **Anti-brute-force sui codici:** limite per IP solo sui codici **sbagliati** e largo
  (es. 60 errori / 10 min per IP), sufficiente contro i bot (31^6 ≈ 887 milioni di codici)
  e tollerante con 30 ragazzi che sbagliano a digitare.
- **Creazione aule senza account:** limite per IP alto (es. 20/giorno), più il tetto di spesa
  dell'admin. Le aule con account non hanno limite per IP.
- `clientIP` su Vercel: usare `X-Forwarded-For` come oggi, mai come identità dello studente.
- Nota: anche l'accesso ospite **esistente** (`GuestRequestsPerHour`, chiave `guest:<IP>`)
  soffre dello stesso problema in aula PC; l'aula lampo è la soluzione consigliata ai docenti.

## AI: provider dedicato (pannello admin)

Nuova impostazione `rooms` nella tab admin "Aula lampo":

```go
type RoomSettings struct {
    Enabled                 bool                     `json:"enabled"`
    AllowAnonymousTeachers  bool                     `json:"allowAnonymousTeachers"`
    MaxMinutes              int                      `json:"maxMinutes"`      // ≤ 120
    MaxGuests               int                      `json:"maxGuests"`       // default 40
    RequestsPerGuestPerHour int                      `json:"requestsPerGuestPerHour"`
    MaxRequestsPerRoom      int                      `json:"maxRequestsPerRoom"`
    AnonymousRoomsPerIPDay  int                      `json:"anonymousRoomsPerIpDay"`
    Tasks                   map[string][]RouteTarget `json:"tasks"`           // chat, evaluation, utility, judge
    FreeOnly                bool                     `json:"freeOnly"`
}
```

- L'admin aggiunge il provider (es. DeepSeek, OpenRouter con modelli `:free`, Gemini) con la sua
  chiave nella sezione Provider esistente (chiave cifrata come oggi), poi lo seleziona per i task
  dell'aula lampo.
- `aiGateway.TargetsFor(profile, task)`: profilo `rooms` usa `RoomSettings.Tasks`; se un task è
  vuoto ripiega sul routing normale filtrato con `freeOnly` (decorator già esistente).
- `FreeOnly` (default true per le aule senza account): solo target con prezzo noto a zero.
- Live/voce disabilitato nelle aule lampo (costi e chiavi effimere da gestire).

## Export e import

- **xlsx:** riusa il generatore di `grades.xlsx` (colonne: nickname, avatar, attività, turni,
  punteggi, valutazione, riflessione).
- **JSON firmato:** `{version, room:{title, appType, createdAt}, guests:[{nickname, avatar,
  sessions:[...]}], signature}` con HMAC sulla chiave server (`Crypto`). Un file manomesso o
  costruito a mano viene rifiutato all'import.
- **Import** (solo docente con account, in una classe che gestisce):
  - dall'aula ancora attiva oppure da file JSON;
  - tabella: avatar · nickname · `[studente della classe ▾ | ignora]`, con abbinamento
    automatico suggerito per nome simile;
  - conferma → sessioni assegnate agli studenti (visibili nel loro storico e nei voti della classe),
    il resto cancellato;
  - pulsante **"Cancella tutto"** sempre disponibile.
- Il file JSON scaricato sta sul PC del docente: avviso nella UI che contiene dati degli studenti.

## Avatar

Set unico Icons8 (stile coerente, ~24 animali), **scaricato in `public/avatars/`**, non caricato
dai server Icons8 a runtime: nessuna richiesta a terzi dai PC degli studenti e funziona con i
filtri della rete scolastica. In DB solo lo slug. Attribuzione "Icons by Icons8" nel footer della
pagina `/entra` (richiesta dalla licenza gratuita).

## Privacy (minori)

- Nessun dato obbligatorio oltre al nickname; filtro parolacce e lunghezza.
- Cookie ospite `HttpOnly`, `Secure`, `SameSite=Lax`, scadenza = `expires_at`; token salvato come hash.
- Niente analytics, niente Sentry replay sulle pagine `/entra` e `/aula/*`; nickname rimosso dagli eventi Sentry.
- Informativa breve su `/entra`: conversazioni inviate al provider AI, cancellazione entro 2 ore.

## API

```
POST   /api/rooms                         crea (con o senza account) → {code, hostLink, expiresAt}
GET    /api/rooms/current                 docente (cookie host): stato, lobby, progressi
PATCH  /api/rooms/current                 lock/unlock
DELETE /api/rooms/current                 termina e cancella
POST   /api/rooms/current/guests/{id}/approve | DELETE .../guests/{id}
GET    /api/rooms/current/export.xlsx | export.json
POST   /api/classes/{id}/room-import      (teacher) {roomId | file, mapping:[{guestId, userId|null}]}

GET    /api/guest/rooms/{code}            esiste? aperta? titolo
POST   /api/guest/join                    {code, nickname, avatar} → cookie ospite | pending
GET    /api/guest/me                      stato ospite e attività
+ sessioni e AI per ospiti tramite middleware s.guest(...) accanto a s.auth(...)

GET    /api/cron/purge-rooms              Vercel cron (CRON_SECRET)
```

## Piano di lavoro

- [x] **L1** Schema, `store.Rooms` + test (cancellazione completa, purge, unicità nickname, aula piena).
- [ ] **L2** `roomService` (crea, join, rientro, scadenza, limiti) + test.
- [ ] **L3** `RoomSettings` + `TargetsFor` nel gateway + conteggio richieste per ospite/aula + test.
- [ ] **L4** Handler, middleware ospite, cookie host, cron, rate limit sui codici errati; aggiornare `shapes.json`.
- [ ] **L5** Export xlsx/JSON firmato, import con mapping + test.
- [ ] **L6** Frontend: `/entra`, scelta avatar, attività come ospite (riuso `ActivityRunner`).
- [ ] **L7** Frontend docente: `/aula/nuova`, schermo proiettabile (QR, countdown, lobby), import in classe.
- [ ] **L8** Admin: tab "Aula lampo" (provider dedicato, limiti).
- [ ] **L9** Avatar Icons8 in `public/avatars/`, traduzioni nelle 5 lingue, `check:i18n`.
- [ ] **L10** Prova end-to-end su preview Vercel con più browser.
