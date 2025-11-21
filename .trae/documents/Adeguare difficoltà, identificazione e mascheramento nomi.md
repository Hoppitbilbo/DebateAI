## Cambiamenti richiesti

* Scegliere la **difficoltà all’inizio** (setup) e non mostrarla più in chat.

* **Easy**: solo drag‑and‑drop per assegnare i nomi (niente select, niente testo).

* **Medium**: solo **select** a 4 nomi per A e B (niente drag‑and‑drop).

* **Hard**: **solo testo** (nessun suggerimento, nessun DnD o select).

* Nel **riassunto della chat** dentro l’identificazione, mascherare i nomi reali con **“Personaggio A/B”**.

## Implementazione

* `AiIdentityPage`:

  * Aggiungere selettore difficoltà (radio o buttons) in setup.

  * Passare `initialDifficulty` a `AiIdentityChat`.

* `AiIdentityChat`:

  * Accettare `initialDifficulty`, inizializzare lo state e **rimuovere il blocco dei pulsanti** difficoltà in chat.

  * Mantenere la logica esistente per chips “possible names” solo in Medium; nessun suggerimento in Hard.

* `AiIdentityIdentificationPhase`:

  * **Easy**: mostrare solo DnD (due nomi), nascondere Select.

  * **Medium**: mostrare solo Select a 4 opzioni per A e B, nascondere DnD.

  * **Hard**: non mostrare la fase (resta input testuale in reflection).

  * Nel pannello “Chat precedente”, etichettare le risposte come **Personaggio A/B** mappando `characterName`.

## Verifica

* Setup: scelta difficoltà e avvio chat.

* Easy: pulsante “Termina e riflettere” porta a DnD; nessun select; nessun testo.

* Medium: identificazione con Select (4 nomi) e senza DnD.

* Hard: niente identificazione, solo testo in reflection; nessun suggerimento in chat.

* Pannello “Chat precedente” mostra **Personaggio A/B**.

## Procedo

* Applico le modifiche sopra e verifico su dev che il flusso rispetti i vincoli.

