/**
 * @file Renders the character selection and persuasion topic input for the "ConvinciTu" game.
 * @remarks This component allows the user to select a character from Wikipedia and define a topic for persuasion.
 * It uses the `WikiSearchSelect` component for character search and selection.
 */

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { useTranslation } from "react-i18next";

/**
 * @interface WikiCharacter
 * @description Represents a character fetched from Wikipedia.
 * @property {string} title - The name of the character.
 * @property {string} snippet - A brief description of the character.
 * @property {number} pageid - The unique identifier for the Wikipedia page.
 */
interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @interface CharacterSelectionProps
 * @description Defines the props for the CharacterSelection component.
 * @property {WikiCharacter | null} selectedCharacter - The currently selected character, or null if none is selected.
 * @property {string} persuasionTopic - The topic of persuasion entered by the user.
 * @property {(character: WikiCharacter) => void} onCharacterSelect - Callback function triggered when a character is selected.
 * @property {(topic: string) => void} onTopicChange - Callback function triggered when the persuasion topic is changed.
 */
interface CharacterSelectionProps {
  selectedCharacter: WikiCharacter | null;
  persuasionTopic: string;
  onCharacterSelect: (character: WikiCharacter) => void;
  onTopicChange: (topic: string) => void;
}

/**
 * @function CharacterSelection
 * @description A component that allows users to select a character and specify a persuasion topic.
 * It integrates a Wikipedia search functionality for character selection and provides an input field for the topic.
 * @param {CharacterSelectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered character selection interface.
 */
const CharacterSelection = ({
  selectedCharacter,
  persuasionTopic,
  onCharacterSelect,
  onTopicChange,
}: CharacterSelectionProps) => {
  const { t } = useTranslation();

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-education mb-2">
            {t('apps.convinciTu.characterSelection.label')}
          </label>
          <WikiSearchSelect onSelect={onCharacterSelect} />
        </div>

        {selectedCharacter && (
          <div>
            <label className="block text-sm font-medium text-education mb-2">
              {t('apps.convinciTu.topic.label', { characterName: selectedCharacter.title })}
            </label>
            <Input
              placeholder={t('apps.convinciTu.topic.placeholder')}
              value={persuasionTopic}
              onChange={(e) => onTopicChange(e.target.value)}
              className="w-full"
            />
          </div>
        )}
      </div>
    </Card>
  );
};

export default CharacterSelection;
