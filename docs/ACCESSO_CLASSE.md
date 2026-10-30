# Accesso semplice in classe: verifica del 29 ottobre 2026

Il seguito di questa verifica è il [piano tecnico della classe con username](PIANO_CLASSE_USERNAME.md),
richiesto successivamente. Il piano definisce la prima versione senza email e rinvia l'indirizzo
facoltativo a una seconda consegna; non costituisce un'implementazione della funzione.

Verifica richiesta per la lezione del giorno successivo. Nessuna modifica al comportamento
applicativo e nessun account, messaggio o aula creati in produzione.

## Stato verificato

| Flusso | Stato |
| --- | --- |
| Classe permanente | Esiste e conserva iscrizioni e attività. |
| Invito senza email, con scelta di username e password | Non implementato: gli inviti sono associati a un'email; login e registrazione richiedono quell'identità. |
| Link/codice classe | Esiste, ma aggiunge alla classe un utente già registrato: non crea un account. |
| Cambio password | Esiste nel menu Account (`/account`), con verifica della password attuale. |
| Password dimenticata | Recupero via email già presente; manca il recupero per un account senza email. |
| Aula lampo | Docente anche senza account; studenti con codice/QR, nickname e avatar, senza password. Durata massima 120 minuti. |

La configurazione pubblica di `https://debateai-steel.vercel.app/api/public/config`
restituisce `roomsEnabled: true`, `anonymousRooms: true`, `roomMaxMinutes: 120`,
`allowJoinByCode: true`, `mailConfigured: true`. Questo verifica l'abilitazione sul sito
pubblicato, non il funzionamento dei provider AI né la revisione distribuita.

## Proposta minima per la classe permanente (da implementare)

1. Il docente copia un link d'iscrizione dalla classe, utilizzabile da più studenti e revocabile.
2. Lo studente sceglie username e password, senza email obbligatoria, ed entra nella classe.
3. La pagina ricorda di annotare le credenziali; non conserva né invia password in chiaro.
4. Email facoltativa per un promemoria con username e link del sito e per il recupero tramite
   link temporaneo. L'indirizzo di recupero deve essere verificato.
5. Cambio password dal menu Account esistente. Senza email, il docente della classe può
   generare un link temporaneo per reimpostarla, senza conoscere la password scelta.
6. Chi ha già un account effettua il login e si iscrive senza creare un duplicato.

Riutilizzare classi, appartenenze, sessioni, hash bcrypt e pagina Account esistenti.
Gli username devono essere univoci e normalizzati; il link deve iscrivere solo come studente,
rifiutare classi archiviate e codici revocati, e creare account e appartenenza atomicamente.
Mantenere compatibili gli accessi email esistenti. Questa è una modifica funzionale distinta
dal piano di refactoring.

**Problema da correggere insieme al nuovo login:** `handleLogin` conta anche gli accessi riusciti
nel limite di 20 tentativi ogni 15 minuti per IP. Una classe di oltre 20 studenti dietro lo
stesso router può quindi essere bloccata. Conservare la protezione contro tentativi abusivi,
senza applicare questo tetto agli accessi legittimi di tutta la scuola.

## Uso dell'aula lampo per la lezione

Docente: `/aula/nuova` → prepara una sola attività → durata → apri → conserva il link
segreto di gestione. Studenti: QR oppure `/entra` → codice → nickname e avatar.
Una sola persona può partecipare: non esiste un minimo di studenti.
Scaricare i risultati prima della scadenza: l'aula è temporanea, i suoi dati vengono eliminati.
Il rientro da un altro PC usa un PIN generato dal docente. La voce Live è disabilitata.
Prima della lezione resta da provare sul sito un'attività completa con il modello AI configurato.

## Prove eseguite

- Vitest: 8 test superati in `authPages.test.tsx` e `roomPages.test.tsx`.
- Go: test selezionati `Auth|Login|Register|Password|Profile|Class|Room` superati nei
  pacchetti `internal/app` e `internal/store`.
- Il test HTTP `TestEndToEndRoomInSchoolLab` non può partire nella sandbox, che vieta
  l'apertura di socket (`bind: operation not permitted`). Nessuna prova completa del
  percorso in produzione eseguita in questa verifica.

Riferimenti: `server/internal/app/auth_service.go`, `server/internal/httpapi/auth.go`,
`server/internal/httpapi/limits.go`, `server/internal/app/room_service.go`,
`src/pages/auth/AuthPages.tsx`, `src/pages/dashboard/teacher/ClassMembers.tsx`,
`docs/AULA_LAMPO.md`.
