# AiDebate.tech: piano di progetto e di prodotto

Ultimo aggiornamento: 18 ottobre 2026 · Branch di lavoro: `go`

Questo documento ha due parti:

- **Product manager:** cosa costruiamo, per chi e perché.
- **Project manager:** quando, in che ordine e con quali rischi.

Va aggiornato a ogni fine fase.

---

## 1. Visione di prodotto

AiDebate.tech è una piattaforma open source per le scuole. Gli studenti imparano dialogando con personaggi storici simulati dall'IA, e i docenti assegnano le attività e ne seguono i risultati.

La piattaforma si installa sul server della scuola, così i dati restano all'istituto. Può usare modelli gratuiti o locali, così i costi restano bassi e prevedibili.

### Problema che risolviamo

- I docenti vogliono usare l'IA in classe, ma gli strumenti commerciali raccolgono dati, costano e non permettono di assegnare un compito e vederne l'esito.
- Le chat libere con l'IA non hanno un obiettivo didattico né un momento di riflessione.

### Per chi (persone)

| Persona | Bisogno principale | Cosa usa |
|---|---|---|
| **Docente** | Assegnare un'attività con obiettivi chiari e vedere chi l'ha completata | Classi, compiti, matrice dei progressi, dettaglio sessione |
| **Studente** | Un'attività coinvolgente con istruzioni chiare e un feedback | Le 6 app, dashboard "I miei compiti", dettatura vocale, conversazione live |
| **Amministratore (referente IT)** | Installare, collegare le API, tenere sotto controllo i costi | Docker o binario unico, pannello IA e JEV, costi e budget, SMTP |
| **Ospite** | Provare le app senza account | Le app in modalità libera, con limiti d'uso |

### Proposta di valore

1. **Dati a scuola:** installazione locale (SQLite, un solo binario Go, oppure Docker).
2. **Costi sotto controllo:** modelli gratuiti per primi (OpenCode, OpenRouter `:free`, Ollama), budget mensile e blocco automatico dei modelli a pagamento.
3. **Obiettivi verificati:** JEV valuta se lo studente ha raggiunto gli obiettivi del docente e chiude l'attività.
4. **Multilingua:** italiano, inglese, spagnolo, francese e tedesco.

---

## 2. Stato attuale (cosa esiste oggi)

### Fatto e testato

- **Backend in Go:**
  - account e ruoli (admin, docente, studente);
  - inviti via e-mail, registrazione, recupero password;
  - classi, codici di accesso, compiti, progressi, sessioni.
- **Gateway IA:**
  - provider Gemini, OpenAI-compatibili e Anthropic;
  - fallback in ordine, "prima i gratuiti", "il più economico";
  - log di uso e costi, budget.
- **JEV:**
  - giudice con Jev (System One) e fallback su un modello linguistico;
  - chiude la sessione a obiettivo raggiunto o a limite di turni.
- **Frontend:**
  - 6 app sullo stesso framework di attività;
  - dashboard per studente, docente e admin;
  - selettore modelli con ricerca e filtro gratuiti.
- **Test:**
  - test unitari ed end-to-end del server con un provider finto;
  - controllo di tutte le pagine pubbliche nel browser (desktop e mobile).

### Fatto ma non ancora provato con servizi reali

| Elemento | Perché non è provato | Come chiuderlo |
|---|---|---|
| Gemini (chat e Live vocale) | manca una chiave API | test con chiave reale |
| Jev / System One | manca la chiave OpenCode | test con chiave reale |
| Invio e-mail SMTP | manca un server SMTP | test con SMTP della scuola o Mailtrap |
| Immagine Docker | il demone Docker non era attivo | `docker compose up` su un server di prova |

### Debito noto

- I testi di Privacy e Termini sono una base: ogni istituto deve completarli.
- Non c'è ancora una licenza nel repository: va scelta prima del rilascio pubblico.

---

## 3. Timeline del progetto

### Storia

| Periodo | Cosa è successo |
|---|---|
| set 2025 | Prototipo: 6 app educative su Gemini, sito multilingua (44 commit) |
| mar – mag 2026 | Conversazione vocale con Gemini Live, correzioni |
| ott 2026 | Piattaforma completa: backend Go, admin, classi, compiti, gateway multi-API, JEV, costi (branch `go`) |

### Piano

```
Ott 2026        Nov 2026            Dic 2026        Gen 2027        Feb 2027
|-- F1 --|----- F2 Pilota -----|---- F3 Miglioramento ----|-- F4 Rilascio 1.0 --|
19/10  01/11  02/11        29/11  30/11              24/01  25/01           28/02
```

#### Fase 1: Stabilizzazione (19 ottobre – 1 novembre 2026)

Obiettivo: tutto funziona con servizi reali su un server vero.

- [ ] Test con chiavi reali: Gemini (chat e Live), OpenCode con Jev, OpenRouter gratuito
- [ ] Test SMTP: invito, benvenuto, reset password, notifica compito
- [ ] Build e avvio Docker su un server di prova; backup del volume `data/`
- [ ] Revisione e merge del branch `go` su `master`
- [ ] Scelta della licenza open source e aggiunta del file `LICENSE`
- [ ] Guida all'installazione per il referente IT (README già pronto, da verificare passo per passo)

Uscita: un server di prova raggiungibile, con un admin, un docente e una classe di test.

#### Fase 2: Pilota in classe (2 – 29 novembre 2026)

Obiettivo: imparare dall'uso reale.

- [ ] 1 scuola, 2–3 docenti, 2–4 classi
- [ ] Ogni docente assegna almeno 2 compiti con obiettivi
- [ ] Raccolta feedback: breve questionario per docenti e studenti, più osservazione in classe
- [ ] Monitoraggio settimanale: costi, errori del server, sessioni completate o abbandonate
- [ ] Verifica della precisione di JEV: il docente conferma o smentisce "obiettivo raggiunto" su un campione di sessioni

Uscita: un report del pilota con i 10 problemi principali in ordine di priorità.

#### Fase 3: Miglioramento (30 novembre 2026 – 24 gennaio 2027)

Obiettivo: correggere ciò che è emerso nel pilota e completare le funzioni "Should".

- [ ] Correzioni del report pilota
- [ ] Esportazione dei risultati di classe in CSV
- [ ] Commento del docente su una sessione, visibile allo studente
- [ ] Taratura delle soglie di JEV per ogni app
- [ ] Accessibilità: navigazione da tastiera, contrasto, lettore di schermo

Pausa natalizia: lavoro ridotto dal 22 dicembre al 6 gennaio.

#### Fase 4: Rilascio 1.0 (25 gennaio – 28 febbraio 2027)

- [ ] Immagine Docker pubblicata e versione `v1.0.0` taggata
- [ ] Documentazione per docenti (guida rapida) e per referenti IT
- [ ] Pagina di presentazione aggiornata e annuncio sulla community Reddit
- [ ] Seconda e terza scuola installano in autonomia seguendo la guida

---

## 4. Backlog di prodotto (priorità MoSCoW)

| Priorità | Elemento | Fase |
|---|---|---|
| **Must** | Test con servizi reali (Gemini, Jev, SMTP, Docker) | F1 |
| **Must** | Backup e ripristino del database documentati | F1 |
| **Must** | Licenza e testi legali completabili dall'istituto | F1 |
| **Should** | Esportazione CSV dei risultati | F3 |
| **Should** | Feedback del docente sulla sessione | F3 |
| **Should** | Importazione studenti da CSV (inviti in blocco) | F3 |
| **Could** | Login con Google o Microsoft della scuola (OAuth) | dopo 1.0 |
| **Could** | Nuova app "Creatore di prompt per l'insegnamento" (già annunciata come "Prossimamente") | dopo 1.0 |
| **Could** | Statistiche per docente: tempo medio, obiettivi più difficili | dopo 1.0 |
| **Won't (per ora)** | App mobile nativa: il sito funziona già su telefono | – |

---

## 5. Metriche di successo

| Metrica | Obiettivo pilota | Come si misura |
|---|---|---|
| Sessioni assegnate completate | ≥ 70% | Dashboard docente, stato delle sessioni |
| Accordo JEV-docente su "obiettivo raggiunto" | ≥ 80% | Campione verificato a mano dal docente |
| Costo IA per studente al mese | ≤ 0,50 € (ideale 0 € con modelli gratuiti) | Pagina Costi |
| Errori IA visibili allo studente | < 2% delle richieste | Log di uso (fallback falliti) |
| Docenti che riassegnano un'attività | ≥ 2 su 3 | Compiti creati per docente |

---

## 6. Rischi

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| I modelli gratuiti cambiano o spariscono (OpenCode, OpenRouter) | Alta | Medio | Fallback multipli, aggiornamento lista modelli dal pannello, modello locale Ollama come riserva |
| JEV giudica male (falsi "obiettivo raggiunto") | Media | Alto | Soglia regolabile, verifica docente nel pilota, il docente vede sempre la trascrizione |
| Privacy e GDPR con minori | Media | Alto | Installazione locale, modelli locali possibili, testi legali da completare, nessun dato sensibile nelle chat |
| Gemini Live a pagamento o in anteprima | Media | Medio | La voce è opzionale; il testo funziona con qualsiasi provider |
| Il server della scuola non è adatto | Media | Medio | Binario unico leggero (~24 MB), SQLite, Docker; requisiti minimi documentati |
| Poco tempo dei docenti per il pilota | Alta | Medio | Compiti pronti da usare, guida rapida, supporto diretto nelle prime settimane |

---

## 7. Ruoli e modo di lavorare

| Ruolo | Responsabilità |
|---|---|
| **Product manager** | Visione, priorità del backlog, rapporto con i docenti del pilota, metriche |
| **Project manager** | Timeline, avanzamento delle fasi, rischi, comunicazione con la scuola |
| **Sviluppo** | Backend Go, frontend React, test, rilasci |
| **Referente IT della scuola** | Server, rete, backup, chiavi API |
| **Docenti pilota** | Uso in classe, feedback, verifica del giudizio di JEV |

### Ritmo

- **Ogni settimana:** 30 minuti di avanzamento su cosa è fatto, cosa è bloccato e la prossima settimana.
- **A fine fase:** revisione di questo documento (stato, timeline, rischi).

### Definizione di "fatto"

Un elemento è fatto solo quando ha tutte queste caratteristiche:

- funziona su desktop e mobile;
- ha i testi in 5 lingue (`npm run check:i18n` passa);
- i test del server passano (`npm run test:server`);
- è stato provato nel browser.

---

## 8. Registro delle decisioni

| Data | Decisione | Motivo |
|---|---|---|
| ott 2026 | Backend in Go con SQLite | Un solo binario leggero, facile da installare a scuola, poche risorse |
| ott 2026 | Gateway IA multi-provider con fallback | Usare modelli gratuiti e locali, non dipendere da un solo fornitore |
| ott 2026 | Gemini SDK solo per Live (voce) | È il servizio vocale in tempo reale più maturo; token temporanei, la chiave resta sul server |
| ott 2026 | JEV basato su Jev (System One) con fallback LLM | Valutazione strutturata degli obiettivi, gratuita con `jev-1.13-free` |
| ott 2026 | Chiavi API cifrate nel database (AES-GCM) | Le chiavi non escono mai dal server e non sono leggibili in chiaro |
