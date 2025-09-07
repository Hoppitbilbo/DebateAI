/**
 * @file Renders the setup screen for the "Personaggio Misterioso" game.
 * @remarks This component allows the user to select a character using the `WikiSearchSelect` component,
 * set the game difficulty (number of questions), and start the game.
 */

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SlidersHorizontal } from "lucide-react";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { WikiCharacter } from "./types";
import { useTranslation } from "react-i18next";

/**
 * @interface GameSetupProps
 * @description Defines the props for the GameSetup component.
 * @property {(character: WikiCharacter) => void} onCharacterSelect - Callback for when a character is selected.
 * @property {number} difficulty - The current difficulty level (number of questions).
 * @property {(value: number[]) => void} onDifficultyChange - Callback for when the difficulty slider changes.
 * @property {() => void} onStartGame - Callback to start the game.
 */
interface GameSetupProps {
  onCharacterSelect: (character: WikiCharacter) => void;
  difficulty: number;
  onDifficultyChange: (value: number[]) => void;
  onStartGame: () => void;
}

/**
 * @function GameSetup
 * @description The component for setting up a new game of "Personaggio Misterioso".
 * It includes character selection and difficulty adjustment.
 * @param {GameSetupProps} props - The props for the component.
 * @returns {JSX.Element} The rendered game setup screen.
 */
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
