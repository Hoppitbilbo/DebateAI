## Problema
- Mancano le chiavi i18n `apps.aiIdentity.identification.instructionsBanner` (IT). La chat mostra un banner di istruzioni e richiede questa chiave.

## Soluzione
- Aggiungere `identification.instructionsBanner` nei file delle lingue utilizzate:
  - Italiano (`it`): testo guida per premere “Termina e riflettere” dopo almeno 2 domande.
  - Inglese (`en`): stessa chiave in inglese.
  - Francese (`fr`): stessa chiave in francese.

## Implementazione
- Inserire la chiave sotto l’oggetto `identification` in ciascun `apps/aiIdentity.json`.
- Verificare che il banner si traduca correttamente e che i log i18n spariscano.

## Verifica
- Ricaricare la pagina, vedere il banner in alto alla chat localizzato; nessun errore i18n.

## Procedo
- Aggiungo le chiavi a it/en/fr e verifico la risoluzione dell’errore.