# Tutorial video per studenti — Piano (testi → immagini)

> **Stato (2026-10-26): realizzato.** I testi definitivi sono in
> `src/i18n/studentTutorials/it.json` (fanno fede quelli, questo file è il
> piano di partenza). Codice in `src/features/tutorials/student/`, video con
> `npm run render:tutorials`. Differenze rispetto al piano: i livelli usano i
> nomi delle fasi dell'app (Preparazione, Conversazione, Riflessione,
> Feedback); nel Personaggio Misterioso la consegna dice che il personaggio lo
> sceglie il docente o arriva a sorpresa, e la nota sulle domande usate è
> diventata un punto della lista "cosa alza il voto".

Obiettivo: per ogni app, un tutorial audiovisivo di 6 slide che spiega allo
studente **cosa deve fare** (la consegna) e **come viene valutato**.
Stile: pixel art 8-bit, transizioni "morph" orizzontali, un PC retrò e un
personaggio storico che fa da guida e parla con la voce narrante.

Regola di scrittura: frasi brevi, seconda persona ("tu"), un'idea per riga.
Vietata la struttura "non è solo X, ma Y".

Fonti nel codice usate per i contenuti sulla valutazione:
`src/utils/evaluationUtils.ts` (voto finale), `server/internal/app/judge.go`
(giudice JEV e barra Avanzamento), `src/i18n/locales/it/platform.json`
(domande di riflessione).

---

## PARTE A — I TESTI

### Struttura comune (uguale in tutte le app)

| # | Slide | Scopo |
|---|-------|-------|
| 1 | Missione | Chi è la guida, cosa farai in una frase |
| 2 | La tua consegna | I passi concreti, numerati |
| 3 | Il percorso | Le 4 fasi: Preparazione → Chat → Riflessione → Valutazione |
| 4 | La barra Avanzamento | Obiettivi del docente, spunte, avviso "fuori tema" |
| 5 | Come vieni valutato | I due voti da 0 a 10 e cosa li alza |
| 6 | Consigli + START | 3 trucchi pratici, invito a iniziare |

Le slide 3, 4 e 5 hanno una base comune (sotto) con una riga specifica per app.

#### Slide 3 — Il percorso (testo comune)
- A schermo: `1 PREPARA · 2 CHATTA · 3 RIFLETTI · 4 RICEVI IL GIUDIZIO`
- Voce: «Il percorso ha quattro livelli. Prepari la partita, chatti, scrivi una
  riflessione e ricevi il giudizio. Ogni livello conta.»

#### Slide 4 — La barra Avanzamento (testo comune)
- A schermo:
  - `OBIETTIVI DEL DOCENTE → ✔ quando li raggiungi`
  - `AVANZAMENTO = obiettivi raggiunti in %`
  - `⚠ FUORI TEMA? Torna alla traccia`
- Voce: «Se il tuo docente ti ha assegnato un compito, vedi la lista degli
  obiettivi. Dopo ogni tuo messaggio un giudice automatico controlla a che
  punto sei. Quando un obiettivo è raggiunto, compare la spunta. Conta quello
  che fai tu: se è il personaggio a dire tutto, l'obiettivo resta aperto.
  Se esci dal tema, o provi a far uscire il personaggio dal suo ruolo, ricevi
  un avviso.»

#### Slide 5 — Come vieni valutato (testo comune)
- A schermo:
  - `VOTO CONVERSAZIONE  ▮▮▮▮▮▮▮▯▯▯  /10`
  - `VOTO RIFLESSIONE    ▮▮▮▮▮▮▯▯▯▯  /10`
  - `Nel giudizio: Punti di forza · Cosa migliorare · Sulla tua riflessione · Obiettivi ✅/⚠️`
- Voce: «Alla fine ricevi due voti da zero a dieci: uno per la conversazione,
  uno per la riflessione. Il giudizio cita i momenti concreti della tua chat,
  ti dice cosa migliorare e controlla ogni obiettivo del docente. Un lavoro
  breve o superficiale prende un voto basso.»

---

### 1. CONVINCI TU — Guida: **Napoleone Bonaparte**

**S1 Missione**
- Titolo: `MISSIONE: CONVINCI L'IMPERATORE`
- Testo: Scegli un personaggio storico. Convincilo di un'idea.
- Voce (Napoleone): «Sono Napoleone. Ho conquistato mezza Europa e cambio idea
  raramente. Vuoi convincermi? Ti servono argomenti solidi.»

**S2 La tua consegna**
- `1. Scegli il personaggio`
- `2. Scrivi l'idea da sostenere`
- `3. Argomenta, rispondi alle sue obiezioni`
- `4. Scrivi la riflessione finale`
- Voce: «Scegli chi convincere e scrivi l'idea. Io difenderò il punto di vista
  della mia epoca e ti farò domande difficili. Cambierò idea poco alla volta,
  e solo davanti a ragioni forti.»

**S3 Il percorso** — riga specifica: `Il personaggio cede gradualmente: ogni buon argomento conta.`

**S4 Avanzamento** — esempio di obiettivo a schermo: `✔ Usa un argomento legato all'epoca del personaggio`

**S5 Valutazione** — cosa alza il voto:
- `+ Argomenti adatti al suo tempo e ai suoi valori`
- `+ Risposte alle sue obiezioni`
- `+ Prove ed esempi concreti`
- Domanda di riflessione a schermo: *«Come hai cercato di convincere Napoleone?
  Quali argomenti hanno funzionato e perché?»*

**S6 Consigli**
- `Parla dei suoi interessi: gloria, ordine, Francia`
- `Una tesi per messaggio`
- `Ascolta le sue domande: ti indicano il punto debole`
- Voce: «All'attacco, soldato! Premi START.»

---

### 2. DOPPIA INTERVISTA — Guide: **Galileo Galilei** + **Aristotele**

**S1 Missione**
- Titolo: `MISSIONE: UNA DOMANDA, DUE RISPOSTE`
- Testo: Intervisti due personaggi insieme e confronti ciò che dicono.
- Voce (Galileo): «Io sono Galileo, lui è Aristotele. Sul cielo la pensiamo in
  modo opposto. Fai a entrambi la stessa domanda e guarda cosa succede.»

**S2 La tua consegna**
- `1. Scegli due personaggi`
- `2. Fai le domande: rispondono entrambi`
- `3. Confronta le risposte`
- `4. Nella riflessione spiega le differenze`
- Voce: «Ogni domanda arriva a tutti e due. Le risposte compaiono una accanto
  all'altra. Il tuo lavoro è notare dove siamo d'accordo e dove no.»

**S3** — riga specifica: `Due colonne, due punti di vista.`

**S4** — esempio obiettivo: `✔ Fai almeno una domanda che metta in contrasto le due visioni`

**S5** — cosa alza il voto:
- `+ Domande aperte, che fanno emergere differenze`
- `+ Domande di approfondimento sulle risposte`
- `+ Un confronto preciso nella riflessione`
- Riflessione: *«In cosa differivano i punti di vista di Galileo e Aristotele?
  Cosa hai imparato confrontandoli?»*

**S6 Consigli**
- `Preferisci "perché" e "come" alle domande sì/no`
- `Riprendi una frase di uno e chiedila all'altro`
- `Annota le differenze mentre leggi`
- Voce (Aristotele): «Osserva, confronta, ragiona. Premi START.»

---

### 3. PERSONAGGIO MISTERIOSO — Guida: **un'ombra con il "?"** (si rivela alla fine: Cleopatra)

**S1 Missione**
- Titolo: `MISSIONE: CHI SONO?`
- Testo: Indovina il personaggio con un numero limitato di domande.
- Voce (ombra): «Chi sono? Non te lo dirò. Ti darò indizi. Hai poche domande:
  usale bene.»

**S2 La tua consegna**
- `1. Il personaggio viene scelto (anche a sorpresa)`
- `2. Hai da 3 a 15 domande (di solito 7)`
- `3. Raccogli indizi: epoca, luogo, mestiere`
- `4. Fai il tuo tentativo e spiega il ragionamento`
- Voce: «Rispondo sempre in modo vero, con indizi indiretti. Se chiedi
  "sei tu Tizio?" rispondo solo sì o no. Il nome deve essere scritto bene:
  il cognome o il nome completo.»

**S3** — riga specifica: `Il contatore delle domande scende a ogni messaggio.`

**S4** — esempio obiettivo: `✔ Usa domande che restringono il campo (epoca, continente)`

**S5** — cosa alza il voto:
- `+ Domande strategiche: dal generale al particolare`
- `+ Pochi tentativi a caso`
- `+ Un ragionamento chiaro, indovinato o no`
- Riflessione: *«Quali domande ti sono state più utili? Come cambieresti la tua
  strategia?»*
- Nota a schermo: `Il giudizio considera anche quante domande hai usato e se hai indovinato.`

**S6 Consigli**
- `Prima l'epoca, poi il luogo, poi il campo`
- `Evita le domande che ripetono un indizio già avuto`
- `Tieni il tentativo per quando sei sicuro`
- Voce (rivelazione): «Ero Cleopatra! Ora tocca a te. Premi START.»

---

### 4. IMPERSONA TU — Guida: **Leonardo da Vinci** (con una maschera in mano)

**S1 Missione**
- Titolo: `MISSIONE: DIVENTA UN ALTRO`
- Testo: Interpreti un personaggio storico e dialoghi con un altro.
- Voce (Leonardo): «Oggi indossi una maschera. Diventi un personaggio e parli
  come lui. Io sarò il tuo interlocutore e ti metterò alla prova.»

**S2 La tua consegna**
- `1. Scegli chi interpreti tu`
- `2. Scegli il personaggio dell'IA`
- `3. Scegli l'argomento`
- `4. Resta nel ruolo fino alla fine`
- Voce: «Parla in prima persona, con le idee e il linguaggio del tuo
  personaggio. Se dici qualcosa di sbagliato sulla sua vita, io me ne accorgo
  e te lo faccio notare.»

**S3** — riga specifica: `Ogni tuo messaggio è una battuta del tuo personaggio.`

**S4** — esempio obiettivo: `✔ Cita un fatto vero della vita del tuo personaggio`

**S5** — cosa alza il voto:
- `+ Fatti storici corretti`
- `+ Coerenza con le idee del personaggio`
- `+ Risposte pronte alle domande dell'IA`
- Riflessione: *«Come hai interpretato il tuo personaggio? Come ha reagito
  Leonardo e cosa hai imparato su entrambi?»*

**S6 Consigli**
- `Leggi la sua biografia prima di iniziare`
- `Usa "io": io ho scoperto, io ho scritto`
- `Se non sai una cosa, rispondi come farebbe lui`
- Voce: «Sipario! Premi START.»

---

### 5. YOU MODERATE — Guide: **Marie Curie** + **Albert Einstein**, lo studente col microfono

**S1 Missione**
- Titolo: `MISSIONE: GUIDA IL DIBATTITO`
- Testo: Due personaggi discutono. Tu sei il moderatore.
- Voce (Curie): «Io ed Einstein abbiamo idee forti. Senza un moderatore
  parleremmo per ore. Il microfono è tuo.»

**S2 La tua consegna**
- `1. Scegli due personaggi e il tema`
- `2. Dai la parola, fai domande`
- `3. Chiedi brevità, riporta in tema`
- `4. Chiudi e scrivi la riflessione`
- Voce: «Puoi farci domande, chiedere a uno di rispondere all'altro, dirci di
  essere brevi. Noi seguiamo le tue indicazioni.»

**S3** — riga specifica: `Tu decidi chi parla e di cosa.`

**S4** — esempio obiettivo: `✔ Fai una domanda che costringa i due a confrontarsi`

**S5** — cosa alza il voto:
- `+ Domande che accendono il confronto`
- `+ Equilibrio: entrambi hanno spazio`
- `+ Interventi quando il dibattito si perde`
- Riflessione: *«Come hai moderato il dibattito tra Curie ed Einstein? Quali
  domande lo hanno reso più interessante?»*

**S6 Consigli**
- `Apri con una domanda divisiva`
- `Chiedi a uno di rispondere direttamente all'altro`
- `Riassumi prima di passare al punto successivo`
- Voce (Einstein): «Il tempo è relativo, il tuo turno no. Premi START.»

---

### 6. WIKICHAT AI — Guida: **Ada Lovelace** + un argomento che parla (il Colosseo)

**S1 Missione**
- Titolo: `MISSIONE: PARLA CON UN ARGOMENTO`
- Testo: Scegli una voce di Wikipedia. Diventa un personaggio con cui parlare.
- Voce (Ada): «Sono Ada Lovelace. Qui ogni voce di Wikipedia prende la parola:
  una persona, un luogo, un evento, un'idea. Guarda: il Colosseo ti saluta.»

**S2 La tua consegna**
- `1. Cerca e scegli una voce di Wikipedia`
- `2. Fai domande in prima persona all'argomento`
- `3. Approfondisci e collega ad altri temi`
- `4. Scrivi cosa hai imparato`
- Voce (Colosseo): «Chiedimi chi mi ha costruito, a cosa servivo, cosa ho visto.
  Rispondo con i fatti della mia voce.»

**S3** — riga specifica: `Più domande precise fai, più scopri.`

**S4** — esempio obiettivo: `✔ Chiedi le cause e le conseguenze di un evento`

**S5** — cosa alza il voto:
- `+ Domande che vanno in profondità`
- `+ Collegamenti con altri argomenti`
- `+ Una riflessione con fatti appresi e nuove domande`
- Riflessione: *«Cosa hai imparato sul Colosseo? Cosa ti ha sorpreso? Cosa
  vorresti ancora sapere?»*

**S6 Consigli**
- `Parti da una curiosità vera`
- `Chiedi "perché" dopo ogni risposta interessante`
- `Controlla i fatti importanti sulla voce di Wikipedia`
- Voce (Ada): «Esegui il programma. Premi START.»

---

## PARTE B — LE IMMAGINI (da fare dopo l'approvazione dei testi)

### Sistema visivo
- **Risoluzione logica** 320×180 pixel, ingrandita ×4/×6 senza sfumature
  (`image-rendering: pixelated`), formato 16:9 orizzontale.
- **Palette** 16 colori stile PICO-8: blu notte di fondo, giallo per i titoli,
  verde per le spunte, rosso per gli avvisi.
- **Font** pixel: "Press Start 2P" (titoli) e "VT323" (testi).
- **Sprite** disegnati come griglie SVG nel codice (nessuna immagine esterna):
  - PC retrò con monitor CRT, scanline e tastiera — presente in ogni slide.
  - Un personaggio-guida per app, 32×48 px, con 2 frame di animazione
    (respiro/bocca che parla durante la voce).
- **Scenari** di fondo per app: tenda da campo (Napoleone), torre e
  cannocchiale (Galileo), stanza buia con riflettore (Mistero), bottega con
  tele (Leonardo), palco con due leggii (Moderate), biblioteca con scaffali
  (WikiChat).

### Morph orizzontale
Gli elementi con lo stesso nome restano sullo schermo e scivolano nella nuova
posizione tra una slide e l'altra (come il Morph di PowerPoint):
- S1: guida a sinistra, PC piccolo a destra, titolo grande al centro.
- S2: la guida scivola a destra, il PC si allarga a sinistra e mostra i 4 passi.
- S3: il PC si sposta al centro e diventa una "mappa a livelli" orizzontale;
  la guida cammina da un livello all'altro.
- S4: zoom orizzontale sul monitor: barra Avanzamento che si riempie, spunte.
- S5: i due voti appaiono come barre HP; la guida indica col braccio.
- S6: la guida torna a sinistra, sul PC lampeggia `PRESS START`.

### Audio
- Voce narrante con sintesi vocale del browser (italiano), sincronizzata al
  testo "Voce" di ogni slide; sottotitoli sempre visibili.
- Effetti chiptune generati con Web Audio: "blip" a ogni riga che compare,
  "whoosh" a 8-bit sul morph, jingle finale su START.
- Pulsanti: ◀ ▶, pausa, muto, riproduzione automatica.

### Dove va nel prodotto
Nuova pagina per studenti in `src/features/tutorials/` (accanto ai tutorial
per docenti esistenti), testi nelle traduzioni `tutorial`, collegata dal
pulsante "Tutorial" di ogni app.
