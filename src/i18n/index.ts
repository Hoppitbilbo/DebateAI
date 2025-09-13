import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import it from './locales/it';

// Import tutorial translation files
import enTutorials from './tutorials/en.json';
import esTutorials from './tutorials/es.json';
import frTutorials from './tutorials/fr.json';
import deTutorials from './tutorials/de.json';
import itTutorials from './tutorials/it.json';

const resources = {
  en: { 
    translation: en,
    tutorial: enTutorials
  },
  es: { 
    translation: es,
    tutorial: esTutorials
  },
  fr: { 
    translation: fr,
    tutorial: frTutorials
  },
  de: { 
    translation: de,
    tutorial: deTutorials
  },
  it: { 
    translation: it,
    tutorial: itTutorials
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: undefined, // Let the language detector determine the language
    fallbackLng: 'it',
    defaultNS: 'translation',
    ns: ['translation', 'tutorial'],
    debug: false,
    saveMissing: true, // This is useful for development to discover missing keys
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'], // Check localStorage first, then browser language
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      lookupSessionStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
  });

// Gestione avanzata delle chiavi mancanti
i18n.on('missingKey', (lng, ns, key, res) => {
  const errorMessage = `🚨 I18N: Chiave '${key}' mancante per lingua '${lng}' nel namespace '${ns}'`;
  console.error(errorMessage);
  
  // In development, mostra anche informazioni aggiuntive
  if (import.meta.env.DEV) {
    // Debug info disattivato
    // console.group('🔍 I18N Debug Info');
    // console.log('Lingua:', lng);
    // console.log('Namespace:', ns);
    // console.log('Chiave:', key);
    // console.log('Pagina corrente:', window.location.pathname);
    // console.log('Risultato fallback:', res);
    // console.groupEnd();
  }
});

// Set Italian as default only if no language is detected
if (!localStorage.getItem('i18nextLng') && !navigator.language.startsWith('en') && !navigator.language.startsWith('es') && !navigator.language.startsWith('fr') && !navigator.language.startsWith('de')) {
  localStorage.setItem('i18nextLng', 'it');
  i18n.changeLanguage('it');
}

export default i18n;
