## Contesto attuale
- Nel repository non esistono modalità corso (né "corso completo" né "corso singolo"), né strumenti per alias dei partecipanti o gestione assenti.
- Esistono però pattern UI/UX e stato locale riutilizzabili (AppLayout, i18n, toast, componenti shared).

## Obiettivo
- Modalità "Corso Completo" con due strumenti:
  1) Merge alias dei partecipanti: unisce nomi/alias che si riferiscono alla stessa persona.
  2) Gestione assenti: aggiunge/segna partecipanti assenti (e rientri) in elenco.
- Allineare UX a "corso singolo" (logica semplice, locale, i18n completa).

## Modello dati
- `Participant { id, name, aliases: string[], status: 'present' | 'absent' }`
- `Roster { participants: Participant[], aliasIndex: Map<string, id> }`
- Persistenza: `localStorage` (chiave `course_roster`) per uso rapido; estendibile a backend.

## Funzionalità alias merge
- UI: campo ricerca + elenco partecipanti, seleziona due o più elementi → bottone "Unisci alias".
- Logica: 
  - Scegli un "nome canonico" (il più completo), sposta gli altri in `aliases`.
  - Aggiorna `aliasIndex` per ogni alias → punta all’`id` canonico.
  - Opzionale: storicizza operazioni (`mergeHistory`) per annulla.

## Funzionalità assenti
- UI: input rapido "Aggiungi assente" con suggerimenti (nomi esistenti) o nuovi.
- Logica:
  - Se esiste → `status='absent'`.
  - Se non esiste → crea partecipante con `status='absent'`.
  - Azioni: "Segna presente", "Rimuovi".

## UI/Componenti
- Nuova pagina/route: `src/pages/CourseCompletePage.tsx` con `AppLayout`.
- Componenti:
  - `CourseRosterManager.tsx`: tab "Partecipanti" (lista + filtri), tab "Alias" (merge), tab "Assenti" (aggiungi/gestisci).
  - Usa componenti UI esistenti (Card, Button, Input, Tooltip, AlertDialog, Toast).
- i18n: `courseComplete.*` (titoli, etichette, messaggi di conferma/errore) in it/en/fr.

## Integrazione con UX esistente
- Navbar: voce "Corso Completo" (opzionale, se vuoi visibile).
- Nessun impatto sulle app AI Identity: strumento indipendente.

## Edge cases
- Duplicati: prevenire merge tra nomi identici.
- Alias conflittuali: chiedere conferma se alias già mappato altrove.
- Rimozione alias: supporto "separa alias" per errori.

## Verifica
- Flusso alias: crea 3 partecipanti, unisci 2 alias → roster mostra 1 canonico + aliases; indice alias risolve correttamente.
- Flusso assenti: aggiungi/segna presente; persistenza in localStorage; UI reattiva.
- i18n: nessun log di chiavi mancanti.

## Deliverables
- Nuova pagina e componenti con stato/persistenza locale.
- i18n aggiornato (it/en/fr).
- Route registrata e collegamento (se desideri in navbar).

## Conferma
- Se va bene, implemento subito pagina, componenti, i18n e routing, seguendo i pattern dell’attuale UI e usando la stessa "modalità corso singolo" come guida semplificata.