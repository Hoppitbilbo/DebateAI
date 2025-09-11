import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface YouModerateReflectionProps {
  onSubmit: (reflection: string) => void;
}

const YouModerateReflection = ({ onSubmit }: YouModerateReflectionProps) => {
  const { t } = useTranslation();

  const reflectionQuestions = t('apps.youModerate.reflection.questions', { returnObjects: true }) as string[];

  return (
    <SelfReflection 
      title={t('apps.youModerate.reflection.title')}
      description={t('apps.youModerate.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
      className="max-w-2xl mx-auto bg-gray-800 border-gray-700 text-white" // Added dark theme classes
    />
  );
};

export default YouModerateReflection;
