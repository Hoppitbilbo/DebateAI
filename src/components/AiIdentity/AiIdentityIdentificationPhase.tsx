import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, User, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface AiIdentityIdentificationPhaseProps {
  character1Name: string;
  character2Name: string;
  character1Description: string;
  character2Description: string;
  onIdentificationComplete: (guess1: string, guess2: string) => void;
  onBackToReflection: () => void;
}

const AiIdentityIdentificationPhase: React.FC<AiIdentityIdentificationPhaseProps> = ({
  character1Name,
  character2Name,
  character1Description,
  character2Description,
  onIdentificationComplete,
  onBackToReflection,
}) => {
  const { t } = useTranslation();
  const [personaggioAGuess, setPersonaggioAGuess] = useState("");
  const [personaggioBGuess, setPersonaggioBGuess] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({ correct1: false, correct2: false });

  const characterOptions = [
    { name: character1Name, description: character1Description },
    { name: character2Name, description: character2Description },
  ];

  const handleSubmitIdentification = () => {
    if (!personaggioAGuess || !personaggioBGuess) {
      toast.error(t('apps.aiIdentity.identification.selectBothCharacters', { defaultValue: 'Per favore seleziona entrambi i personaggi' }));
      return;
    }

    const correct1 = personaggioAGuess === character1Name;
    const correct2 = personaggioBGuess === character2Name;

    setResults({ correct1, correct2 });
    setShowResults(true);

    // Call the parent callback with the guesses
    onIdentificationComplete(personaggioAGuess, personaggioBGuess);
  };

  const getAvailableOptionsForB = () => {
    return characterOptions.filter(option => option.name !== personaggioAGuess);
  };

  if (showResults) {
    return (
      <Card className="max-w-2xl mx-auto p-8 bg-white/90 backdrop-blur-sm border-education/20">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-education/10 rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-education" />
          </div>
          
          <h2 className="text-2xl font-heading font-bold text-education-dark">
            {t('apps.aiIdentity.identification.resultsTitle', { defaultValue: 'Risultati Identificazione' })}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-education" />
                <span className="font-medium">Personaggio A</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-600">{personaggioAGuess}</span>
                {results.correct1 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-education" />
                <span className="font-medium">Personaggio B</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-gray-600">{personaggioBGuess}</span>
                {results.correct2 ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>
              {results.correct1 && results.correct2
                ? t('apps.aiIdentity.identification.perfectScore', { defaultValue: 'Perfetto! Hai identificato correttamente entrambi i personaggi!' })
                : results.correct1 || results.correct2
                ? t('apps.aiIdentity.identification.partialScore', { defaultValue: 'Hai indovinato almeno un personaggio. Continua a praticare!' })
                : t('apps.aiIdentity.identification.tryAgain', { defaultValue: 'Nessun personaggio corretto. Non ti arrendere, riprova!' })}
            </p>
          </div>

          <Button onClick={onBackToReflection} className="w-full bg-education hover:bg-education-dark">
            {t('common.continue', { defaultValue: 'Continua' })}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto p-8 bg-white/90 backdrop-blur-sm border-education/20">
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-education/10 rounded-full mb-4">
          <User className="h-8 w-8 text-education" />
        </div>
        
        <h2 className="text-2xl font-heading font-bold text-education-dark">
          {t('apps.aiIdentity.identification.title', { defaultValue: 'Chi è Chi?' })}
        </h2>
        
        <p className="text-education-muted">
          {t('apps.aiIdentity.identification.subtitle', { defaultValue: 'Basandoti sulle conversazioni, collega ogni personaggio al suo nome corretto' })}
        </p>

        <div className="space-y-6">
          {/* Personaggio A Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-education-dark flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personaggio A
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {characterOptions.map((option) => (
                <Button
                  key={option.name}
                  variant={personaggioAGuess === option.name ? "default" : "outline"}
                  onClick={() => setPersonaggioAGuess(option.name)}
                  className="justify-start text-left h-auto py-3"
                >
                  <div className="text-left">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Personaggio B Selection */}
          <div className="space-y-3">
            <h3 className="font-semibold text-education-dark flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personaggio B
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {getAvailableOptionsForB().map((option) => (
                <Button
                  key={option.name}
                  variant={personaggioBGuess === option.name ? "default" : "outline"}
                  onClick={() => setPersonaggioBGuess(option.name)}
                  className="justify-start text-left h-auto py-3"
                  disabled={!personaggioAGuess}
                >
                  <div className="text-left">
                    <div className="font-medium">{option.name}</div>
                    <div className="text-xs text-gray-500">{option.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSubmitIdentification} 
          className="w-full bg-education hover:bg-education-dark"
          disabled={!personaggioAGuess || !personaggioBGuess}
        >
          {t('apps.aiIdentity.identification.submit', { defaultValue: 'Invia Identificazione' })}
        </Button>
      </div>
    </Card>
  );
};

export default AiIdentityIdentificationPhase;