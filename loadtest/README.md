# Test di carico: 1 CPU e 1 GB

Misura quanti studenti regge DebateAI su una macchina da 1 CPU e 1 GB di RAM e quale parte cede per prima.
Tutto gira in locale con Docker: niente produzione e niente quota Gemini.

- `debateai`: il server vero (stesso `Dockerfile` della produzione self-hosted), limitato a `cpus: 1.0` e `mem_limit: 1g`, con un database SQLite nuovo.
- `mockai`: finto provider compatibile OpenAI (`server/cmd/mockai`). Risponde in streaming dopo un ritardo realistico: primo token dopo 800 ms, poi 60 token ogni 30 ms, circa 2,6 s in tutto. Non è limitato perché sostituisce un servizio esterno.
- `k6`: il generatore di carico (`load.js`), anche lui non limitato.

Gli studenti arrivano 30 per volta dallo stesso IP (`X-Forwarded-For`), come una classe dietro la rete della scuola.

## Come si lancia

```sh
cd DebateAI
docker compose -f loadtest/docker-compose.yml up -d --build

# login: login al secondo in crescita, con traffico leggero in parallelo
docker compose -f loadtest/docker-compose.yml run --rm -e SCENARIO=login \
  -e LOGIN_RATES=2,5,8,10,12,15,20,30 -e STEP_SECONDS=20 k6 run /scripts/load.js

# chat: studenti loggati che fanno attività (5 turni, 8-15 s per scrivere)
docker compose -f loadtest/docker-compose.yml run --rm -e SCENARIO=chat \
  -e CHAT_VUS=100,100,300,300,600,600 -e STEP_SECONDS=60 k6 run /scripts/load.js

# room: ospiti dell'aula lampo (ingresso con codice), poi chat
docker compose -f loadtest/docker-compose.yml run --rm -e SCENARIO=room \
  -e ROOM_VUS=100,100,300,300,600,600 -e STEP_SECONDS=60 k6 run /scripts/load.js

# CPU e RAM durante la prova, da un altro terminale
docker stats loadtest-debateai-1
```

Tra uno scenario e l'altro conviene ripartire da un database vuoto con `docker compose -f loadtest/docker-compose.yml down -v`.
I limiti anti abuso (20 login per account e per rete ogni 15 minuti) restano salvati nel database e falserebbero la prova successiva.
Il `setup()` crea l'admin, il provider finto e 600 studenti (`STUDENTS`): ci vogliono circa 35 secondi, perché ogni password passa da bcrypt.

Altri parametri: `TURNS`, `THINK_MIN`, `THINK_MAX`, `MOCK_FIRST_TOKEN_MS`, `MOCK_TOKENS`, `MOCK_TOKEN_MS`, `VERBOSE=1` (stampa ogni errore).
Un riepilogo JSON di ogni prova finisce in `loadtest/results/` (ignorata da git); con `--out csv=/scripts/results/x.csv` si salva ogni singola richiesta.

## Risultati del 14/11/2026

Host: Apple M5, Docker Desktop. Server con 1 CPU e 1 GB.

### Login (bcrypt): è il collo di bottiglia

| login/s richiesti | login/s serviti | login mediana | login p95 | resto del sito mediana | resto del sito p95 |
|---:|---:|---:|---:|---:|---:|
| 2 | 1,4 | 79 ms | 80 ms | 1 ms | 2 ms |
| 5 | 3,4 | 76 ms | 80 ms | 0,4 ms | 2 ms |
| 10 | 8,9 | 56 ms | 61 ms | 0,2 ms | 0 ms |
| 15 | 13,3 | 49 ms | 50 ms | 0,2 ms | 0 ms |
| 20 | 17,2 | 47 ms | 49 ms | 0,2 ms | 0 ms |
| 30 | 26,1 | **2,0 s** | **7,2 s** | **301 ms** | **1,9 s** |

La CPU cresce di circa il 3,5% per ogni login al secondo e arriva al 100% intorno ai 20 login/s.
Oltre quella soglia si accumula una coda: i login aspettano diversi secondi e rallenta tutto il sito, anche le pagine che non c'entrano.
La RAM non supera i 25 MB.

### Chat (studenti loggati): non è un problema

Fino a 600 studenti che fanno attività contemporaneamente (circa 45 risposte AI al secondo più i salvataggi):

- CPU tra il 20% e il 35%, RAM sotto i 90 MB;
- il server aggiunge in mediana 71 ms alla risposta dell'AI (p95 174 ms), creazione del tentativo 1 ms, salvataggio della conversazione 1,3 ms (p95 3 ms);
- nessun errore.

### Aula lampo (ingresso con codice): non è un problema

Fino a 600 ospiti in 20 aule da 30:

- ingresso con codice in 4,4 ms di mediana, contro i 50-80 ms di un login con password, perché non usa bcrypt;
- CPU sotto il 22%, RAM sotto i 90 MB, nessun errore.

I pochi `generate: 0` stampati alla fine dello scenario sono richieste interrotte da k6 allo scadere dei 30 secondi di chiusura, non errori del server.

## Come leggere questi numeri

- **Il collo di bottiglia è il login con password.** Con questa CPU il tetto è intorno ai 20 login al secondo. Trenta classi da 30 studenti che entrano tutte nello stesso minuto fanno 15 login al secondo: sotto il tetto, ma vicino.
- **Il login capita di rado.** La sessione dura 30 giorni, quindi uno studente rifà il login solo su un nuovo dispositivo o dopo il logout. Il picco vero è la prima lezione, o un'aula di informatica dove i PC si resettano ogni volta.
- **Un core di un M5 è molto più veloce di una vCPU da VPS economica.** bcrypt usa solo la CPU, quindi su un server da 1 vCPU condivisa il tetto potrebbe scendere a una frazione di questi 20 login/s. È una stima: va misurato rilanciando lo stesso test sul server vero.
- **La produzione su Vercel è un'altra architettura.** Lì girano funzioni Vercel con Turso (libSQL remoto), non un solo processo con SQLite. Questo test riguarda l'installazione self-hosted con Docker.
- **Non è misurata la valutazione finale** (`/evaluate`): è una chiamata AI in più a fine attività, dello stesso tipo della chat.
