import i18n, { type BackendModule, type ReadCallback, type ResourceKey } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Italian, the fallback, is in the main bundle. The other languages and the
// tutorial texts (namespaces used only on their routes) are downloaded when
// needed: a page in one language should not carry all five.
import it from './locales/it';

type Loader = () => Promise<{ default: ResourceKey }>;

const bundles: Record<string, Record<string, Loader>> = {
  translation: {
    en: () => import('./locales/en'),
    es: () => import('./locales/es'),
    fr: () => import('./locales/fr'),
    de: () => import('./locales/de'),
  },
  tutorial: {
    it: () => import('./tutorials/it.json'),
    en: () => import('./tutorials/en.json'),
    es: () => import('./tutorials/es.json'),
    fr: () => import('./tutorials/fr.json'),
    de: () => import('./tutorials/de.json'),
  },
  tutorialsPage: {
    it: () => Promise.resolve({ default: it.tutorialsPage }), // already in the Italian bundle
    en: () => import('./locales/en/tutorialsPage.json'),
    es: () => import('./locales/es/tutorialsPage.json'),
    fr: () => import('./locales/fr/tutorialsPage.json'),
    de: () => import('./locales/de/tutorialsPage.json'),
  },
  studentTutorial: {
    it: () => import('./studentTutorials/it.json'),
    en: () => import('./studentTutorials/en.json'),
    es: () => import('./studentTutorials/es.json'),
    fr: () => import('./studentTutorials/fr.json'),
    de: () => import('./studentTutorials/de.json'),
  },
};

/** Loads a namespace of a language from its own chunk (a missing one is empty). */
const lazyBundles: BackendModule = {
  type: 'backend',
  init() {},
  read(lng: string, ns: string, callback: ReadCallback) {
    const load = bundles[ns]?.[lng];
    if (!load) {
      callback(null, {});
      return;
    }
    load().then((m) => callback(null, m.default), (e: Error) => callback(e, null));
  },
};

/** Resolves once the detected language is ready to render (also when its download failed). */
export const i18nReady = i18n
  .use(lazyBundles)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { it: { translation: it } },
    partialBundledLanguages: true,
    load: 'languageOnly',
    lng: undefined, // Let the language detector determine the language
    fallbackLng: 'it',
    defaultNS: 'translation',
    ns: ['translation'],
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
  })
  .then(() => undefined, () => undefined);

// The page language follows the interface (screen readers, hyphenation,
// spell checking); index.html says "it" until the detected language is known.
const syncDocumentLang = (lng?: string) => {
  if (lng && typeof document !== 'undefined') document.documentElement.lang = lng.slice(0, 2);
};
i18n.on('languageChanged', syncDocumentLang);
syncDocumentLang(i18n.language);

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
