
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionComparison from "@/components/shared/ReflectionComparison";
import { WikiChatMessage } from "./types";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { saveAs } from 'file-saver';

interface WikiChatbotFeedbackProps {
  userReflection: string;
  aiEvaluation: string | null;
  isEvaluating: boolean;
  onStartNewChat: () => void;
  messages: WikiChatMessage[];
}

const WikiChatbotFeedback: React.FC<WikiChatbotFeedbackProps> = ({
  userReflection,
  aiEvaluation,
  isEvaluating,
  onStartNewChat,
  messages
}) => {
  const [isConversationExpanded, setIsConversationExpanded] = useState(true);

  const toggleConversation = () => {
    setIsConversationExpanded(!isConversationExpanded);
  };

  const downloadReflection = () => {
    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const content = `# Attività di Riflessione: WikiChat

## Conversazione
${messages.map(msg => `### ${msg.role === 'user' ? 'Tu' : 'AI'}\n${msg.content}`).join('\n\n')}

## Riflessione dello Studente
${userReflection}

## Valutazione dell'IA
${aiEvaluation || 'Nessuna valutazione disponibile'}

---
Generato da AI-Debate.Tech - ${formattedDate}`;
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `attività-${formattedDate}.md`);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-education-light">Feedback e Valutazione del Dialogo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversation History Section */}
        <div className="border rounded-lg p-4">
          <div 
            className="flex justify-between items-center cursor-pointer" 
            onClick={toggleConversation}
          >
            <h3 className="text-xl font-semibold">Cronologia della Conversazione</h3>
            <Button variant="ghost" size="sm">
              {isConversationExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>
          
          {isConversationExpanded && (
            <div className="mt-4 max-h-96 overflow-y-auto pr-2">
              {messages.map((message, index) => (
                <div key={index} className={`mb-4 p-3 rounded-lg ${message.role === 'user' ? 'bg-muted ml-8' : 'bg-primary/10 mr-8'}`}>
                  <p className="font-semibold mb-1">{message.role === 'user' ? 'Tu' : 'AI'}</p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reflection and Evaluation Section */}
        <ReflectionComparison
          userReflection={userReflection}
          aiEvaluation={aiEvaluation || (isEvaluating ? "Caricamento feedback AI..." : "Nessun feedback testuale ricevuto dall'IA.")}
          isLoading={isEvaluating}
          onContinue={onStartNewChat}
          continueButtonText={
            <>
              <RefreshCcw className="mr-2 h-4 w-4" /> Inizia un Nuovo Dialogo
            </>
          }
        />
        
        {/* Download Button */}
        <div className="flex justify-center mt-4">
          <Button 
            variant="outline" 
            onClick={downloadReflection}
            className="flex items-center"
          >
            <Download className="mr-2 h-4 w-4" /> Scarica Riflessione
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WikiChatbotFeedback;
