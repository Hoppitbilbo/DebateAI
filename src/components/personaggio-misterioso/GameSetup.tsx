
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal } from "lucide-react";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { WikiCharacter } from "./types";
import { useTranslation } from "react-i18next";

interface GameSetupProps {
  onCharacterSelect: (character: WikiCharacter) => void;
  difficulty: number;
  onDifficultyChange: (value: number[]) => void;
  onStartGame: () => void;
}

const GameSetup = ({
  onCharacterSelect,
  difficulty,
  onDifficultyChange,
  onStartGame,
}: GameSetupProps) => {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium text-education mb-2">
{t('apps.personaggioMisterioso.setup.selectCharacterLabel')}
      </label>
      <WikiSearchSelect onSelect={onCharacterSelect} />

      <div className="space-y-4 mt-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <label className="text-sm font-medium text-education">
            {t('apps.personaggioMisterioso.setup.difficultyLabel', { count: difficulty })}
          </label>
        </div>
        <Slider
          value={[difficulty]}
          onValueChange={onDifficultyChange}
          min={3}
          max={10}
          step={1}
          className="w-full"
        />
        
        <Button
          onClick={onStartGame}
          className="w-full bg-education hover:bg-education-dark"
        >
          {t('apps.personaggioMisterioso.setup.startButton')}
        </Button>
      </div>
    </div>
  );
};

export default GameSetup;
