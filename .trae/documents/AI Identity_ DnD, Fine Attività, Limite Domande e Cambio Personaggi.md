## Problemi da risolvere
- Il pulsante "Termina e riflettere" non si abilita: l’interfaccia conta i messaggi dell’array `messages`, ma in AI Identity gli input sono duplicati nei due pannelli e `ChatInterface` riceve `messages={[]}`.
- Il drag-and-drop non appare perché non si entra mai nella fase di identificazione (bottone disabilitato).
- Placeholder errato corretto; restano da verificare le traduzioni FR/IT.
- Richieste nuove funzionalità: scegliere un numero massimo di domande all’inizio; poter cambiare personaggi finché non si preme “Termina e riflettere”, con popup che mostra le domande rimanenti e chiede se terminare o continuare.

## Analisi tecnica
- `ChatInterface`: abilita "Termina e riflettere" se `userMessageCount >= minMessagesForEnd` (calcolato su `messages`): `src/components/shared/ChatInterface.tsx:58-60`.
- `AiIdentityChat`: gestisce messaggi separati (`messages1`, `messages2`) e passa `messages={[]}` a `ChatInterface`, quindi il conteggio risulta 0: `src/components/AiIdentityChat.tsx:579-597`.
- DnD è nella fase `identification`: appare solo dopo `onEndActivity`.

## Piano di implementazione
### 1) Abilitare correttamente "Termina e riflettere"
- Aggiungere a `ChatInterface` un prop opzionale `userMessageCountOverride`. Se presente, usarlo per calcolare `canEndActivity`.
- In `AiIdentityChat`, passare `userMessageCountOverride={messages1.filter(m => m.character === t('chat.you')).length}` e tenere `minMessagesForEnd=2`.
- Verificare che il bottone diventi cliccabile dopo 2 domande dell’utente.

### 2) Drag-and-drop visibile
- Con il punto 1, il passaggio a `activityPhase === "identification"` funzionerà: DnD già implementato in `AiIdentityIdentificationPhase`.
- Aggiungere un breve testo/i18n di istruzioni (es. "Trascina ogni nome su Personaggio A/B").

### 3) Limite massimo di domande
- In `AiIdentityPage`, aggiungere un selettore (es. `Select` o `InputNumber`) per scegliere `maxQuestions` prima di avviare la chat.
- Passare `maxQuestions` a `AiIdentityChat`.
- In `AiIdentityChat`, tracciare `userQuestionCount` e calcolare `remainingQuestions = maxQuestions - userQuestionCount`. Se `remainingQuestions <= 0`, disabilitare input/invio e mostrare una barra informativa; abilitare sempre "Termina e riflettere".
- In `ChatInterface`, opzionalmente mostrare un contatore "Domande rimanenti".

### 4) Cambio personaggi con popup
- Spostare la gestione del cambio personaggi nel contesto della chat (o intercettare il bottone esistente in `AiIdentityPage`).
- Quando l’utente clicca "Cambia personaggi":
  - Aprire un `AlertDialog` (Radix) che mostra le domande rimanenti.
  - Opzioni: "Termina e riflettere" (chiama `onEndActivity`) oppure "Continua" (chiude il popup), oppure "Cambiare personaggi" (torna alla selezione: `setShowChat(false)`).
- Per conoscere le domande rimanenti a livello di pagina, aggiungere un callback `onUserQuestion()` in `AiIdentityChat` che incrementa un contatore in `AiIdentityPage`, oppure far gestire il popup dentro `AiIdentityChat` con un prop `onExitToSelection()` fornito dalla pagina.

### 5) i18n
- Aggiungere chiavi per: "Domande massime", "Domande rimanenti", testi del popup (terminare/continuare/cambiare personaggi), istruzioni DnD.
- Aggiornare localizzazioni `it` e `fr` (minimo), con fallback per `en/de/es`.

### 6) Verifica
- Test manuale: Easy/Medium → scrivere 2 domande → il bottone si abilita → entra in identificazione con DnD; Hard → input testi; limite domande applicato; popup cambio personaggi mostra conteggio e offre scelta.
- Console: nessun errore "First content should be user"; placeholder localizzato.

## Modifiche di codice previste
- `src/components/shared/ChatInterface.tsx`: nuovo prop `userMessageCountOverride` e calcolo `canEndActivity`.
- `src/components/AiIdentityChat.tsx`: passaggio del conteggio override; gestione `maxQuestions`, `userQuestionCount`, banner di limite; callback `onUserQuestion()`; supporto a `onExitToSelection()` per popup interno.
- `src/pages/AiIdentityPage.tsx`: selettore `maxQuestions`; bottone "Cambiare personaggi" mostra `AlertDialog` con le scelte sfruttando i dati di conteggio; oppure delega ad `AiIdentityChat` via prop.
- `src/i18n/locales/*/apps/aiIdentity.json`: nuove chiavi per limite domande, popup, istruzioni DnD.

## Conferma
- Procedo con queste modifiche: abilitazione corretta del bottone, DnD raggiungibile, selezione del limite domande, popup di conferma cambio personaggi con conteggio domande rimanenti, i18n aggiornati.