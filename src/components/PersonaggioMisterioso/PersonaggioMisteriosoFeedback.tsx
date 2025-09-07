/**
 * @file Renders the feedback screen for the "Personaggio Misterioso" (Mystery Character) game.
 * @remarks This component displays whether the user's guess was correct, shows a detailed breakdown
 * of their scores (for the guess, conversation quality, and reflection), and compares the user's
 * reflection with AI-generated feedback.
 */

import ReflectionComparison from "@/components/shared/ReflectionComparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCcw, CheckCircle, XCircle, MessageSquareText, Brain, UserCheck } from "lucide-react";
import { AIScoreEvaluation } from "@/utils/evaluationUtils";

/**
 * @interface PersonaggioMisteriosoFeedbackProps
 * @description Defines the props for the PersonaggioMisteriosoFeedback component.
 * @property {string} reflection - The user's written reflection on their thought process.
 * @property {AIScoreEvaluation | null} evaluation - The structured evaluation from the AI, including scores and rationales.
 * @property {boolean} isLoading - Flag indicating if the AI evaluation is being generated.
 * @property {() => void} onStartNewGame - Callback function to start a new game.
 * @property {boolean} correctGuess - Whether the user guessed the character correctly.
 * @property {string} characterName - The name of the correct mystery character.
 * @property {string} [finalGuess] - The user's final guess.
 * @property {number | null} [nameScore] - The score awarded for the guess itself (e.g., 10 for correct, 0 for incorrect).
 */
interface PersonaggioMisteriosoFeedbackProps {
  reflection: string;
  evaluation: AIScoreEvaluation | null;
  isLoading: boolean;
  onStartNewGame: () => void;
  correctGuess: boolean;
  characterName: string; 
  finalGuess?: string; 
  nameScore?: number | null;
}

/**
 * @function ScoreDisplay
 * @description A helper component to display a labeled score with an optional rationale and icon.
 * @param {object} props - The props for the component.
 * @param {string} props.label - The label for the score (e.g., "Qualità Conversazione").
 * @param {number} [props.score] - The numerical score.
 * @param {string} [props.rationale] - The AI's rationale for the score.
 * @param {React.ReactNode} [props.icon] - An optional icon to display next to the label.
 * @returns {JSX.Element | null} The rendered score display, or null if the score is not a number.
 */
const ScoreDisplay = ({ label, score, rationale, icon }: { label: string, score?: number, rationale?: string, icon?: React.ReactNode }) => {
  if (typeof score !== 'number') return null;
  return (
    <div className="mb-4 p-3 border rounded-lg shadow-sm bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center text-lg font-semibold mb-1 text-education">
        {icon && <span className="mr-2">{icon}</span>}
        {label}: <span className="ml-2 text-blue-600 dark:text-blue-400">{score}/10</span>
      </div>
      {rationale && <p className="text-sm text-muted-foreground ml-7"><em>{rationale}</em></p>}
    </div>
  );
};

/**
 * @function PersonaggioMisteriosoFeedback
 * @description The main feedback component for the "Personaggio Misterioso" game. It provides a comprehensive
 * summary of the user's performance, including scores, AI feedback, and the correct answer.
 * @param {PersonaggioMisteriosoFeedbackProps} props - The props for the component.
 * @returns {JSX.Element} The rendered feedback screen.
 */
const PersonaggioMisteriosoFeedback = ({ 
  reflection, 
  evaluation, 
  isLoading, 
  onStartNewGame,
  correctGuess,
  characterName,
  finalGuess,
  nameScore
}: PersonaggioMisteriosoFeedbackProps) => {

  const totalScore = (
    (evaluation?.conversationScore || 0) + 
    (evaluation?.reflectionScore || 0) + 
    (nameScore || 0)
  );
  const maxPossibleScore = 10 + 10 + 10;

  return (
    <Card className={`shadow-lg ${correctGuess ? 'border-green-500' : 'border-red-500'} border-2`}>
      <CardHeader className="text-center">
        <CardTitle className={`text-2xl font-bold flex items-center justify-center ${correctGuess ? 'text-green-600' : 'text-red-600'}`}>
          {correctGuess ? (
            <CheckCircle className="mr-2 h-8 w-8" />
          ) : (
            <XCircle className="mr-2 h-8 w-8" />
          )}
          {correctGuess ? "Complimenti! Risposta Esatta!" : "Peccato, Risposta Errata"}
        </CardTitle>
        <CardDescription className="text-lg mt-2">
          {correctGuess ? 
            `Hai indovinato correttamente! Il personaggio era proprio ` : 
            `Non hai indovinato. Il personaggio misterioso era `
          }
          <span className="font-semibold text-education-light">{characterName}</span>.
          {!correctGuess && finalGuess && (
            <p className="mt-1">La tua ipotesi era: <span className="font-semibold">{finalGuess}</span>.</p>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <div className="text-center">
            <p>Valutazione AI in corso...</p>
          </div>
        )}

        {!isLoading && evaluation && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-center mb-3">Dettaglio Punteggi</h3>
            <ScoreDisplay 
              label="Correttezza Nome"
              score={nameScore ?? undefined} 
              rationale={nameScore === 10 ? "Hai indovinato il personaggio!" : "Non hai indovinato il personaggio."} 
              icon={<UserCheck className="h-5 w-5"/>}
            />
            <ScoreDisplay 
              label="Qualità Conversazione"
              score={evaluation.conversationScore}
              rationale={evaluation.conversationRationale}
              icon={<MessageSquareText className="h-5 w-5"/>}
            />
            <ScoreDisplay 
              label="Qualità Riflessione"
              score={evaluation.reflectionScore}
              rationale={evaluation.reflectionRationale}
              icon={<Brain className="h-5 w-5"/>}
            />
            <div className="text-center mt-4 pt-4 border-t">
                <p className="text-xl font-bold text-education-dark">
                    Punteggio Totale: {totalScore} / {maxPossibleScore}
                </p>
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xl font-semibold text-center mb-2 mt-6">Feedback e Riflessione</h4>
          <p className="text-muted-foreground text-center mb-4">
            Ecco un confronto tra la tua auto-riflessione e il feedback testuale fornito dall'IA.
          </p>
          <ReflectionComparison
            userReflection={reflection}
            aiEvaluation={evaluation?.textualFeedback || (isLoading ? "Caricamento feedback AI..." : "Nessun feedback testuale ricevuto dall'IA.")}
            isLoading={isLoading && !evaluation}
            onContinue={onStartNewGame} 
            continueButtonText={"Placeholder"} 
            hideContinueButton={true} 
          />
        </div>
        <div className="text-center pt-4">
            <Button onClick={onStartNewGame} size="lg" className="bg-education hover:bg-education-dark">
                <RefreshCcw className="mr-2 h-4 w-4" /> Nuovo Gioco
            </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonaggioMisteriosoFeedback;
