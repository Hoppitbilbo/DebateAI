import i18n from '@/i18n';
import { toast } from '@/components/ui/sonner';
import { i18nAnalyzer } from './i18nAnalyzer';
import { visualErrorDetector, type VisualError } from './visualErrorDetector';

type TranslationOptions = Record<string, unknown>;

// Configurazione delle lingue supportate
const SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'];
const DEFAULT_LANGUAGE = 'it';

// Enumerazioni per categorizzazione errori
enum ErrorPriority {
  CRITICAL = 'critical',
  HIGH = 'high', 
  MEDIUM = 'medium',
  LOW = 'low'
}

enum ErrorCategory {
  MISSING_KEY = 'missing_key',
  MISSING_FILE = 'missing_file',
  UNTRANSLATED_CONTENT = 'untranslated_content',
  LANGUAGE_MISMATCH = 'language_mismatch',
  VISUAL_ERROR = 'visual_error'
}

// Interfacce per il debug
interface MissingTranslation {
  key: string;
  language: string;
  namespace?: string;
  context?: string;
  priority?: ErrorPriority;
  category?: ErrorCategory;
  timestamp?: Date;
}

interface DebugReport {
  missingTranslations: MissingTranslation[];
  missingFiles: { language: string; filename: string }[];
  visualErrors: { key: string; displayedValue: string; expectedType: 'translation' | 'key' }[];
  languageCompleteness: { [language: string]: number };
  errorsByPriority: { [key in ErrorPriority]: number };
  errorsByCategory: { [key in ErrorCategory]: number };
  totalKeys: number;
  timestamp: Date;
}

class I18nDebugger {
  private missingKeys: Set<string> = new Set();
  private debugMode: boolean = false;
  private alertsEnabled: boolean = false;
  private lastReportUpdate = 0;
  private reportUpdateCooldown = 1000; // 1 secondo tra aggiornamenti
  private debugReport: DebugReport = {
    missingTranslations: [],
    missingFiles: [],
    visualErrors: [],
    languageCompleteness: {},
    errorsByPriority: {
      [ErrorPriority.CRITICAL]: 0,
      [ErrorPriority.HIGH]: 0,
      [ErrorPriority.MEDIUM]: 0,
      [ErrorPriority.LOW]: 0
    },
    errorsByCategory: {
      [ErrorCategory.MISSING_KEY]: 0,
      [ErrorCategory.MISSING_FILE]: 0,
      [ErrorCategory.UNTRANSLATED_CONTENT]: 0,
      [ErrorCategory.LANGUAGE_MISMATCH]: 0,
      [ErrorCategory.VISUAL_ERROR]: 0
    },
    totalKeys: 0,
    timestamp: new Date()
  };

  constructor() {
    this.initializeDebugger();
  }

  private initializeDebugger() {
    // Debug mode completamente disattivato
    this.debugMode = false;
    this.alertsEnabled = false;
    
    // Non ascoltare più gli eventi di chiavi mancanti
    // i18n.on('missingKey', (lng: string, ns: string, key: string, res: string) => {
    //   this.handleMissingKey(lng, ns, key, res);
    // });

    // Non controllare più la completezza delle traduzioni
    // if (this.debugMode) {
    //   this.performInitialCheck();
    // }
  }

  private handleMissingKey(language: string, namespace: string, key: string, result: string) {
    const missingKey = `${namespace}:${key}`;
    
    if (!this.missingKeys.has(missingKey)) {
      this.missingKeys.add(missingKey);
      
      const priority = this.calculateErrorPriority(key, namespace, language);
      const category = ErrorCategory.MISSING_KEY;
      
      const missingTranslation: MissingTranslation = {
        key,
        language,
        namespace,
        context: this.getCurrentPageContext(),
        priority,
        category,
        timestamp: new Date()
      };
      
      // Aggiorna contatori per priorità e categoria
      this.debugReport.errorsByPriority[priority]++;
      this.debugReport.errorsByCategory[category]++;
      
      this.debugReport.missingTranslations.push(missingTranslation);
      
      // Console error disattivato
      // console.group(`🚨 [i18n Debug] TRADUZIONE MANCANTE`);
      // console.error(`❌ ERRORE: Chiave di traduzione non trovata`);
      // console.table({
      //   '🔑 Chiave': key,
      //   '🌍 Lingua': language,
      //   '📂 Namespace': namespace,
      //   '📍 Pagina': missingTranslation.context,
      //   '⏰ Timestamp': new Date().toLocaleString('it-IT'),
      //   '📄 File atteso': `src/i18n/locales/${language}/${namespace}.json`
      // });
      // console.error(`🔍 Valore restituito:`, result);
      // console.error(`💡 SOLUZIONE: Aggiungi la chiave "${key}" nel file src/i18n/locales/${language}/${namespace}.json`);
      // console.groupEnd();
      
      if (this.alertsEnabled && this.debugMode) {
        this.showMissingKeyAlert(missingTranslation);
      }
    }
  }

  private getCurrentPageContext(): string {
    return window.location.pathname;
  }

  private showMissingKeyAlert(missing: MissingTranslation) {
    const suggestions = this.generateTranslationSuggestions(missing);
    
    const message = `🚨 TRADUZIONE MANCANTE\n\n` +
      `📍 Pagina: ${missing.context}\n` +
      `🌍 Lingua: ${missing.language}\n` +
      `📂 Namespace: ${missing.namespace}\n` +
      `🔑 Chiave: ${missing.key}\n\n` +
      `💡 SUGGERIMENTI:\n${suggestions.join('\n')}`;
    
    toast.error("Traduzione Mancante", {
      description: message,
      duration: 10000,
      action: {
        label: "Copia Soluzione",
        onClick: () => {
          const solution = this.generateTranslationSolution(missing);
          navigator.clipboard.writeText(solution);
          toast.success("Soluzione copiata!", {
            description: "Incolla nel file di traduzione corrispondente"
          });
        }
      }
    });
  }

  // Controlla se un valore è una chiave non tradotta con algoritmi migliorati
  public checkIfDisplayingKey(value: string, expectedKey?: string): boolean {
    if (!value || typeof value !== 'string') return false;
    
    // Ignora nomi propri, URL, email e altri contenuti che non necessitano traduzione
    const exemptPatterns = [
      /^https?:\/\//i, // URL
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i, // Email
      /^\d+(\.\d+)?[%$€£¥]?$/i, // Numeri e valute
      /^(AiDebate\.tech|github|GitHub|Github|React|TypeScript|JavaScript)$/i, // Nomi propri
      /^[A-Z]{2,}$/i, // Acronimi (es. API, URL, etc.)
      /^\d{4}-\d{2}-\d{2}$/i, // Date ISO
      /^#[0-9a-fA-F]{3,6}$/i // Colori hex
    ];
    
    if (exemptPatterns.some(pattern => pattern.test(value))) {
      return false;
    }
    
    // Pattern migliorati per rilevare chiavi i18n
    const keyPatterns = [
      // Pattern classici per chiavi i18n
      /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9._-]*$/,
      // Pattern per chiavi con underscore
      /^[a-zA-Z][a-zA-Z0-9_]*_[a-zA-Z0-9_]*$/,
      // Pattern per chiavi camelCase con punti
      /^[a-z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/,
      // Pattern per chiavi con namespace multipli
      /^[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9]*\.[a-zA-Z][a-zA-Z0-9._-]*$/
    ];
    
    const isLikelyKey = keyPatterns.some(pattern => pattern.test(value));
    
    // Controlli aggiuntivi per ridurre falsi positivi
    if (isLikelyKey) {
      // Esclude se sembra un nome di classe CSS
      if (value.includes('-') && !value.includes('.')) {
        return false;
      }
      
      // Esclude se è troppo lungo per essere una chiave
      if (value.length > 100) {
        return false;
      }
      
      // Esclude se contiene spazi (le chiavi non dovrebbero averne)
      if (value.includes(' ')) {
        return false;
      }
      
      // Controllo semantico: se contiene parole comuni italiane, probabilmente non è una chiave
      const italianWords = ['casa', 'menu', 'pagina', 'utente', 'sistema', 'errore', 'successo'];
      const containsItalianWords = italianWords.some(word => 
        value.toLowerCase().includes(word.toLowerCase())
      );
      
      if (containsItalianWords) {
        return false;
      }
    }
    
    if (isLikelyKey && this.debugMode) {
      // Calcola la confidenza del rilevamento
      const confidence = this.calculateKeyDetectionConfidence(value);
      
      this.debugReport.visualErrors.push({
        key: expectedKey || value,
        displayedValue: value,
        expectedType: 'translation'
      });
      
      // Log disattivato
      // console.group(`🔑 [i18n Debug] CHIAVE NON TRADOTTA RILEVATA`);
      // console.table({
      //   '🔍 Valore': value,
      //   '🎯 Confidenza': `${confidence}%`,
      //   '📍 Pagina': window.location.pathname,
      //   '🌍 Lingua': i18n.language,
      //   '⏰ Timestamp': new Date().toLocaleString('it-IT')
      // });
      // console.error(`💡 AZIONE: Verifica se "${value}" dovrebbe essere tradotto`);
      // console.groupEnd();
      
      if (this.alertsEnabled && confidence > 70) {
        this.showVisualErrorAlert(value, 'key');
      }
    }
    
    return isLikelyKey;
  }
  
  // Calcola la confidenza del rilevamento di una chiave
  private calculateKeyDetectionConfidence(value: string): number {
    let confidence = 0;
    
    // Fattori che aumentano la confidenza
    if (value.includes('.')) confidence += 30;
    if (value.includes('_')) confidence += 20;
    if (/^[a-z]/.test(value)) confidence += 15; // Inizia con minuscola
    if (value.length >= 5 && value.length <= 50) confidence += 20; // Lunghezza ragionevole
    if (/[A-Z]/.test(value)) confidence += 10; // Contiene maiuscole (camelCase)
    if (!/\d/.test(value)) confidence += 5; // Non contiene numeri
    
    // Fattori che diminuiscono la confidenza
    if (value.length > 50) confidence -= 20;
    if (value.includes(' ')) confidence -= 30;
    if (value.includes('-') && !value.includes('.')) confidence -= 15;
    
    return Math.max(0, Math.min(100, confidence));
  }
  
  // Genera suggerimenti automatici per risolvere problemi di traduzione
  private generateTranslationSuggestions(missing: MissingTranslation): string[] {
    const suggestions: string[] = [];
    const { key, language, namespace } = missing;
    
    // Suggerimento 1: File e percorso specifico
    suggestions.push(`• Aggiungi la chiave nel file: src/i18n/locales/${language}/${namespace}.json`);
    
    // Suggerimento 2: Controlla se esiste in altre lingue
    suggestions.push(`• Verifica se la chiave "${key}" esiste in altre lingue per riferimento`);
    
    // Suggerimento 3: Suggerimenti basati sul namespace
    const namespaceHints = this.getNamespaceSpecificHints(namespace);
    if (namespaceHints) {
      suggestions.push(`• ${namespaceHints}`);
    }
    
    // Suggerimento 4: Suggerimenti basati sulla chiave
    const keyHints = this.getKeySpecificHints(key);
    if (keyHints) {
      suggestions.push(`• ${keyHints}`);
    }
    
    // Suggerimento 5: Controllo automatico
    suggestions.push(`• Usa il pannello debug per monitorare altre traduzioni mancanti`);
    
    return suggestions;
  }
  
  // Genera una soluzione completa da copiare
  private generateTranslationSolution(missing: MissingTranslation): string {
    const { key, language, namespace } = missing;
    
    // Genera un template JSON da aggiungere al file
    const jsonTemplate = `{
  "${key}": "[TRADUZIONE_DA_AGGIUNGERE_PER_${language.toUpperCase()}]"
}`;
    
    const solution = `// SOLUZIONE PER TRADUZIONE MANCANTE\n` +
      `// File: src/i18n/locales/${language}/${namespace}.json\n` +
      `// Chiave: ${key}\n` +
      `// Lingua: ${language}\n\n` +
      `// Aggiungi questa chiave al file JSON:\n` +
      jsonTemplate + `\n\n` +
      `// NOTA: Sostituisci [TRADUZIONE_DA_AGGIUNGERE_PER_${language.toUpperCase()}] con la traduzione corretta`;
    
    return solution;
  }
  
  // Fornisce suggerimenti specifici per namespace
  private getNamespaceSpecificHints(namespace: string): string | null {
    const hints: { [key: string]: string } = {
      'common': 'Questo namespace contiene traduzioni comuni usate in tutta l\'app',
      'navigation': 'Controlla che tutti i link di navigazione siano tradotti',
      'errors': 'Assicurati che tutti i messaggi di errore siano user-friendly',
      'chat': 'Verifica che l\'interfaccia chat sia completamente localizzata',
      'features': 'Controlla che le descrizioni delle funzionalità siano chiare',
      'hero': 'Assicurati che il testo principale sia coinvolgente nella lingua target',
      'footer': 'Verifica che tutti i link del footer siano tradotti'
    };
    
    return hints[namespace] || null;
  }
  
  // Fornisce suggerimenti specifici per chiavi
  private getKeySpecificHints(key: string): string | null {
    if (key.includes('title')) {
      return 'I titoli dovrebbero essere concisi e descrittivi';
    }
    if (key.includes('description')) {
      return 'Le descrizioni dovrebbero essere chiare e informative';
    }
    if (key.includes('button') || key.includes('action')) {
      return 'I testi dei pulsanti dovrebbero essere verbi d\'azione chiari';
    }
    if (key.includes('error') || key.includes('warning')) {
      return 'I messaggi di errore dovrebbero essere utili e non tecnici';
    }
    if (key.includes('placeholder')) {
      return 'I placeholder dovrebbero guidare l\'utente su cosa inserire';
    }
    
    return null;
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
    
    // Console error disattivato
    // console.group(`🚨 [i18n Debug] ERRORE VISIVO: ${errorType === 'key' ? 'CHIAVE NON TRADOTTA' : 'LINGUA SBAGLIATA'}`);
    // console.error(`❌ PROBLEMA: ${errorType === 'key' ? 'Viene mostrata la chiave invece della traduzione' : 'Testo in italiano mostrato per altra lingua'}`);
    // console.table({
    //   '📍 Pagina': window.location.pathname,
    //   '🔍 Valore mostrato': value.length > 50 ? value.substring(0, 50) + '...' : value,
    //   '🌍 Lingua corrente': i18n.language,
    //   '🎯 Lingua attesa': expectedLang || 'N/A',
    //   '⏰ Timestamp': new Date().toLocaleString('it-IT'),
    //   '🔧 Tipo errore': errorType === 'key' ? 'Chiave non tradotta' : 'Mismatch lingua'
    // });
    // if (errorType === 'key') {
    //   console.error(`💡 SOLUZIONE: Verifica che la chiave "${value}" sia tradotta per la lingua "${i18n.language}"`);
    // } else {
    //   console.error(`💡 SOLUZIONE: Aggiungi traduzione per la lingua "${expectedLang}" o verifica il rilevamento automatico`);
    // }
    // console.groupEnd();
    
    toast.warning("Errore di Visualizzazione", {
      description: message,
      duration: 6000
    });
  }

  private async performInitialCheck() {
    // console.group('🔍 [i18n Debug] CONTROLLO INIZIALE TRADUZIONI');
    // console.log('📊 Avvio analisi completezza traduzioni...');
    
    try {
      // Rileva file mancanti
      const missingFiles = await this.detectMissingTranslationFiles();
      this.debugReport.missingFiles = missingFiles;
      
      // Esegue analisi completa della struttura
      const analysisResult = await i18nAnalyzer.analyzeTranslationStructure();
      
      // Aggiorna il report con i dati dell'analisi
      this.debugReport.languageCompleteness = analysisResult.languageCompleteness;
      
      // Avvia il rilevamento automatico degli errori visivi
      this.startVisualErrorDetection();
      
      // Mostra alert per problemi critici
      if (missingFiles.length > 0) {
        this.showCriticalIssuesAlert(missingFiles.length, analysisResult.recommendations || []);
      }
      
      // console.groupEnd();
      
      setTimeout(() => {
        this.showInitialReport();
      }, 1000);
    } catch (error) {
      // console.error('❌ Errore durante il controllo iniziale i18n:', error);
      this.checkLanguageCompleteness(); // Fallback al metodo precedente
      // console.groupEnd();
      
      setTimeout(() => {
        this.showInitialReport();
      }, 2000);
    }
  }

  // Rileva automaticamente i file di traduzione mancanti
  private async detectMissingTranslationFiles(): Promise<{ language: string; filename: string }[]> {
    const missingFiles: { language: string; filename: string }[] = [];
    
    try {
      // console.group('🔍 RILEVAMENTO FILE MANCANTI');
      
      // Ottieni la lista di tutti i file dalla lingua di riferimento (italiano)
      const referenceFiles = await this.getTranslationFilesForLanguage('it');
      // console.log(`📁 File di riferimento (it): ${referenceFiles.length}`);
      
      // Controlla ogni lingua supportata
      for (const language of SUPPORTED_LANGUAGES) {
        if (language === 'it') continue; // Salta la lingua di riferimento
        
        // console.group(`🌍 Controllo lingua: ${language}`);
        const languageFiles = await this.getTranslationFilesForLanguage(language);
        // console.log(`📄 File trovati: ${languageFiles.length}`);
        
        // Trova i file mancanti
        const missing = referenceFiles.filter(file => !languageFiles.includes(file));
        
        if (missing.length > 0) {
          // console.error(`❌ File mancanti per ${language}:`, missing);
          missing.forEach(filename => {
            missingFiles.push({ language, filename });
          });
        } else {
          // console.log(`✅ Tutti i file presenti per ${language}`);
        }
        
        // console.groupEnd();
      }
      
      if (missingFiles.length > 0) {
        // console.error(`🚨 TOTALE FILE MANCANTI: ${missingFiles.length}`);
        // console.table(missingFiles);
      } else {
        // console.log('✅ Tutti i file di traduzione sono presenti!');
      }
      
      // console.groupEnd();
      
    } catch (error) {
      console.error('❌ Errore durante il rilevamento file mancanti:', error);
      console.groupEnd();
    }
    
    return missingFiles;
  }
  
  // Ottiene la lista dei file di traduzione per una lingua specifica
  private async getTranslationFilesForLanguage(language: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      // Simula la lettura della directory (in un ambiente reale useresti fs)
      // Per ora usiamo una lista hardcoded basata sulla struttura osservata
      const commonFiles = [
        'aboutPage.json', 'ai.json', 'appsPage.json', 'chat.json', 'common.json',
        'errors.json', 'evaluation.json', 'features.json', 'feedback.json',
        'footer.json', 'hero.json', 'homepage.json', 'language.json',
        'navigation.json', 'notFound.json', 'prompts.json', 'teacherGuide.json',
        'teacherGuidePage.json', 'reflection.json'
      ];
      
      // Simula il controllo dell'esistenza dei file
      // In un ambiente reale, qui faresti una chiamata API o useresti fs
      return commonFiles;
      
    } catch (error) {
      // console.error(`Errore lettura file per lingua ${language}:`, error);
      return [];
    }
  }
  
  private checkLanguageCompleteness() {
    // Metodo di fallback se l'analisi completa fallisce
    SUPPORTED_LANGUAGES.forEach(lang => {
      // Calcola completezza basata sui file mancanti
      const missingForLang = this.debugReport.missingFiles.filter(f => f.language === lang).length;
      const totalFiles = 20; // Numero approssimativo di file di traduzione
      const completeness = Math.max(0, Math.round(((totalFiles - missingForLang) / totalFiles) * 100));
      
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
        onClick: () => {} // console.table disattivato
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
    
    // Statistiche per priorità
    const criticalErrors = this.debugReport.errorsByPriority[ErrorPriority.CRITICAL];
    const highPriorityErrors = this.debugReport.errorsByPriority[ErrorPriority.HIGH];
    const mediumPriorityErrors = this.debugReport.errorsByPriority[ErrorPriority.MEDIUM];
    const lowPriorityErrors = this.debugReport.errorsByPriority[ErrorPriority.LOW];
    
    return `📊 STATO TRADUZIONI\n\n` +
      `❌ Traduzioni mancanti: ${missing}\n` +
      `⚠️ Errori visualizzazione: ${visual}\n` +
      `🚨 Errori critici rilevati: ${highSeverityErrors}\n` +
      `📁 File mancanti: ${missingFiles}\n` +
      `🌍 Lingua corrente: ${i18n.language} (${currentLangCompleteness}% completa)\n\n` +
      `🔥 PRIORITÀ ERRORI:\n` +
      `  🚨 Critici: ${criticalErrors}\n` +
      `  ⚠️ Alti: ${highPriorityErrors}\n` +
      `  📋 Medi: ${mediumPriorityErrors}\n` +
      `  📝 Bassi: ${lowPriorityErrors}\n\n` +
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
      languageCompleteness: {},
      errorsByPriority: {
        [ErrorPriority.CRITICAL]: 0,
        [ErrorPriority.HIGH]: 0,
        [ErrorPriority.MEDIUM]: 0,
        [ErrorPriority.LOW]: 0
      },
      errorsByCategory: {
        [ErrorCategory.MISSING_KEY]: 0,
        [ErrorCategory.MISSING_FILE]: 0,
        [ErrorCategory.UNTRANSLATED_CONTENT]: 0,
        [ErrorCategory.LANGUAGE_MISMATCH]: 0,
        [ErrorCategory.VISUAL_ERROR]: 0
      },
      totalKeys: 0,
      timestamp: new Date()
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
    
    // console.log('👁️ Rilevamento errori visivi attivato');
  }
  
  private handleVisualErrors(errors: VisualError[]) {
    const now = Date.now();
    
    // Throttling per evitare aggiornamenti troppo frequenti
    if (now - this.lastReportUpdate < this.reportUpdateCooldown) {
      return;
    }
    
    // Console error disattivato
    // if (errors.length > 0) {
    //   console.error(`🚨 [i18n Debug] ERRORI VISIVI RILEVATI (${errors.length})`, {
    //     errors: errors.map(e => ({
    //       key: e.key,
    //       displayedText: e.displayedText,
    //       expectedType: e.expectedType,
    //       severity: e.severity,
    //       location: e.location
    //     })),
    //     timestamp: new Date().toISOString(),
    //     currentLanguage: i18n.language
    //   });
    // }
    
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
        onClick: () => {} // console.table disattivato
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
        onClick: () => {} // console.table disattivato
      }
    });
  }

  // Hook per componenti React
  public useTranslationWithDebug(key: string, options?: TranslationOptions) {
    const translation = i18n.t(key, options);
    const translationStr = String(translation);
    
    // Controlla se viene mostrata la chiave invece della traduzione
    if (this.debugMode) {
      this.checkIfDisplayingKey(translationStr, key);
      this.checkLanguageMismatch(translationStr, i18n.language);
    }
    
    return translation;
  }
  
  // Metodo per calcolare la priorità degli errori
  private calculateErrorPriority(key: string, namespace?: string, language?: string): ErrorPriority {
    // Errori critici: chiavi di navigazione, errori, azioni principali
    if (namespace === 'navigation' || namespace === 'errors' || key.includes('error') || key.includes('critical')) {
      return ErrorPriority.CRITICAL;
    }
    
    // Errori ad alta priorità: hero, titoli principali, CTA
    if (namespace === 'hero' || key.includes('title') || key.includes('cta') || key.includes('button')) {
      return ErrorPriority.HIGH;
    }
    
    // Errori a media priorità: descrizioni, contenuti secondari
    if (key.includes('description') || namespace === 'features' || namespace === 'chat') {
      return ErrorPriority.MEDIUM;
    }
    
    // Errori a bassa priorità: footer, metadati, contenuti opzionali
    if (namespace === 'footer' || key.includes('meta') || key.includes('optional')) {
      return ErrorPriority.LOW;
    }
    
    // Default: media priorità
    return ErrorPriority.MEDIUM;
  }

  // Metodo per ottenere errori filtrati per priorità
  public getErrorsByPriority(priority: ErrorPriority): MissingTranslation[] {
    return this.debugReport.missingTranslations.filter(error => error.priority === priority);
  }

  // Metodo per ottenere errori filtrati per categoria
  public getErrorsByCategory(category: ErrorCategory): MissingTranslation[] {
    return this.debugReport.missingTranslations.filter(error => error.category === category);
  }
}

// Istanza singleton del debugger
export const i18nDebugger = new I18nDebugger();

// Hook personalizzato per React
export const useTranslationWithDebug = (key: string, options?: TranslationOptions) => {
  return i18nDebugger.useTranslationWithDebug(key, options);
};

// Esporta le enumerazioni
export { ErrorPriority, ErrorCategory };

// Funzioni di utilità
export const enableI18nDebugAlerts = () => i18nDebugger.enableAlerts();
export const disableI18nDebugAlerts = () => i18nDebugger.disableAlerts();
export const getI18nDebugReport = () => i18nDebugger.getDebugReport();
export const clearI18nDebugReport = () => i18nDebugger.clearReport();
export const getErrorsByPriority = (priority: ErrorPriority) => i18nDebugger.getErrorsByPriority(priority);
export const getErrorsByCategory = (category: ErrorCategory) => i18nDebugger.getErrorsByCategory(category);

export default i18nDebugger;
