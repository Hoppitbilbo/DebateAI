import { toast } from '@/components/ui/sonner';

// Tipi per l'analisi
interface TranslationFile {
  language: string;
  filename: string;
  exists: boolean;
  keys?: string[];
}

interface AnalysisResult {
  missingFiles: { language: string; filename: string }[];
  missingKeys: { language: string; filename: string; missingKeys: string[] }[];
  extraKeys: { language: string; filename: string; extraKeys: string[] }[];
  languageCompleteness: { [language: string]: number };
  recommendations: string[];
}

class I18nAnalyzer {
  private readonly SUPPORTED_LANGUAGES = ['it', 'en', 'es', 'fr', 'de'];
  private readonly REFERENCE_LANGUAGE = 'it'; // Lingua di riferimento
  
  // Lista dei file di traduzione attesi (basata sulla struttura osservata)
  private readonly EXPECTED_FILES = [
    'aboutPage.json',
    'ai.json',
    'appsPage.json',
    'chat.json',
    'common.json',
    'errors.json',
    'evaluation.json',
    'features.json',
    'feedback.json',
    'footer.json',
    'hero.json',
    'homepage.json',
    'language.json',
    'navigation.json',
    'notFound.json',
    'prompts.json',
    'reflection.json',
    'teacherGuide.json',
    'teacherGuidePage.json',
    'apps/convinciTu.json',
    'apps/doppiaIntervista.json',
    'apps/impersonaTu.json',
    'apps/personaggioMisterioso.json',
    'apps/wikiChat.json',
    'apps/wikiChatbot.json',
    'apps/wikiInterview.json',
    'apps/youModerate.json'
  ];

  /**
   * Analizza la struttura dei file di traduzione
   */
  public async analyzeTranslationStructure(): Promise<AnalysisResult> {
    console.log('🔍 Avvio analisi struttura i18n...');
    
    const result: AnalysisResult = {
      missingFiles: [],
      missingKeys: [],
      extraKeys: [],
      languageCompleteness: {},
      recommendations: []
    };

    // Analizza i file mancanti per ogni lingua
    await this.analyzeMissingFiles(result);
    
    // Calcola la completezza per ogni lingua
    this.calculateLanguageCompleteness(result);
    
    // Genera raccomandazioni
    this.generateRecommendations(result);
    
    return result;
  }

  /**
   * Analizza i file mancanti confrontando con la lingua di riferimento
   */
  private async analyzeMissingFiles(result: AnalysisResult): Promise<void> {
    // Simula il controllo dei file (in un'app reale si userebbe fetch o API)
    const fileStructure = this.getKnownFileStructure();
    
    for (const language of this.SUPPORTED_LANGUAGES) {
      if (language === this.REFERENCE_LANGUAGE) continue;
      
      const referenceFiles = fileStructure[this.REFERENCE_LANGUAGE] || [];
      const languageFiles = fileStructure[language] || [];
      
      // Trova file mancanti
      for (const file of referenceFiles) {
        if (!languageFiles.includes(file)) {
          result.missingFiles.push({
            language,
            filename: file
          });
        }
      }
    }
  }

  /**
   * Restituisce la struttura dei file conosciuta (basata sull'analisi precedente)
   */
  private getKnownFileStructure(): { [language: string]: string[] } {
    return {
      'it': [
        'aboutPage.json', 'apps/convinciTu.json', 'apps/doppiaIntervista.json',
        'apps/impersonaTu.json', 'apps/personaggioMisterioso.json', 'apps/wikiChat.json',
        'apps/wikiChatbot.json', 'apps/youModerate.json', 'appsPage.json',
        'chat.json', 'common.json', 'errors.json', 'features.json',
        'feedback.json', 'footer.json', 'hero.json', 'homepage.json',
        'language.json', 'navigation.json', 'teacherGuide.json'
      ],
      'en': [
        'aboutPage.json', 'ai.json', 'apps/convinciTu.json', 'apps/doppiaIntervista.json',
        'apps/impersonaTu.json', 'apps/personaggioMisterioso.json', 'apps/wikiChat.json',
        'apps/wikiChatbot.json', 'apps/youModerate.json', 'appsPage.json',
        'chat.json', 'common.json', 'errors.json', 'evaluation.json',
        'features.json', 'feedback.json', 'footer.json', 'hero.json',
        'homepage.json', 'language.json', 'navigation.json', 'notFound.json',
        'prompts.json', 'teacherGuide.json', 'teacherGuidePage.json'
      ],
      'es': [
        'aboutPage.json', 'apps/convinciTu.json', 'apps/doppiaIntervista.json',
        'apps/impersonaTu.json', 'apps/personaggioMisterioso.json', 'apps/wikiChat.json',
        'apps/wikiChatbot.json', 'apps/youModerate.json', 'appsPage.json',
        'chat.json', 'common.json', 'errors.json', 'features.json',
        'feedback.json', 'footer.json', 'hero.json', 'language.json',
        'navigation.json', 'teacherGuide.json'
      ],
      'fr': [
        'aboutPage.json', 'ai.json', 'apps/convinciTu.json', 'apps/doppiaIntervista.json',
        'apps/impersonaTu.json', 'apps/personaggioMisterioso.json', 'apps/wikiChat.json',
        'apps/wikiChatbot.json', 'apps/youModerate.json', 'appsPage.json',
        'chat.json', 'common.json', 'errors.json', 'evaluation.json',
        'features.json', 'feedback.json', 'footer.json', 'hero.json',
        'homepage.json', 'language.json', 'navigation.json', 'notFound.json',
        'prompts.json', 'reflection.json', 'teacherGuide.json', 'teacherGuidePage.json'
      ],
      'de': [
        'aboutPage.json', 'ai.json', 'apps/convinciTu.json', 'apps/doppiaIntervista.json',
        'apps/impersonaTu.json', 'apps/personaggioMisterioso.json', 'apps/wikiChat.json',
        'apps/wikiChatbot.json', 'apps/wikiInterview.json', 'appsPage.json',
        'chat.json', 'common.json', 'errors.json', 'evaluation.json',
        'features.json', 'feedback.json', 'footer.json', 'hero.json',
        'homepage.json', 'language.json', 'navigation.json', 'notFound.json',
        'prompts.json', 'teacherGuide.json', 'teacherGuidePage.json'
      ]
    };
  }

  /**
   * Calcola la percentuale di completezza per ogni lingua
   */
  private calculateLanguageCompleteness(result: AnalysisResult): void {
    const fileStructure = this.getKnownFileStructure();
    const referenceFileCount = fileStructure[this.REFERENCE_LANGUAGE]?.length || 0;
    
    for (const language of this.SUPPORTED_LANGUAGES) {
      const languageFileCount = fileStructure[language]?.length || 0;
      const missingFileCount = result.missingFiles.filter(mf => mf.language === language).length;
      const actualFileCount = languageFileCount - missingFileCount;
      
      const completeness = referenceFileCount > 0 
        ? Math.round((actualFileCount / referenceFileCount) * 100)
        : 0;
      
      result.languageCompleteness[language] = completeness;
    }
  }

  /**
   * Genera raccomandazioni basate sull'analisi
   */
  private generateRecommendations(result: AnalysisResult): void {
    const recommendations: string[] = [];
    
    // Raccomandazioni per file mancanti
    if (result.missingFiles.length > 0) {
      const languagesWithMissingFiles = [...new Set(result.missingFiles.map(mf => mf.language))];
      recommendations.push(
        `🚨 PRIORITÀ ALTA: ${result.missingFiles.length} file mancanti in ${languagesWithMissingFiles.length} lingue`
      );
      
      for (const lang of languagesWithMissingFiles) {
        const missingInLang = result.missingFiles.filter(mf => mf.language === lang);
        recommendations.push(
          `📁 ${lang.toUpperCase()}: Mancano ${missingInLang.length} file (${missingInLang.map(mf => mf.filename).join(', ')})`
        );
      }
    }
    
    // Raccomandazioni per completezza
    const incompleteLanguages = Object.entries(result.languageCompleteness)
      .filter(([_, completeness]) => completeness < 90)
      .sort(([_, a], [__, b]) => a - b);
    
    if (incompleteLanguages.length > 0) {
      recommendations.push(
        `⚠️ ATTENZIONE: ${incompleteLanguages.length} lingue con completezza < 90%`
      );
      
      for (const [lang, completeness] of incompleteLanguages) {
        recommendations.push(
          `🌍 ${lang.toUpperCase()}: ${completeness}% completo - Richiede attenzione`
        );
      }
    }
    
    // Raccomandazioni specifiche per file critici
    const criticalFiles = ['common.json', 'errors.json', 'navigation.json'];
    const criticalMissing = result.missingFiles.filter(mf => 
      criticalFiles.some(cf => mf.filename.includes(cf))
    );
    
    if (criticalMissing.length > 0) {
      recommendations.push(
        `🔥 CRITICO: File essenziali mancanti - ${criticalMissing.map(cm => `${cm.language}:${cm.filename}`).join(', ')}`
      );
    }
    
    // Raccomandazioni generali
    if (result.missingFiles.length === 0 && incompleteLanguages.length === 0) {
      recommendations.push('✅ OTTIMO: Tutte le lingue sono complete!');
    } else {
      recommendations.push(
        '💡 SUGGERIMENTO: Usa il comando di sincronizzazione per copiare i file mancanti dalla lingua di riferimento'
      );
    }
    
    result.recommendations = recommendations;
  }

  /**
   * Mostra un report dettagliato dell'analisi
   */
  public showAnalysisReport(result: AnalysisResult): void {
    console.group('📊 I18N Analysis Report');
    console.log('Missing Files:', result.missingFiles);
    console.log('Language Completeness:', result.languageCompleteness);
    console.log('Recommendations:', result.recommendations);
    console.groupEnd();
    
    // Mostra toast con sommario
    const summary = this.generateSummaryMessage(result);
    
    toast.info('Analisi I18N Completata', {
      description: summary,
      duration: 8000,
      action: {
        label: 'Dettagli Console',
        onClick: () => console.table(result)
      }
    });
  }

  /**
   * Genera un messaggio di sommario per il toast
   */
  private generateSummaryMessage(result: AnalysisResult): string {
    const totalMissing = result.missingFiles.length;
    const avgCompleteness = Math.round(
      Object.values(result.languageCompleteness).reduce((a, b) => a + b, 0) / 
      this.SUPPORTED_LANGUAGES.length
    );
    
    return `📈 Completezza Media: ${avgCompleteness}%\n` +
           `❌ File Mancanti: ${totalMissing}\n` +
           `🎯 Stato: ${totalMissing === 0 ? 'Completo' : 'Richiede Attenzione'}`;
  }

  /**
   * Esegue un'analisi rapida e mostra i risultati
   */
  public async runQuickAnalysis(): Promise<void> {
    try {
      const result = await this.analyzeTranslationStructure();
      this.showAnalysisReport(result);
    } catch (error) {
      console.error('Errore durante l\'analisi i18n:', error);
      toast.error('Errore Analisi', {
        description: 'Impossibile completare l\'analisi delle traduzioni'
      });
    }
  }
}

// Istanza singleton
export const i18nAnalyzer = new I18nAnalyzer();

// Funzioni di utilità esportate
export const runI18nAnalysis = () => i18nAnalyzer.runQuickAnalysis();
export const analyzeTranslations = () => i18nAnalyzer.analyzeTranslationStructure();

export default i18nAnalyzer;