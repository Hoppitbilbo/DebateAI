
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

interface FinalGuessProps {
  finalGuess: string;
  reasoning: string;
  onFinalGuessChange: (value: string) => void;
  onReasoningChange: (value: string) => void;
  onSubmitGuess: () => void;
}

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
