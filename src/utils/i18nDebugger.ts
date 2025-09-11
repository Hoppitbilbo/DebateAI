import i18n from '@/i18n';
import { toast } from '@/components/ui/sonner';
import { i18nAnalyzer } from './i18nAnalyzer';
import { visualErrorDetector, type VisualError } from './visualErrorDetector';

// Configurazione delle lingue supportate
const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'];
const DEFAULT_LANGUAGE = 'it';

// Interfacce per il debug
interface MissingTranslation {
  key: string;
  language: string;
  namespace?: string;
  context?: string;
}

interface DebugReport {
  missingTranslations: MissingTranslation[];
  missingFiles: { language: string; filename: string }[];
  visualErrors: { key: string; displayedValue: string; expectedType: 'translation' | 'key' }[];
  languageCompleteness: { [language: string]: number };
}

class I18nDebugger {
  private missingKeys: Set<string> = new Set();
  private debugMode: boolean = false;
  private alertsEnabled: boolean = true;
  private lastReportUpdate = 0;
  private reportUpdateCooldown = 1000; // 1 secondo tra aggiornamenti
  private debugReport: DebugReport = {
    missingTranslations: [],
    missingFiles: [],
    visualErrors: [],
    languageCompleteness: {}
  };

  constructor() {
    this.initializeDebugger();
  }

  private initializeDebugger() {
    // Abilita il debug mode se siamo in development
    this.debugMode = import.meta.env.DEV;
    
    // Ascolta gli eventi di chiavi mancanti
    i18n.on('missingKey', (lng: string, ns: string, key: string, res: string) => {
      this.handleMissingKey(lng, ns, key, res);
    });

    // Controlla la completezza delle traduzioni all'avvio
    if (this.debugMode) {
      this.performInitialCheck();
    }
  }

  private handleMissingKey(language: string, namespace: string, key: string, result: string) {
    const missingKey = `${namespace}:${key}`;
    
    if (!this.missingKeys.has(missingKey)) {
      this.missingKeys.add(missingKey);
      
      const missingTranslation: MissingTranslation = {
        key,
        language,
        namespace,
        context: this.getCurrentPageContext()
      };
      
      this.debugReport.missingTranslations.push(missingTranslation);
      
      // Console error esplicito per debugging
      console.error(`🚨 [i18n Debug] ERRORE: Chiave di traduzione mancante`, {
        key,
        language,
        namespace,
        context: missingTranslation.context,
        result,
        timestamp: new Date().toISOString()
      });
      
      if (this.alertsEnabled && this.debugMode) {
        this.showMissingKeyAlert(missingTranslation);
      }
      
      console.error(`🚨 I18N DEBUG: Chiave mancante '${key}' per la lingua '${language}' nel namespace '${namespace}'`);
    }
  }

  private getCurrentPageContext(): string {
    return window.location.pathname;
  }

  private showMissingKeyAlert(missing: MissingTranslation) {
    const message = `🚨 TRADUZIONE MANCANTE\n\n` +
      `📍 Pagina: ${missing.context}\n` +
      `🌍 Lingua: ${missing.language}\n` +
      `📂 Namespace: ${missing.namespace}\n` +
      `🔑 Chiave: ${missing.key}\n\n` +
      `💡 Azione richiesta: Aggiungere la traduzione nel file corrispondente`;
    
    toast.error("Traduzione Mancante", {
      description: message,
      duration: 8000,
      action: {
        label: "Copia Chiave",
        onClick: () => navigator.clipboard.writeText(missing.key)
      }
    });
  }

  // Controlla se un valore è una chiave non tradotta
  public checkIfDisplayingKey(value: string, expectedKey?: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    // Ignora nomi propri che non necessitano traduzione
    const properNouns = ['AiDebate.tech', 'github', 'GitHub', 'Github'];
    if (properNouns.some(noun => value.toLowerCase().includes(noun.toLowerCase()))) {
      return false;
    }
    
    // Controlla se il valore sembra una chiave i18n
    const isKey = /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(value) && 
                  (value.includes('.') || value.includes('_'));
    
    if (isKey && this.debugMode) {
      this.debugReport.visualErrors.push({
        key: expectedKey || value,
        displayedValue: value,
        expectedType: 'translation'
      });
      
      if (this.alertsEnabled) {
        this.showVisualErrorAlert(value, 'key');
      }
    }
    
    return isKey;
  }

  // Controlla se il testo è in italiano quando dovrebbe essere in un'altra lingua
  public checkLanguageMismatch(text: string, expectedLanguage: string): boolean {
    if (!text || expectedLanguage === 'it') return false;
    
    // Pattern per riconoscere testo italiano
    const italianPatterns = [
      /\b(il|la|lo|gli|le|un|una|uno|del|della|dello|degli|delle)\b/i,
      /\b(che|con|per|tra|fra|su|da|di|in|a)\b/i,
      /\b(questo|questa|questi|queste|quello|quella|quelli|quelle)\b/i,
      /\b(sono|è|sei|siamo|siete|hanno|hai|ha|abbiamo|avete)\b/i
    ];
    
    const seemsItalian = italianPatterns.some(pattern => pattern.test(text));
    
    if (seemsItalian && this.debugMode) {
      this.debugReport.visualErrors.push({
        key: 'language_mismatch',
        displayedValue: text,
        expectedType: 'translation'
      });
      
      if (this.alertsEnabled) {
        this.showVisualErrorAlert(text, 'language', expectedLanguage);
      }
    }
    
    return seemsItalian;
  }

  private showVisualErrorAlert(value: string, errorType: 'key' | 'language', expectedLang?: string) {
    let message = '';
    
    if (errorType === 'key') {
      message = `🎯 ERRORE VISUALIZZAZIONE\n\n` +
        `📍 Pagina: ${this.getCurrentPageContext()}\n` +
        `⚠️ Problema: Viene mostrata la chiave invece della traduzione\n` +
        `🔑 Chiave mostrata: ${value}\n\n` +
        `💡 Soluzione: Verificare che la traduzione esista per la lingua corrente`;
    } else if (errorType === 'language') {
      message = `🌍 ERRORE LINGUA\n\n` +
        `📍 Pagina: ${this.getCurrentPageContext()}\n` +
        `⚠️ Problema: Testo in italiano mostrato per lingua ${expectedLang}\n` +
        `📝 Testo: ${value.substring(0, 50)}...\n\n` +
        `💡 Soluzione: Aggiungere traduzione per la lingua ${expectedLang}`;
    }
    
    // Console error esplicito per errori visivi
    console.error(`🚨 [i18n Debug] ERRORE VISIVO: ${errorType === 'key' ? 'Chiave visualizzata' : 'Lingua sbagliata'}`, {
      value,
      errorType,
      expectedLanguage: expectedLang,
      currentLanguage: i18n.language,
      timestamp: new Date().toISOString(),
      location: window.location.pathname
    });
    
    toast.warning("Errore di Visualizzazione", {
      description: message,
      duration: 6000
    });
  }

  private async performInitialCheck() {
    console.log('🔍 I18N DEBUG: Avvio controllo completezza traduzioni...');
    
    try {
      // Esegue analisi completa della struttura
      const analysisResult = await i18nAnalyzer.analyzeTranslationStructure();
      
      // Aggiorna il report con i dati dell'analisi
      this.debugReport.missingFiles = analysisResult.missingFiles;
      this.debugReport.languageCompleteness = analysisResult.languageCompleteness;
      
      // Avvia il rilevamento automatico degli errori visivi
      this.startVisualErrorDetection();
      
      // Mostra alert per problemi critici
      if (analysisResult.missingFiles.length > 0) {
        this.showCriticalIssuesAlert(analysisResult.missingFiles.length, analysisResult.recommendations);
      }
      
      setTimeout(() => {
        this.showInitialReport();
      }, 1000);
    } catch (error) {
      console.error('Errore durante il controllo iniziale i18n:', error);
      this.checkLanguageCompleteness(); // Fallback al metodo precedente
      
      setTimeout(() => {
        this.showInitialReport();
      }, 2000);
    }
  }

  private checkLanguageCompleteness() {
    // Metodo di fallback se l'analisi completa fallisce
    SUPPORTED_LANGUAGES.forEach(lang => {
      // Stima basata su euristica semplice
      let completeness = 85; // Base
      if (lang === DEFAULT_LANGUAGE) completeness = 100;
      if (lang === 'en') completeness = 95;
      if (lang === 'de') completeness = 90;
      
      this.debugReport.languageCompleteness[lang] = completeness;
    });
  }

  private showInitialReport() {
    if (!this.debugMode || !this.alertsEnabled) return;
    
    const report = this.generateReport();
    
    toast.info("Report I18N Debug", {
      description: report,
      duration: 10000,
      action: {
        label: "Dettagli Console",
        onClick: () => console.table(this.debugReport)
      }
    });
  }

  public generateReport(): string {
    const missing = this.debugReport.missingTranslations.length;
    const visual = this.debugReport.visualErrors.length;
    const missingFiles = this.debugReport.missingFiles.length;
    const currentLangCompleteness = this.debugReport.languageCompleteness[i18n.language] || 0;
    
    // Ottieni errori dal rilevatore visivo
    const visualErrors = visualErrorDetector.getErrors();
    const highSeverityErrors = visualErrors.filter(e => e.severity === 'high').length;
    
    return `📊 STATO TRADUZIONI\n\n` +
      `❌ Traduzioni mancanti: ${missing}\n` +
      `⚠️ Errori visualizzazione: ${visual}\n` +
      `🚨 Errori critici rilevati: ${highSeverityErrors}\n` +
      `📁 File mancanti: ${missingFiles}\n` +
      `🌍 Lingua corrente: ${i18n.language} (${currentLangCompleteness}% completa)\n\n` +
      `💡 Controlla la console per dettagli completi`;
  }

  // Metodi pubblici per il controllo manuale
  public enableAlerts() {
    this.alertsEnabled = true;
  }

  public disableAlerts() {
    this.alertsEnabled = false;
  }

  public getDebugReport(): DebugReport {
    return { ...this.debugReport };
  }

  public clearReport() {
    this.debugReport = {
      missingTranslations: [],
      missingFiles: [],
      visualErrors: [],
      languageCompleteness: {}
    };
    this.missingKeys.clear();
  }

  private startVisualErrorDetection() {
    // Configura il rilevatore per essere più sensibile in modalità debug
    visualErrorDetector.updateConfig({
      enabled: true,
      autoScan: true,
      scanInterval: 3000, // Scan più frequenti
      alertThreshold: 2 // Alert più sensibili
    });
    
    // Esegue una scansione iniziale dopo un breve delay
    setTimeout(() => {
      const initialErrors = visualErrorDetector.scanPage();
      if (initialErrors.length > 0) {
        this.handleVisualErrors(initialErrors);
      }
    }, 2000);
    
    console.log('👁️ Rilevamento errori visivi attivato');
  }
  
  private handleVisualErrors(errors: VisualError[]) {
    const now = Date.now();
    
    // Throttling per evitare aggiornamenti troppo frequenti
    if (now - this.lastReportUpdate < this.reportUpdateCooldown) {
      return;
    }
    
    // Console error esplicito per errori visivi rilevati
    if (errors.length > 0) {
      console.error(`🚨 [i18n Debug] ERRORI VISIVI RILEVATI (${errors.length})`, {
        errors: errors.map(e => ({
          key: e.key,
          displayedText: e.displayedText,
          expectedType: e.expectedType,
          severity: e.severity,
          location: e.location
        })),
        timestamp: new Date().toISOString(),
        currentLanguage: i18n.language
      });
    }
    
    // Aggiorna il report con gli errori visivi solo se ci sono cambiamenti
    const newVisualErrors = errors.map(error => ({
      key: error.key,
      displayedValue: error.displayedText,
      expectedType: error.expectedType
    }));
    
    // Confronta con gli errori esistenti per evitare aggiornamenti inutili
    const hasChanges = JSON.stringify(this.debugReport.visualErrors) !== JSON.stringify(newVisualErrors);
    
    if (hasChanges) {
      this.debugReport.visualErrors = newVisualErrors;
      this.lastReportUpdate = now;
    }
    
    // Mostra alert specifici per problemi italiani
    if (i18n.language === 'it') {
      const italianIssues = errors.filter(error => 
        error.key.includes('.') && !this.looksLikeItalian(error.key)
      );
      
      if (italianIssues.length > 0) {
        this.showItalianLanguageAlert(italianIssues);
      }
    }
  }
  
  private looksLikeItalian(text: string): boolean {
    const italianIndicators = ['casa', 'menu', 'impostazioni', 'salva', 'annulla', 'cerca'];
    return italianIndicators.some(word => text.toLowerCase().includes(word));
  }
  
  private showItalianLanguageAlert(errors: VisualError[]) {
    const errorExamples = errors.slice(0, 3).map(e => 
      `• ${e.location}: "${e.key.substring(0, 25)}..."`
    ).join('\n');
    
    toast.warning("Problemi Lingua Italiana", {
      description: `🇮🇹 Rilevati ${errors.length} problemi con la lingua italiana:\n\n${errorExamples}\n\n💡 Verifica che le traduzioni italiane siano complete`,
      duration: 8000,
      action: {
        label: "Dettagli",
        onClick: () => console.table(errors)
      }
    });
  }

  private showCriticalIssuesAlert(missingFilesCount: number, recommendations: string[]) {
    const message = `🚨 PROBLEMI CRITICI RILEVATI\n\n` +
      `📁 File mancanti: ${missingFilesCount}\n` +
      `⚠️ Questo può causare errori di visualizzazione\n\n` +
      `💡 Raccomandazioni principali:\n${recommendations.slice(0, 3).join('\n')}`;
    
    toast.error("Problemi I18N Critici", {
      description: message,
      duration: 10000,
      action: {
        label: "Analisi Completa",
        onClick: () => console.table(this.debugReport)
      }
    });
  }

  // Hook per componenti React
  public useTranslationWithDebug(key: string, options?: any) {
    const translation = i18n.t(key, options);
    const translationStr = String(translation);
    
    // Controlla se viene mostrata la chiave invece della traduzione
    if (this.debugMode) {
      this.checkIfDisplayingKey(translationStr, key);
      this.checkLanguageMismatch(translationStr, i18n.language);
    }
    
    return translation;
  }
}

// Istanza singleton del debugger
export const i18nDebugger = new I18nDebugger();

// Hook personalizzato per React
export const useTranslationWithDebug = (key: string, options?: any) => {
  return i18nDebugger.useTranslationWithDebug(key, options);
};

// Funzioni di utilità
export const enableI18nDebugAlerts = () => i18nDebugger.enableAlerts();
export const disableI18nDebugAlerts = () => i18nDebugger.disableAlerts();
export const getI18nDebugReport = () => i18nDebugger.getDebugReport();
export const clearI18nDebugReport = () => i18nDebugger.clearReport();

export default i18nDebugger;