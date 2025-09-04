
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import { useTranslation } from "react-i18next";

interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

interface CharacterSelectionProps {
  selectedCharacter: WikiCharacter | null;
  persuasionTopic: string;
  onCharacterSelect: (character: WikiCharacter) => void;
  onTopicChange: (topic: string) => void;
}

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
