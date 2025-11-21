## Problema
- Console mostra errori i18n: chiavi mancanti `apps.aiIdentity.setup.maxQuestionsTitle` e `apps.aiIdentity.setup.maxQuestionsLabel` (lingua it). Non risultano presenti in nessuna lingua.

## Soluzione
- Aggiungere le due chiavi nel blocco `setup` di `apps/aiIdentity.json` per le lingue: italiano, francese, inglese (e facoltativamente tedesco e spagnolo per coerenza), con traduzioni appropriate.
- Verificare che i log non compaiano più e che il selettore “Numero massimo di domande” mostri testo localizzato.

## Implementazione
- Aggiornare i file:
  - `src/i18n/locales/it/apps/aiIdentity.json` → `setup.maxQuestionsTitle`, `setup.maxQuestionsLabel`
  - `src/i18n/locales/fr/apps/aiIdentity.json` → stesse chiavi in francese
  - `src/i18n/locales/en/apps/aiIdentity.json` → stesse chiavi in inglese
  - (opzionale) `de`, `es` per uniformità

## Verifica
- Ricaricare la pagina setup e controllare che il testo compaia correttamente e che i log i18n siano assenti.

## Conferma
- Procedo ad aggiungere le chiavi i18n nelle lingue indicate e verifico la rimozione degli errori di console.