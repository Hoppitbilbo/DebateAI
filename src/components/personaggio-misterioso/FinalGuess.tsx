/**
 * @file Renders the final guess interface for the "Personaggio Misterioso" game.
 * @remarks This component provides input fields for the user to enter their final guess
 * for the character's name and their reasoning behind the guess.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

/**
 * @interface FinalGuessProps
 * @description Defines the props for the FinalGuess component.
 * @property {string} finalGuess - The current value of the final guess input.
 * @property {string} reasoning - The current value of the reasoning textarea.
 * @property {(value: string) => void} onFinalGuessChange - Callback for when the final guess input changes.
 * @property {(value: string) => void} onReasoningChange - Callback for when the reasoning textarea changes.
 * @property {() => void} onSubmitGuess - Callback to submit the final guess.
 */
interface FinalGuessProps {
  finalGuess: string;
  reasoning: string;
  onFinalGuessChange: (value: string) => void;
  onReasoningChange: (value: string) => void;
  onSubmitGuess: () => void;
}

/**
 * @function FinalGuess
 * @description A component that allows the user to submit their final guess and reasoning.
 * @param {FinalGuessProps} props - The props for the component.
 * @returns {JSX.Element} The rendered final guess form.
 */
const FinalGuess = ({
  finalGuess,
  reasoning,
  onFinalGuessChange,
  onReasoningChange,
  onSubmitGuess,
}: FinalGuessProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-education-dark">
        {t('apps.personaggioMisterioso.finalGuess.title', { defaultValue: 'Fai il tuo tentativo finale!' })}
      </h3>
      <div>
        <label className="block text-sm font-medium text-education mb-2">
          {t('apps.personaggioMisterioso.finalGuess.questionLabel', { defaultValue: 'Chi pensi che sia il personaggio?' })}
        </label>
        <Input
          value={finalGuess}
          onChange={(e) => onFinalGuessChange(e.target.value)}
          placeholder={t('apps.personaggioMisterioso.finalGuess.namePlaceholder', { defaultValue: 'Inserisci il nome del personaggio' })}
          className="w-full"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-education mb-2">
          {t('apps.personaggioMisterioso.finalGuess.reasonLabel', { defaultValue: 'Perché pensi che sia questo personaggio?' })}
        </label>
        <Textarea
          value={reasoning}
          onChange={(e) => onReasoningChange(e.target.value)}
          placeholder={t('apps.personaggioMisterioso.finalGuess.reasonPlaceholder', { defaultValue: 'Spiega il tuo ragionamento...' })}
          className="min-h-[100px]"
        />
      </div>
      <Button
        className="w-full bg-education hover:bg-education-dark"
        onClick={onSubmitGuess}
        disabled={!finalGuess.trim() || !reasoning.trim()}
      >
        {t('apps.personaggioMisterioso.finalGuess.submit', { defaultValue: 'Invia la tua risposta' })}
      </Button>
    </div>
  );
};

export default FinalGuess;
