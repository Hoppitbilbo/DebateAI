/**
 * @file Renders the header for the "Personaggio Misterioso" game.
 * @remarks This component displays the game title, the number of questions remaining,
 * and controls for revealing the character's name and starting a new game.
 */

import { Button } from "@/components/ui/button";
import { EyeOff, ListOrdered, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * @interface GameHeaderProps
 * @description Defines the props for the GameHeader component.
 * @property {number} questionsLeft - The number of questions the user has remaining.
 * @property {boolean} hideCharacter - Whether the character's name is currently hidden.
 * @property {() => void} onToggleHideCharacter - Callback to toggle the visibility of the character's name.
 * @property {string} characterName - The name of the mystery character.
 * @property {() => void} onNewGame - Callback to start a new game.
 */
interface GameHeaderProps {
  questionsLeft: number;
  hideCharacter: boolean;
  onToggleHideCharacter: () => void;
  characterName: string;
  onNewGame: () => void;
}

/**
 * @function GameHeader
 * @description The header component for the "Personaggio Misterioso" game, displaying key game state information and actions.
 * @param {GameHeaderProps} props - The props for the component.
 * @returns {JSX.Element} The rendered game header.
 */
const GameHeader = ({
  questionsLeft,
  hideCharacter,
  onToggleHideCharacter,
  characterName,
  onNewGame,
}: GameHeaderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-semibold text-education-dark">{t('apps.personaggioMisterioso.header.title')}</h2>
      <div className="flex items-center gap-4">
        <div className="bg-purple-50 dark:bg-gray-800 p-4 rounded-lg flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              {t('apps.personaggioMisterioso.header.questionsLeft', { count: questionsLeft })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleHideCharacter}
          >
            <EyeOff className="h-4 w-4" />
          </Button>
          <div className="text-sm">
            {t('apps.personaggioMisterioso.header.characterLabel')}{' '}
            {hideCharacter ? t('apps.personaggioMisterioso.header.hiddenCharacter') : characterName}
          </div>
        </div>
        <Button 
          variant="outline"
          onClick={onNewGame}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          {t('apps.personaggioMisterioso.header.newGameButton')}
        </Button>
      </div>
    </div>
  );
};

export default GameHeader;
