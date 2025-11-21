import React, { useState } from "react";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core";
import { Message as EvaluationMessage } from "@/types/conversation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, User, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface AiIdentityIdentificationPhaseProps {
  character1Name: string;
  character2Name: string;
  character1Snippet: string;
  character2Snippet: string;
  mode?: "easy" | "medium" | "hard";
  optionsA?: string[];
  optionsB?: string[];
  recentMessages?: EvaluationMessage[];
  onIdentificationComplete: (guess1: string, guess2: string) => void;
  onBackToReflection: () => void;
}

const AiIdentityIdentificationPhase: React.FC<AiIdentityIdentificationPhaseProps> = ({
  character1Name,
  character2Name,
  character1Snippet,
  character2Snippet,
  onIdentificationComplete,
  onBackToReflection,
  mode = "easy",
  optionsA = [],
  optionsB = [],
  recentMessages = [],
}) => {
  const { t } = useTranslation();
  const [personaggioAGuess, setPersonaggioAGuess] = useState("");
  const [personaggioBGuess, setPersonaggioBGuess] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState({ correct1: false, correct2: false });

  const characterOptions = [
    { name: character1Name, description: character1Snippet },
    { name: character2Name, description: character2Snippet },
  ];

  const DraggableName: React.FC<{ id: string; label: string }> = ({ id, label }) => {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });
    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={style}
        className="cursor-move inline-flex items-center px-3 py-1 rounded bg-blue-100 text-blue-800 text-xs border border-blue-200"
      >
        {label}
      </div>
    );
  };

  const DropZone: React.FC<{ id: "A" | "B"; assigned: string; onClear: () => void }> = ({ id, assigned, onClear }) => {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
      <div
        ref={setNodeRef}
        className={`min-h-[64px] p-3 rounded border ${isOver ? "border-education bg-education/10" : "border-gray-200 bg-gray-50"}`}
      >
        <div className="flex items-center justify-between">
          <span className="font-medium">{id === "A" ? "Personaggio A" : "Personaggio B"}</span>
          {assigned && (
            <button onClick={onClear} className="text-xs text-gray-500 hover:text-gray-700">{t('common.reset', { defaultValue: 'Reset' })}</button>
          )}
        </div>
        <div className="mt-2 text-sm text-gray-700">
          {assigned ? assigned : t('apps.aiIdentity.identification.selectBothCharacters')}
        </div>
      </div>
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const droppedName = active.id as string;
    if (over.id === "A") {
      setPersonaggioAGuess(droppedName);
      if (personaggioBGuess === droppedName) setPersonaggioBGuess("");
    } else if (over.id === "B") {
      setPersonaggioBGuess(droppedName);
      if (personaggioAGuess === droppedName) setPersonaggioAGuess("");
    }
  };

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
        <p className="text-sm text-education mt-2">
          {t('apps.aiIdentity.identification.instructionsDrag', { defaultValue: 'Trascina ogni nome nelle caselle di Personaggio A e Personaggio B, oppure usa i pulsanti sotto.' })}
        </p>

        {(mode === "easy" || mode === "medium") && (
          <DndContext onDragEnd={handleDragEnd}>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {([...(optionsA.length ? optionsA : [character1Name]), ...(optionsB.length ? optionsB : [character2Name])]).map((name) => (
                  <DraggableName key={name} id={name} label={name} />
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DropZone id="A" assigned={personaggioAGuess} onClear={() => setPersonaggioAGuess("")} />
                <DropZone id="B" assigned={personaggioBGuess} onClear={() => setPersonaggioBGuess("")} />
              </div>
            </div>
          </DndContext>
        )}

        <div className="space-y-6">
          {/* Selezione A con Select */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-education-dark flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personaggio A
            </h3>
            <select
              value={personaggioAGuess}
              onChange={(e) => setPersonaggioAGuess(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="" disabled>{"Seleziona un nome"}</option>
              {(optionsA.length ? optionsA : [character1Name, character2Name]).map((name) => (
                <option key={`A-${name}`} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Selezione B con Select */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-education-dark flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personaggio B
            </h3>
            <select
              value={personaggioBGuess}
              onChange={(e) => setPersonaggioBGuess(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              disabled={!personaggioAGuess}
            >
              <option value="" disabled>{"Seleziona un nome"}</option>
              {(optionsB.length ? optionsB : [character2Name, character1Name]).filter(name => name !== personaggioAGuess).map((name) => (
                <option key={`B-${name}`} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <Button 
          onClick={handleSubmitIdentification} 
          className="w-full bg-education hover:bg-education-dark"
          disabled={!personaggioAGuess || !personaggioBGuess}
        >
          {t('apps.aiIdentity.identification.submit', { defaultValue: 'Invia Identificazione' })}
        </Button>

        {/* Chat precedente */}
        {recentMessages && recentMessages.length > 0 && (
          <div className="mt-6 text-left">
            <h4 className="font-semibold text-education-dark mb-2">{t('chat.previous', { defaultValue: 'Chat precedente' })}</h4>
            <div className="space-y-2 max-h-56 overflow-y-auto border rounded p-3 bg-gray-50">
              {recentMessages.map((m, idx) => (
                <div key={`prev-${idx}`} className="text-sm">
                  {m.role === 'user' ? (
                    <p className="text-education font-medium">{t('chat.you')}: {m.content}</p>
                  ) : (
                    <p className="text-gray-800"><span className="font-medium">{m.characterName}</span>: {m.content}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default AiIdentityIdentificationPhase;