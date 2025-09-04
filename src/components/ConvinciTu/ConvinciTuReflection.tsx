
import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface ConvinciTuReflectionProps {
  onSubmit: (reflection: string) => void;
}

const ConvinciTuReflection = ({ onSubmit }: ConvinciTuReflectionProps) => {
  const { t } = useTranslation();
  
  const reflectionQuestions = [
    t('apps.convinciTu.reflection.questions.success'),
    t('apps.convinciTu.reflection.questions.strategies'),
    t('apps.convinciTu.reflection.questions.difficulties'),
    t('apps.convinciTu.reflection.questions.differently'),
    t('apps.convinciTu.reflection.questions.convinced')
  ];

  return (
    <SelfReflection 
      title={t('apps.convinciTu.reflection.title')}
      description={t('apps.convinciTu.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
    />
  );
};

export default ConvinciTuReflection;
