## Problemi
- Mancano chiavi i18n: `apps.aiIdentity.identification.instructionsBanner` (it) e tutto il set `reflection.*` (it). 
- Etichette e testi per Personaggio A/B poco leggibili.
- Durante l’identificazione l’utente non vede la chat precedente, quindi la scelta non è chiara.

## Soluzione
- Aggiungere chiavi i18n mancanti:
  - `apps.aiIdentity.identification.instructionsBanner` in it/en/fr (verifica percorso).
  - Nuovi file `reflection.json` per it/en/fr con: `title`, `aiIdentityDescription`, `aiIdentityPlaceholder`.
- Migliorare leggibilità UI nell’identificazione:
  - Aumentare contrasto e dimensioni per “Personaggio A/B”.
  - Rendi il testo assegnato nelle drop‑zone più visibile (font medium, colore scuro).
  - Localizzare “Réinitialiser” → `common.reset`.
- Contesto conversazionale:
  - Mostrare un pannello collassabile “Chat precedente” sotto l’identificazione con le ultime 3–5 coppie Q/R prese dalla chat.
  - Passare da `AiIdentityChat` a `AiIdentityIdentificationPhase` un array dei messaggi combinati (`getCombinedMessagesForDisplay()`), e renderizzare sinteticamente.
- Chiarezza d’accesso all’identificazione:
  - Il banner istruzioni resta visibile e corretto.
  - Aggiungere (opzionale) un bottone “Vai all’identificazione” quando si raggiunge il minimo di domande.

## Modifiche previste
- `src/i18n/locales/it/en/fr/apps/aiIdentity.json` e nuovi `src/i18n/locales/*/reflection.json`.
- `src/components/AiIdentity/AiIdentityIdentificationPhase.tsx`: stile e i18n pulsante reset; pannello chat precedente.
- `src/components/AiIdentityChat.tsx`: passare `recentMessages` all’identificazione.

## Verifica
- Nessun errore i18n; banner tradotto.
- Drop‑zone e label ben leggibili.
- Sezione “Chat precedente” visibile e utile per scegliere.

## Conferma
- Procedo ad aggiungere le chiavi i18n e ad aggiornare UI e contesto come sopra, poi verifico su dev server.