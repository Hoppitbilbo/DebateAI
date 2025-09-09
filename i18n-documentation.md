# i18n Structure Documentation

This document outlines the structure of the internationalization (i18n) setup in this project.

## 1. Overview

The project uses the `i18next` and `react-i18next` libraries to handle translations. The main configuration is located in `src/i18n/index.ts`.

Key features of the configuration include:

- **Language Detection:** It uses `i18next-browser-languagedetector` to automatically detect the user's preferred language from the browser's settings or `localStorage`.
- **Supported Languages:** The application currently supports five languages:
    - German (`de`)
    - English (`en`)
    - Spanish (`es`)
    - French (`fr`)
    - Italian (`it`)
- **Default and Fallback Language:** The default and fallback language is set to Italian (`it`).
- **Namespaces:** The translations are organized into two namespaces:
    - `translation`: For the main application content.
    - `tutorial`: For the tutorial content.

## 2. File Structure

The i18n files are located in the `src/i18n/` directory.

```
src/i18n/
├── index.ts          # Main i18n configuration file
├── locales/          # Contains translation files for each language
│   ├── de/
│   ├── en/
│   │   ├── aboutPage.json
│   │   ├── apps/
│   │   │   ├── convinciTu.json
│   │   │   └── ... (other app-specific translations)
│   │   ├── apps.ts
│   │   ├── chat.json
│   │   ├── common.json
│   │   └── ... (other translation files)
│   ├── es/
│   ├── fr/
│   └── it/
└── tutorials/        # Contains tutorial translation files
    ├── de.json
    ├── en.json
    ├── es.json
    ├── fr.json
    └── it.json
```

### 2.1. `index.ts`

This is the entry point for the i18n module. It initializes `i18next` with the required configuration, including the resources (translations), default language, and language detection settings.

### 2.2. `locales/`

This directory contains one subdirectory for each supported language. Each language directory contains a set of JSON files, where each file corresponds to a specific part of the application (e.g., `common.json`, `aboutPage.json`).

The `index.ts` file within each language directory (e.g., `src/i18n/locales/en/index.ts`) is responsible for importing all the JSON translation files for that language and exporting them as a single object. This object is then imported into the main `src/i18n/index.ts` file.

### 2.3. `locales/[lang]/apps/`

This subdirectory contains JSON files for specific "apps" or features within the main application. This helps to keep the translations organized and modular.

The `apps.ts` file (e.g., `src/i18n/locales/en/apps.ts`) imports all the app-specific JSON files and exports them as a single object, which is then included in the main translation object for that language.

### 2.4. `tutorials/`

This directory contains one JSON file for each supported language. These files contain the translations for the tutorial content and are loaded into the `tutorial` namespace.

## 3. Translation Files

The translation files are simple JSON objects with key-value pairs.

- **Keys:** The keys are strings that are used to identify the translations in the code (e.g., `"common.loading"`).
- **Values:** The values are the translated strings for the corresponding language.

Some translation strings may contain placeholders (e.g., `{{count}}`) that can be interpolated with dynamic values at runtime.

## 4. Adding New Translations

To add a new translation, you need to:

1.  **Identify the correct file:** Determine which JSON file the new translation belongs to. If it's a shared translation, it should probably go in `common.json`. If it's specific to a page or feature, it should go in the corresponding file.
2.  **Add the key-value pair:** Add the new translation key and its value to the JSON file for each supported language.
3.  **Use the translation in the code:** Use the `useTranslation` hook from `react-i18next` to access the translation in your components.
