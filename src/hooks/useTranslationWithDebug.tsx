import { useTranslation as useOriginalTranslation } from 'react-i18next';
import { useEffect, useCallback } from 'react';
import { i18nDebugger } from '@/utils/i18nDebugger';

/**
 * Hook personalizzato che estende useTranslation con funzionalità di debug
 * Rileva automaticamente:
 * - Chiavi di traduzione mancanti
 * - Testo in lingua sbagliata
 * - Chiavi mostrate invece delle traduzioni
 */
export const useTranslationWithDebug = (ns?: string | string[]) => {
  const { t: originalT, i18n, ready, ...rest } = useOriginalTranslation(ns);

  // Wrapper per la funzione t che include il debug
  const t = useCallback((key: string, options?: any) => {
    const translation = originalT(key, options);
    const translationStr = String(translation);
    
    // Solo in modalità development
    if (import.meta.env.DEV) {
      // Controlla se viene mostrata la chiave invece della traduzione
      const isDisplayingKey = i18nDebugger.checkIfDisplayingKey(translationStr, key);
      
      // Controlla se il testo è nella lingua sbagliata
      if (!isDisplayingKey) {
        i18nDebugger.checkLanguageMismatch(translationStr, i18n.language);
      }
      
      // Log per debug avanzato
      if (isDisplayingKey) {
        console.warn(`🔑 I18N DEBUG: Chiave '${key}' non tradotta per lingua '${i18n.language}'`);
      }
    }
    
    return translation;
  }, [originalT, i18n.language]);

  return {
    t,
    i18n,
    ready,
    ...rest
  };
};

/**
 * Hook per componenti che vogliono solo la funzione t con debug
 */
export const useT = (ns?: string | string[]) => {
  const { t } = useTranslationWithDebug(ns);
  return t;
};

/**
 * Hook per monitorare lo stato delle traduzioni in tempo reale
 */
export const useTranslationStatus = () => {
  const { i18n } = useOriginalTranslation();
  
  const getStatus = useCallback(() => {
    const report = i18nDebugger.getDebugReport();
    return {
      currentLanguage: i18n.language,
      missingCount: report.missingTranslations.length,
      visualErrorsCount: report.visualErrors.length,
      completeness: report.languageCompleteness[i18n.language] || 0,
      hasErrors: report.missingTranslations.length > 0 || report.visualErrors.length > 0
    };
  }, [i18n.language]);
  
  return getStatus();
};

export default useTranslationWithDebug;