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
    lng: 'it', // Force Italian as the default language
    fallbackLng: 'it',
    defaultNS: 'translation',
    ns: ['translation', 'tutorial'],
    debug: false,
    saveMissing: true, // This is useful for development to discover missing keys
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
      lookupSessionStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false,
    },
  });

i18n.on('missingKey', (lng, ns, key, res) => {
  console.error(`Translation key '${key}' not found for language '${lng}'`);
});


export default i18n;
