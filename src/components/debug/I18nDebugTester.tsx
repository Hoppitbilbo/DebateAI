import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTranslationWithDebug } from '@/hooks/useTranslationWithDebug';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bug, Eye, Globe } from 'lucide-react';

/**
 * Componente per testare il sistema di debug i18n con esempi di errori comuni
 */
export const I18nDebugTester: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [testResults, setTestResults] = useState<string[]>([]);

  // Test cases che simulano errori comuni
  const testCases = [
    {
      id: 'missing-key',
      title: 'Chiave Mancante',
      description: 'Testa una chiave che non esiste',
      icon: <AlertTriangle className="w-4 h-4" />,
      test: () => {
        const result = t('questa.chiave.non.esiste');
        setTestResults(prev => [...prev, `❌ Chiave mancante: ${result}`]);
      }
    },
    {
      id: 'italian-fallback',
      title: 'Fallback Italiano',
      description: 'Testa il fallback quando manca traduzione italiana',
      icon: <Globe className="w-4 h-4" />,
      test: () => {
        // Simula una chiave che potrebbe non esistere in italiano
        const result = t('debug.test.italian.missing');
        setTestResults(prev => [...prev, `🇮🇹 Test italiano: ${result}`]);
      }
    },
    {
      id: 'key-display',
      title: 'Visualizzazione Chiave',
      description: 'Testa quando viene mostrata la chiave invece del testo',
      icon: <Eye className="w-4 h-4" />,
      test: () => {
        // Simula una situazione dove potrebbe essere mostrata la chiave
        const result = t('app.title.very.specific.missing');
        setTestResults(prev => [...prev, `🔑 Visualizzazione: ${result}`]);
      }
    },
    {
      id: 'namespace-error',
      title: 'Errore Namespace',
      description: 'Testa errori di namespace',
      icon: <Bug className="w-4 h-4" />,
      test: () => {
        const result = t('wrong:namespace.key');
        setTestResults(prev => [...prev, `📁 Namespace: ${result}`]);
      }
    }
  ];

  const runAllTests = () => {
    setTestResults([]);
    // Debug disattivato
    // console.group('🧪 I18N DEBUG TESTS');
    
    testCases.forEach(testCase => {
      // console.log(`Eseguendo test: ${testCase.title}`);
      testCase.test();
    });
    
    // Test aggiuntivi per problemi specifici
    testSpecificIssues();
    
    // console.groupEnd();
  };

  const testSpecificIssues = () => {
    // Test per problemi di visualizzazione
    const buttonText = t('common.buttons.submit');
    if (buttonText.includes('.') || buttonText === 'common.buttons.submit') {
      setTestResults(prev => [...prev, `⚠️ Bottone invisibile rilevato: ${buttonText}`]);
    }

    // Test per lingua italiana specifica
    if (i18n.language === 'it') {
      const italianTest = t('navigation.home');
      if (italianTest === 'navigation.home' || italianTest.includes('navigation.')) {
        setTestResults(prev => [...prev, `🇮🇹 Problema lingua italiana: ${italianTest}`]);
      }
    }

    // Test per completezza traduzioni
    const commonKeys = [
      'common.save',
      'common.cancel',
      'common.delete',
      'navigation.home',
      'navigation.settings'
    ];

    commonKeys.forEach(key => {
      const translation = t(key);
      if (translation === key || translation.includes('.')) {
        setTestResults(prev => [...prev, `🔍 Chiave problematica: ${key} → ${translation}`]);
      }
    });
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const getCurrentLanguageInfo = () => {
    return {
      current: i18n.language,
      available: i18n.languages,
      isItalian: i18n.language === 'it'
    };
  };

  const langInfo = getCurrentLanguageInfo();

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          I18N Debug Tester
        </CardTitle>
        <CardDescription>
          Strumento per testare e identificare problemi comuni nel sistema di internazionalizzazione
        </CardDescription>
        
        <div className="flex gap-2 mt-4">
          <Badge variant={langInfo.isItalian ? "default" : "secondary"}>
            Lingua: {langInfo.current}
          </Badge>
          <Badge variant="outline">
            Lingue disponibili: {langInfo.available.length}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Test Controls */}
        <div className="flex gap-2">
          <Button onClick={runAllTests} className="flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Esegui Tutti i Test
          </Button>
          <Button variant="outline" onClick={clearResults}>
            Pulisci Risultati
          </Button>
        </div>

        {/* Individual Test Cases */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testCases.map(testCase => (
            <Card key={testCase.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {testCase.icon}
                <h4 className="font-medium">{testCase.title}</h4>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {testCase.description}
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={testCase.test}
                className="w-full"
              >
                Esegui Test
              </Button>
            </Card>
          ))}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Risultati Test ({testResults.length})
            </h3>
            <div className="bg-muted p-4 rounded-lg max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono mb-1">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Language Switch for Testing */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-2">Test Rapido Lingue</h4>
          <div className="flex gap-2 flex-wrap">
            {['it', 'en', 'es', 'fr', 'de'].map(lang => (
              <Button
                key={lang}
                size="sm"
                variant={i18n.language === lang ? "default" : "outline"}
                onClick={() => {
                  i18n.changeLanguage(lang);
                  setTestResults(prev => [...prev, `🌍 Cambiata lingua a: ${lang}`]);
                }}
              >
                {lang.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default I18nDebugTester;