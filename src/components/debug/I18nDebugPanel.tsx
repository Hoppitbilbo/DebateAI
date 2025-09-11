import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  Bug, 
  Globe, 
  Key, 
  RefreshCw, 
  X, 
  Copy,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';
import { 
  getI18nDebugReport, 
  clearI18nDebugReport, 
  enableI18nDebugAlerts, 
  disableI18nDebugAlerts 
} from '@/utils/i18nDebugger';
import { useTranslation } from 'react-i18next';

interface I18nDebugPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const I18nDebugPanel: React.FC<I18nDebugPanelProps> = ({ isVisible, onClose }) => {
  const { i18n } = useTranslation();
  const [debugReport, setDebugReport] = useState(getI18nDebugReport());
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      setDebugReport(getI18nDebugReport());
    }, 2000);
    
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = () => {
    setDebugReport(getI18nDebugReport());
  };

  const handleClearReport = () => {
    clearI18nDebugReport();
    setDebugReport(getI18nDebugReport());
  };

  const toggleAlerts = () => {
    if (alertsEnabled) {
      disableI18nDebugAlerts();
    } else {
      enableI18nDebugAlerts();
    }
    setAlertsEnabled(!alertsEnabled);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const exportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      currentLanguage: i18n.language,
      report: debugReport
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `i18n-debug-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (count: number) => {
    if (count === 0) return 'bg-green-500';
    if (count <= 5) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getLanguageCompleteness = (lang: string) => {
    return debugReport.languageCompleteness[lang] || 0;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center space-x-2">
            <Bug className="h-6 w-6 text-blue-600" />
            <CardTitle className="text-xl">🔍 I18N Debug Panel</CardTitle>
            <Badge variant="outline" className="ml-2">
              Lingua: {i18n.language.toUpperCase()}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAlerts}
              className={alertsEnabled ? 'bg-green-50' : 'bg-red-50'}
            >
              {alertsEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {alertsEnabled ? 'Alert ON' : 'Alert OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportReport}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden">
          {/* Statistiche Rapide */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getSeverityColor(debugReport.missingTranslations.length)}`} />
                <span className="text-sm font-medium">Traduzioni Mancanti</span>
              </div>
              <div className="text-2xl font-bold mt-1">{debugReport.missingTranslations.length}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getSeverityColor(debugReport.visualErrors.length)}`} />
                <span className="text-sm font-medium">Errori Visualizzazione</span>
              </div>
              <div className="text-2xl font-bold mt-1">{debugReport.visualErrors.length}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${getSeverityColor(debugReport.missingFiles.length)}`} />
                <span className="text-sm font-medium">File Mancanti</span>
              </div>
              <div className="text-2xl font-bold mt-1">{debugReport.missingFiles.length}</div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center space-x-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Completezza Media</span>
              </div>
              <div className="text-2xl font-bold mt-1">
                {Math.round(Object.values(debugReport.languageCompleteness).reduce((a, b) => a + b, 0) / 5)}%
              </div>
            </Card>
          </div>

          <Tabs defaultValue="missing" className="flex-1">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="missing" className="flex items-center space-x-2">
                <Key className="h-4 w-4" />
                <span>Traduzioni Mancanti</span>
                {debugReport.missingTranslations.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {debugReport.missingTranslations.length}
                  </Badge>
                )}
              </TabsTrigger>
              
              <TabsTrigger value="visual" className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Errori Visivi</span>
                {debugReport.visualErrors.length > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {debugReport.visualErrors.length}
                  </Badge>
                )}
              </TabsTrigger>
              
              <TabsTrigger value="languages" className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Completezza Lingue</span>
              </TabsTrigger>
              
              <TabsTrigger value="actions" className="flex items-center space-x-2">
                <RefreshCw className="h-4 w-4" />
                <span>Azioni</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="missing" className="mt-4 h-[400px]">
              <ScrollArea className="h-full">
                {debugReport.missingTranslations.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      ✅ Nessuna traduzione mancante rilevata!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {debugReport.missingTranslations.map((missing, index) => (
                      <Card key={index} className="p-4 border-l-4 border-l-red-500">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Badge variant="destructive">{missing.language}</Badge>
                              <Badge variant="outline">{missing.namespace}</Badge>
                            </div>
                            <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                              {missing.key}
                            </div>
                            <div className="text-sm text-gray-600">
                              📍 Pagina: {missing.context}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(missing.key)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="visual" className="mt-4 h-[400px]">
              <ScrollArea className="h-full">
                {debugReport.visualErrors.length === 0 ? (
                  <Alert>
                    <AlertDescription>
                      ✅ Nessun errore di visualizzazione rilevato!
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {debugReport.visualErrors.map((error, index) => (
                      <Card key={index} className="p-4 border-l-4 border-l-yellow-500">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="secondary">
                              {error.expectedType === 'translation' ? 'Chiave Mostrata' : 'Lingua Errata'}
                            </Badge>
                          </div>
                          <div className="font-mono text-sm bg-gray-100 p-2 rounded">
                            {error.displayedValue}
                          </div>
                          <div className="text-sm text-gray-600">
                            🔑 Chiave: {error.key}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="languages" className="mt-4 h-[400px]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {['it', 'en', 'es', 'fr', 'de'].map(lang => {
                  const completeness = getLanguageCompleteness(lang);
                  return (
                    <Card key={lang} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant={lang === i18n.language ? 'default' : 'outline'}>
                            {lang.toUpperCase()}
                          </Badge>
                          {lang === i18n.language && <span className="text-sm text-blue-600">Corrente</span>}
                        </div>
                        <span className="font-bold">{completeness}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            completeness >= 90 ? 'bg-green-500' :
                            completeness >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${completeness}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="mt-4 h-[400px]">
              <div className="space-y-4">
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">🔧 Azioni di Debug</h3>
                  <div className="space-y-2">
                    <Button onClick={handleClearReport} variant="outline" className="w-full">
                      🗑️ Pulisci Report
                    </Button>
                    <Button onClick={exportReport} variant="outline" className="w-full">
                      📥 Esporta Report JSON
                    </Button>
                    <Button 
                      onClick={() => setAutoRefresh(!autoRefresh)} 
                      variant="outline" 
                      className="w-full"
                    >
                      {autoRefresh ? '⏸️ Ferma Auto-Refresh' : '▶️ Avvia Auto-Refresh'}
                    </Button>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <h3 className="font-semibold mb-2">💡 Suggerimenti per il Debug</h3>
                  <div className="text-sm space-y-2 text-gray-600">
                    <p>• Le traduzioni mancanti vengono rilevate automaticamente</p>
                    <p>• Gli errori di visualizzazione mostrano chiavi invece di testo</p>
                    <p>• Controlla la completezza delle lingue per identificare gap</p>
                    <p>• Usa il pulsante copia per copiare le chiavi mancanti</p>
                  </div>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default I18nDebugPanel;