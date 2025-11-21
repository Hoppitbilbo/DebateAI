## Obiettivo
- Sostituire/affiancare il drag-and-drop con **un’unica box di selezione (Select) da 4 nomi** per ciascun personaggio (A e B): nome originale + 3 varianti semanticamente plausibili.
- Rendere chiara la scelta: migliorare leggibilità di Personaggio A/B e mostrare **estratto della chat precedente** per aiutare l’utente.
- Completare le chiavi i18n mancanti (banner, reflection.* in IT).

## Generazione varianti
- Nuova funzione `generatePlausibleVariants(originalName, otherCharName)` in `src/components/AiIdentityChat.tsx` (o util dedicato) che restituisce **esattamente 3** varianti:
  - Per Benito Mussolini: `Benito Macallini`, `Benedetto Molinari`, `Vincenzo Musolino` (coerenti culturalmente e storicamente, non mere ortografie).
  - Per Adolf Hitler: `Adolph Hüttler`, `Adolf Hitner`, `Aldolf Hittle` (varianti credibili e sufficientemente diverse).
  - In generale: se i personaggi selezionati sono diversi, la funzione può pescare varianti dall’epoca dell’altro (es. Churchill, Stalin) per creare dilemma, mantenendo **sempre 3** alternative.

## UI Identificazione
- In `src/components/AiIdentity/AiIdentityIdentificationPhase.tsx`:
  - Aggiungere due Select (A e B) con **4 opzioni** ciascuna: `[originale] + 3 varianti`.
  - Migliorare leggibilità: label “Personaggio A/B” con **font più grande e colore scuro**.
  - Drop‑zone e pulsanti attuali restano come fallback ma, in modalità “selezione”, si mostrano i Select come primary.
  - Aggiungere sezione **“Chat precedente”** (collassabile) con le **ultime 3–5** coppie domanda/risposta (fonte: `getCombinedMessagesForDisplay()` esistente in `src/components/AiIdentityChat.tsx:282-311`).

## Collegamenti dati
- In `AiIdentityChat`:
  - Creare le liste 4‑opzioni per A e B usando `generatePlausibleVariants` e passarle a `AiIdentityIdentificationPhase` (nuovi props `optionsA` e `optionsB`).
  - Passare anche `recentMessages={getCombinedMessagesForDisplay().slice(-8)}` (messaggi combinati limitati).

## i18n
- Aggiungere chiave **`apps.aiIdentity.identification.instructionsBanner`** in IT/EN/FR (banner già usato in chat).
- Aggiungere file `reflection.json` (IT/EN/FR) con:
  - `title`, `aiIdentityDescription`, `aiIdentityPlaceholder` (log di errore attuali).

## Verifica
- Titolo non spoilera i nomi.
- In identificazione compaiono **due Select** con 4 opzioni per A e B.
- Testi “Personaggio A/B” leggibili; presentazione della **chat precedente** in basso.
- Nessun errore i18n per banner o reflection.

## File toccati
- `src/components/AiIdentityChat.tsx` (generazione varianti + passaggio props)
- `src/components/AiIdentity/AiIdentityIdentificationPhase.tsx` (UI Select + sezione chat precedente)
- `src/i18n/locales/*/apps/aiIdentity.json` (banner)
- `src/i18n/locales/*/reflection.json` (nuovo)

## Procedo?
- Se confermi, implemento Select a 4 nomi per A/B, aggiungo la sezione chat precedente, completo le chiavi i18n mancanti e verifico in dev.