import { toast } from '@/components/ui/sonner';
import i18n from '@/i18n';

/**
 * Sistema di rilevamento automatico per errori di visualizzazione i18n
 * Rileva quando vengono mostrate chiavi invece di testo tradotto
 */

interface VisualError {
  element: Element;
  key: string;
  displayedText: string;
  expectedType: 'translation' | 'key';
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  location: string;
}

interface DetectionConfig {
  enabled: boolean;
  autoScan: boolean;
  scanInterval: number;
  alertThreshold: number;
  excludeSelectors: string[];
  includeSelectors: string[];
}

class VisualErrorDetector {
  private errors: VisualError[] = [];
  private observer: MutationObserver | null = null;
  private scanTimer: NodeJS.Timeout | null = null;
  private isScanning = false;
  private lastToastTime = 0;
  private toastCooldown = 5000; // 5 secondi tra toast
  
  private config: DetectionConfig = {
    enabled: process.env.NODE_ENV === 'development',
    autoScan: true,
    scanInterval: 10000, // 10 secondi (ridotto la frequenza)
    alertThreshold: 5, // Alert dopo 5 errori (aumentato soglia)
    excludeSelectors: [
      'script',
      'style',
      'meta',
      'title',
      '[data-i18n-ignore]',
      '.i18n-debug-panel',
      '.i18n-debug-floating',
      '.sonner-toaster', // Escludi i toast
      '[data-sonner-toast]' // Escludi i toast
    ],
    includeSelectors: [
      'button',
      'a',
      'span',
      'div',
      'p',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'label',
      'input[placeholder]',
      '[title]'
    ]
  };

  constructor() {
    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize() {
    // Avvia il monitoraggio automatico
    if (this.config.autoScan) {
      this.startAutoScan();
    }

    // Monitora i cambiamenti del DOM
    this.setupDOMObserver();

    // Monitora i cambiamenti di lingua
    i18n.on('languageChanged', () => {
      this.clearErrors();
      setTimeout(() => this.scanPage(), 1000);
    });

    console.log('🔍 Visual Error Detector inizializzato');
  }

  private setupDOMObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Controlla se sono stati aggiunti elementi con testo
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldScan = true;
            }
          });
        }
        
        if (mutation.type === 'characterData') {
          shouldScan = true;
        }
      });

      if (shouldScan && !this.isScanning) {
        // Debounce per evitare scan troppo frequenti
        setTimeout(() => this.scanPage(), 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  private startAutoScan() {
    this.scanTimer = setInterval(() => {
      if (!this.isScanning) {
        this.scanPage();
      }
    }, this.config.scanInterval);
  }

  public scanPage(): VisualError[] {
    if (this.isScanning) return this.errors;
    
    this.isScanning = true;
    const newErrors: VisualError[] = [];

    try {
      // Scansiona tutti gli elementi visibili
      const elements = this.getScannableElements();
      
      elements.forEach(element => {
        const errors = this.analyzeElement(element);
        newErrors.push(...errors);
      });

      // Aggiorna la lista degli errori con limite massimo
      this.errors = [...this.errors, ...newErrors];
      
      // Mantieni solo gli ultimi 50 errori per evitare accumulo eccessivo
      if (this.errors.length > 50) {
        this.errors = this.errors.slice(-50);
      }
      
      // Rimuovi errori duplicati
      this.deduplicateErrors();
      
      // Controlla se mostrare alert
      if (newErrors.length > 0) {
        this.handleNewErrors(newErrors);
      }

      console.log(`🔍 Scan completato: ${newErrors.length} nuovi errori, ${this.errors.length} totali`);
      
    } catch (error) {
      console.error('Errore durante la scansione:', error);
    } finally {
      this.isScanning = false;
    }

    return newErrors;
  }

  private getScannableElements(): Element[] {
    const elements: Element[] = [];
    
    // Usa i selettori configurati
    this.config.includeSelectors.forEach(selector => {
      const found = document.querySelectorAll(selector);
      elements.push(...Array.from(found));
    });

    // Filtra gli elementi esclusi
    return elements.filter(element => {
      // Controlla se l'elemento è visibile
      if (!this.isElementVisible(element)) return false;
      
      // Controlla se l'elemento è escluso
      return !this.config.excludeSelectors.some(excludeSelector => {
        return element.matches(excludeSelector) || element.closest(excludeSelector);
      });
    });
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  private analyzeElement(element: Element): VisualError[] {
    const errors: VisualError[] = [];
    const texts = this.extractTextsFromElement(element);
    
    texts.forEach(({ text, source }) => {
      const error = this.analyzeText(text, element, source);
      if (error) {
        errors.push(error);
      }
    });

    return errors;
  }

  private extractTextsFromElement(element: Element): Array<{ text: string; source: string }> {
    const texts: Array<{ text: string; source: string }> = [];
    
    // Testo del contenuto
    const textContent = element.textContent?.trim();
    if (textContent && textContent.length > 0) {
      texts.push({ text: textContent, source: 'textContent' });
    }
    
    // Attributi comuni che potrebbero contenere testo
    const attributes = ['placeholder', 'title', 'alt', 'aria-label'];
    attributes.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && value.trim().length > 0) {
        texts.push({ text: value.trim(), source: attr });
      }
    });

    return texts;
  }

  private analyzeText(text: string, element: Element, source: string): VisualError | null {
    // Ignora nomi propri che non necessitano traduzione
    const properNouns = ['AiDebate.tech', 'github', 'GitHub', 'Github'];
    if (properNouns.some(noun => text.toLowerCase().includes(noun.toLowerCase()))) {
      return null;
    }

    // Pattern per rilevare chiavi i18n
    const keyPatterns = [
      /^[a-zA-Z]+\.[a-zA-Z.]+$/, // pattern.like.this
      /^[a-zA-Z]+:[a-zA-Z.]+$/, // namespace:key.pattern
      /^\{\{[^}]+\}\}$/, // {{interpolation}}
      /^\$t\([^)]+\)$/ // $t(key)
    ];

    // Controlla se il testo sembra una chiave
    const looksLikeKey = keyPatterns.some(pattern => pattern.test(text));
    
    // Controlla se contiene punti sospetti (possibili chiavi)
    const hasSuspiciousDots = text.includes('.') && 
      text.split('.').length > 2 && 
      !text.includes(' ') &&
      text.length > 10;

    // Controlla se è in lingua italiana ma sembra inglese/chiave
    const isItalianContext = i18n.language === 'it';
    const looksLikeEnglishInItalian = isItalianContext && 
      /^[a-zA-Z.]+$/.test(text) && 
      !this.isLikelyItalianWord(text);

    if (looksLikeKey || hasSuspiciousDots || looksLikeEnglishInItalian) {
      return {
        element,
        key: text,
        displayedText: text,
        expectedType: 'translation',
        severity: this.calculateSeverity(text, element),
        timestamp: Date.now(),
        location: this.getElementLocation(element)
      };
    }

    return null;
  }

  private isLikelyItalianWord(text: string): boolean {
    // Parole italiane comuni che potrebbero apparire
    const italianWords = [
      'home', 'casa', 'menu', 'impostazioni', 'profilo', 'utente',
      'salva', 'annulla', 'elimina', 'modifica', 'aggiungi', 'rimuovi',
      'cerca', 'filtro', 'ordina', 'visualizza', 'nascondi'
    ];
    
    return italianWords.some(word => 
      text.toLowerCase().includes(word.toLowerCase())
    );
  }

  private calculateSeverity(text: string, element: Element): 'low' | 'medium' | 'high' {
    // Alta severità per bottoni e link
    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      return 'high';
    }
    
    // Media severità per testi lunghi che sembrano chiavi
    if (text.length > 20 && text.includes('.')) {
      return 'medium';
    }
    
    return 'low';
  }

  private getElementLocation(element: Element): string {
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const className = element.className ? `.${element.className.split(' ').join('.')}` : '';
    
    return `${tagName}${id}${className}`.substring(0, 100);
  }

  private deduplicateErrors() {
    const seen = new Set<string>();
    this.errors = this.errors.filter(error => {
      const key = `${error.key}-${error.location}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private handleNewErrors(newErrors: VisualError[]) {
    const now = Date.now();
    
    // Console error dettagliato per nuovi errori rilevati
    if (newErrors.length > 0) {
      console.group(`🚨 [Visual Error Detector] NUOVI ERRORI RILEVATI (${newErrors.length})`);
      console.error(`❌ PROBLEMA: Rilevati elementi con errori di visualizzazione`);
      console.table({
        '📊 Nuovi errori': newErrors.length,
        '📈 Totale errori': this.errors.length,
        '🌍 Lingua corrente': i18n.language,
        '📍 Pagina': window.location.pathname,
        '⏰ Timestamp': new Date().toLocaleString('it-IT')
      });
      
      console.group('📋 DETTAGLI ERRORI:');
      newErrors.forEach((error, index) => {
        console.group(`${index + 1}. ${error.severity.toUpperCase()} - ${error.expectedType === 'key' ? 'CHIAVE NON TRADOTTA' : 'TESTO SBAGLIATO'}`);
        console.table({
          '🔑 Chiave/Testo': error.key,
          '📺 Mostrato': error.displayedText.length > 50 ? error.displayedText.substring(0, 50) + '...' : error.displayedText,
          '📍 Posizione': error.location,
          '🏷️ Elemento': error.element.tagName,
          '⚠️ Severità': error.severity,
          '🎯 Tipo atteso': error.expectedType === 'key' ? 'Traduzione' : 'Chiave'
        });
        console.error(`💡 SOLUZIONE: ${error.expectedType === 'key' ? 
          `Aggiungi traduzione per la chiave "${error.key}" nella lingua "${i18n.language}"` : 
          `Verifica che il testo "${error.displayedText.substring(0, 30)}..." sia correttamente tradotto`}`);
        console.groupEnd();
      });
      console.groupEnd();
      console.groupEnd();
    }
    
    // Throttling per evitare spam di toast
    if (now - this.lastToastTime < this.toastCooldown) {
      return;
    }
    
    const highSeverityErrors = newErrors.filter(e => e.severity === 'high');
    const totalErrors = this.errors.length;

    // Alert immediato per errori ad alta severità
    if (highSeverityErrors.length > 0) {
      this.showHighSeverityAlert(highSeverityErrors);
      this.lastToastTime = now;
    }
    
    // Alert per soglia raggiunta
    else if (totalErrors >= this.config.alertThreshold) {
      this.showThresholdAlert(totalErrors);
      this.lastToastTime = now;
    }
  }

  private showHighSeverityAlert(errors: VisualError[]) {
    const errorList = errors.slice(0, 3).map(e => 
      `• ${e.location}: "${e.key.substring(0, 30)}..."`
    ).join('\n');

    toast.error("Errori Critici di Visualizzazione", {
      description: `🚨 Rilevati ${errors.length} errori critici:\n\n${errorList}\n\n💡 Controlla che le traduzioni siano caricate correttamente`,
      duration: 8000,
      action: {
        label: "Dettagli",
        onClick: () => console.table(errors)
      }
    });
  }

  private showThresholdAlert(totalErrors: number) {
    toast.warning("Molti Errori di Traduzione", {
      description: `⚠️ Rilevati ${totalErrors} errori di visualizzazione\n\n🔍 Possibili cause:\n• File di traduzione mancanti\n• Chiavi non tradotte\n• Problemi di caricamento i18n`,
      duration: 6000
    });
  }

  // Metodi pubblici per il controllo
  public getErrors(): VisualError[] {
    return [...this.errors];
  }

  public clearErrors() {
    this.errors = [];
  }

  public getErrorsByElement(element: Element): VisualError[] {
    return this.errors.filter(error => error.element === element);
  }

  public getErrorsBySeverity(severity: 'low' | 'medium' | 'high'): VisualError[] {
    return this.errors.filter(error => error.severity === severity);
  }

  public updateConfig(newConfig: Partial<DetectionConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    if (!this.config.enabled && this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    } else if (this.config.enabled && !this.scanTimer && this.config.autoScan) {
      this.startAutoScan();
    }
  }

  public destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    
    this.clearErrors();
  }
}

// Istanza singleton
export const visualErrorDetector = new VisualErrorDetector();
export default visualErrorDetector;
export type { VisualError, DetectionConfig };