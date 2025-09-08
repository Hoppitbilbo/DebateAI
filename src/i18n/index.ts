import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import main translation files
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';

// Import tutorial translation files
import enTutorials from './tutorials/en.json';
import esTutorials from './tutorials/es.json';
import frTutorials from './tutorials/fr.json';
import deTutorials from './tutorials/de.json';
import itTutorials from './tutorials/it.json';

const resources = {
  en: { 
    translation: en,
    tutorials: enTutorials
  },
  es: { 
    translation: es,
    tutorials: esTutorials
  },
  fr: { 
    translation: fr,
    tutorials: frTutorials
  },
  de: { 
    translation: de,
    tutorials: deTutorials
  },
  it: { 
    translation: it,
    tutorials: itTutorials
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'it', // Default to Italian as the original language
    debug: false,
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

export default i18n;
