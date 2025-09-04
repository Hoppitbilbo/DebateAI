
import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface ImpersonaTuReflectionProps {
  onSubmit: (reflection: string) => void;
  characterName?: string;
}

const ImpersonaTuReflection = ({ onSubmit, characterName }: ImpersonaTuReflectionProps) => {
  const { t } = useTranslation();

  const finalCharacterName = characterName || t('apps.impersonaTu.reflection.defaultCharacterName');
  
  const reflectionQuestions = [
    t('apps.impersonaTu.reflection.questions.performance', { characterName: finalCharacterName }),
    t('apps.impersonaTu.reflection.questions.easiest'),
    t('apps.impersonaTu.reflection.questions.challenges', { characterName: finalCharacterName }),
    t('apps.impersonaTu.reflection.questions.understanding', { characterName: finalCharacterName }),
    t('apps.impersonaTu.reflection.questions.selfLearning')
  ];

  return (
    <SelfReflection 
      title={t('apps.impersonaTu.reflection.title')}
      description={t('apps.impersonaTu.reflection.description', { characterName: finalCharacterName })}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
    />
  );
};

export default ImpersonaTuReflection;
