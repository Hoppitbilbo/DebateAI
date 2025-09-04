import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface WikiInterviewReflectionProps {
  onSubmit: (reflection: string) => void;
}

const WikiInterviewReflection = ({ onSubmit }: WikiInterviewReflectionProps) => {
  const { t } = useTranslation();

  const reflectionQuestions = t('apps.wikiInterview.reflection.questions', { returnObjects: true }) as string[];

  return (
    <SelfReflection 
      title={t('apps.wikiInterview.reflection.title')}
      description={t('apps.wikiInterview.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
      className="max-w-2xl mx-auto bg-gray-800 border-gray-700 text-white" // Added dark theme classes
    />
  );
};

export default WikiInterviewReflection;
