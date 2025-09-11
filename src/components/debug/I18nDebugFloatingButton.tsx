import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Bug, 
  AlertTriangle, 
  Globe, 
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { getI18nDebugReport } from '@/utils/i18nDebugger';
import { useTranslation } from 'react-i18next';
import I18nDebugPanel from './I18nDebugPanel';

interface I18nDebugFloatingButtonProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

const I18nDebugFloatingButton: React.FC<I18nDebugFloatingButtonProps> = ({ 
  position = 'bottom-right' 
}) => {
  const { i18n } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [debugReport, setDebugReport] = useState(getI18nDebugReport());
  const [isVisible, setIsVisible] = useState(false);

  // Mostra il pulsante solo in development mode
  useEffect(() => {
    setIsVisible(import.meta.env.DEV);
  }, []);

  // Aggiorna il report ogni 3 secondi solo se visibile
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      const newReport = getI18nDebugReport();
      setDebugReport(prevReport => {
        // Evita aggiornamenti inutili se il report non è cambiato
        if (JSON.stringify(prevReport) === JSON.stringify(newReport)) {
          return prevReport;
        }
        return newReport;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const hasErrors = debugReport.missingTranslations.length > 0 || 
                   debugReport.visualErrors.length > 0;
  
  const totalIssues = debugReport.missingTranslations.length + 
                     debugReport.visualErrors.length;

  const getSeverityColor = () => {
    if (totalIssues === 0) return 'bg-green-500 hover:bg-green-600';
    if (totalIssues <= 5) return 'bg-yellow-500 hover:bg-yellow-600';
    return 'bg-red-500 hover:bg-red-600';
  };

  const getStatusIcon = () => {
    if (totalIssues === 0) return '✅';
    if (totalIssues <= 5) return '⚠️';
    return '🚨';
  };

  return (
    <>
      <div className={`fixed ${positionClasses[position]} z-40 flex flex-col items-end space-y-2`}>
        {/* Pannello espanso con dettagli */}
        {isExpanded && (
          <Card className="w-80 shadow-lg border-2 animate-in slide-in-from-bottom-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Bug className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">I18N Debug Status</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-3">
                {/* Lingua corrente */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Lingua Corrente:</span>
                  <Badge variant="outline">{i18n.language.toUpperCase()}</Badge>
                </div>
                
                {/* Statistiche errori */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 bg-red-50 rounded">
                    <div className="text-lg font-bold text-red-600">
                      {debugReport.missingTranslations.length}
                    </div>
                    <div className="text-xs text-red-600">Traduzioni Mancanti</div>
                  </div>
                  
                  <div className="text-center p-2 bg-yellow-50 rounded">
                    <div className="text-lg font-bold text-yellow-600">
                      {debugReport.visualErrors.length}
                    </div>
                    <div className="text-xs text-yellow-600">Errori Visivi</div>
                  </div>
                </div>
                
                {/* Completezza lingua corrente */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Completezza:</span>
                    <span className="font-semibold">
                      {debugReport.languageCompleteness[i18n.language] || 0}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        (debugReport.languageCompleteness[i18n.language] || 0) >= 90 ? 'bg-green-500' :
                        (debugReport.languageCompleteness[i18n.language] || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${debugReport.languageCompleteness[i18n.language] || 0}%` }}
                    />
                  </div>
                </div>
                
                {/* Ultimi errori */}
                {debugReport.missingTranslations.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-gray-700">Ultimi Errori:</div>
                    <div className="max-h-20 overflow-y-auto space-y-1">
                      {debugReport.missingTranslations.slice(-3).map((missing, index) => (
                        <div key={index} className="text-xs bg-gray-100 p-1 rounded font-mono">
                          {missing.key}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Pulsante per aprire il pannello completo */}
                <Button 
                  onClick={() => setShowPanel(true)}
                  className="w-full"
                  variant="outline"
                >
                  🔍 Apri Pannello Completo
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Pulsante principale */}
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`${getSeverityColor()} text-white shadow-lg transition-all duration-200 hover:scale-105 relative`}
          size="lg"
        >
          <div className="flex items-center space-x-2">
            <Bug className="h-5 w-5" />
            <span className="font-semibold">{getStatusIcon()}</span>
            {totalIssues > 0 && (
              <Badge variant="secondary" className="bg-white text-black">
                {totalIssues}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </div>
          
          {/* Indicatore pulsante per errori critici */}
          {totalIssues > 10 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-600 rounded-full animate-pulse" />
          )}
        </Button>
      </div>
      
      {/* Pannello di debug completo */}
      <I18nDebugPanel 
        isVisible={showPanel} 
        onClose={() => setShowPanel(false)} 
      />
    </>
  );
};

export default I18nDebugFloatingButton;