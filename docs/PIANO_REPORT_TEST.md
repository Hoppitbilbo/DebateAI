# Piano: correzioni dal report di test del 29 ottobre 2026

Data: 4 novembre 2026. Specifica: «DebateAI – Report di test e piano di miglioramento», sezioni 1–9 (la sezione 10, Sentry, è in [PIANO_SENTRY_DIAGNOSTICA.md](PIANO_SENTRY_DIAGNOSTICA.md)).
Branch: `fix/test-report-p0`, da `master` (`e78f9b4`).

## 1. Cause trovate nel codice

| Problema del report | Causa | Stato |
|---|---|---|
| §4 Blocco dopo la risposta giusta (Personaggio misterioso) | In un compito la vittoria la decideva solo il giudice JEV (`identified` ≥ 0,8 e «il personaggio ha confermato»). Se il giudice diceva no, il nome giusto non contava e la partita restava aperta. Inoltre `judgedRef` non si azzerava dopo un salvataggio fallito o superato, quindi saltava anche il controllo del nome nel browser. | **Fatto** |
| §3 Voto basso a chi indovina subito | Il voto lo scriveva liberamente l'IA, con la regola «short or superficial work gets low scores»: una partita vinta alla prima domanda è una conversazione corta. | **Fatto** (rubrica per il Personaggio misterioso) |
| §1 Spagnolo con l'italiano scelto dal docente | Il personaggio rispetta `config.language`, ma valutazione e suggerimenti del giudice seguivano la lingua dell'interfaccia dello studente (rilevata dal browser). | **Fatto** per valutazione e giudice (P0) e per la biografia Wikipedia (P1.1: la pagina è cercata nella lingua dell'attività con i collegamenti tra lingue, altrimenti resta quella originale) |
| §5 Due `/api/ai/generate` a un secondo di distanza | Non dimostrato: serve `turn_id` (F1 del piano Sentry). | Da fare con F1 |

## 2. Decisioni

1. **Il nome detto dallo studente vince sempre** (4/11/2026): una domanda che contiene il nome del personaggio chiude la partita, qualunque cosa abbia risposto l'IA. Il server lo decide con la stessa regola di `isCorrectGuess` (`app/mystery.go`, test di parità sugli stessi casi); il giudice resta come seconda via (nome storpiato dalla voce). Con una lista di personaggi fissata dal docente conta solo un personaggio della lista, quindi un contesto modificato non sceglie un nome più facile.
2. **Rubrica del Personaggio misterioso** (voto della conversazione, calcolato dal server):
   - giusto alla prima domanda, senza suggerimenti: **10** (bonus autonomia, detto nella valutazione);
   - giusto più tardi o con l'ipotesi finale: −1; con suggerimenti: −1; mai sotto **8** (decisione 2 del piano Sentry);
   - sbagliato: il voto dell'IA, al massimo **5**.

   Il voto della riflessione resta dell'IA. Il server dice all'IA il voto e il motivo, così il testo non lo contraddice.
3. **Lingua dei testi sull'attività**: valutazione e giudice usano la lingua fissata dal docente quando è una lingua dell'interfaccia (it/en/es/fr/de); per pt e la resta la lingua dello studente.

## 3. Limiti noti

- Ipotesi finale e numero di suggerimenti arrivano dal browser (`EvaluationRequest.mystery`): il server li controlla con la propria regola (nome) e li limita ai turni, ma uno studente che modifica la richiesta può dichiarare 0 suggerimenti (al massimo +1 punto).
- Dopo un ricaricamento, una partita già vinta torna come `goal_reached`, non `identified` (la ragione non è salvata).

## 4. Prossimi passi

- **P0 rimasti:** errori API, retry e doppie richieste → F1 del piano Sentry (`feat/sentry-diagnostica`), per non duplicare il lavoro.
- **P1:** ~~biografia Wikipedia nella lingua dell'attività~~ (fatto il 5/11; i personaggi scelti prima di questa modifica non sanno su quale Wikipedia sono stati scelti e sono letti come se venissero da quella dell'interfaccia, come prima; l'immagine del personaggio, `wikiImage.ts`, segue ancora l'interfaccia); stati della voce (ascolto/elaborazione/risposta) e uso solo testuale quando la voce non funziona; feedback per gli errori.
- **P2:** vocabolario avanzato e dizionario interattivo: nuova funzione, va progettata a parte.
