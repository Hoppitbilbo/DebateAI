## Problemi
- Il titolo in alto mostra i nomi reali: "Dialogue entre: Benito Mussolini & Adolf Hitler" → spoiler.
- L’interfaccia di identificazione (drag-and-drop o scelta nome) non appare.

## Soluzione proposta
- **Nascondere i nomi nel titolo**: sostituire la riga del titolo in `src/pages/AiIdentityPage.tsx` con etichette generiche “Personaggio A & Personaggio B”, senza mai mostrare i nomi selezionati.
- **Entrata chiara nell’identificazione**:
  - Confermare il flusso: clic su “Termina e riflettere” porta a `identification` per Easy/Medium (già corretto), e a `reflection` per Hard.
  - Aggiungere una breve barra di istruzioni sopra l’input in `AiIdentityChat` che indica: “Dopo almeno 2 domande, premi ‘Termina e riflettere’ per identificare i personaggi”.
- **Verifica visibilità DnD**:
  - Garantire che `AiIdentityIdentificationPhase` riceva `mode={difficulty}` e le opzioni per Medium (già in `src/components/AiIdentityChat.tsx:350-367`).
  - Aggiungere un testo i18n di istruzioni al componente identificazione (es. “Trascina ogni nome su Personaggio A/B”); FR/IT/EN.

## Modifiche previste
- `src/pages/AiIdentityPage.tsx`: cambiare il titolo dinamico con “Personaggio A & Personaggio B”.
- `src/components/AiIdentityChat.tsx`: aggiungere barra istruzioni sopra l’input.
- `src/components/AiIdentity/AiIdentityIdentificationPhase.tsx`: aggiungere testo di istruzioni visibile.
- `src/i18n/locales/*/apps/aiIdentity.json`: aggiungere chiavi per istruzioni (es. `identification.instructionsDrag`, `identification.instructionsAssign`).

## Verifica
- La chat mostra “Dialogue entre: Personaggio A & Personaggio B”.
- Dopo 2 domande, il bottone “Termina e riflettere” abilita e porta alla schermata di identificazione con drag-and-drop/selection visibili.

## Procedo?
- Applicherò le modifiche e verificherò che non ci sia più spoiler e che l’identificazione sia sempre raggiungibile.