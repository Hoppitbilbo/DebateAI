import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import en from './locales/en';
import es from './locales/es.json';
import fr from './locales/fr';
import de from './locales/de.json';
import it from './locales/it';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'it', // Default to Italian as the original language
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
