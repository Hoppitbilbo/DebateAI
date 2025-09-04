
import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface DoppiaIntervistaReflectionProps {
  onSubmit: (reflection: string) => void;
}

const DoppiaIntervistaReflection = ({ onSubmit }: DoppiaIntervistaReflectionProps) => {
  const { t } = useTranslation();

  const reflectionQuestions = [
    t('apps.doppiaIntervista.reflection.questions.q1'),
    t('apps.doppiaIntervista.reflection.questions.q2'),
    t('apps.doppiaIntervista.reflection.questions.q3'),
    t('apps.doppiaIntervista.reflection.questions.q4'),
    t('apps.doppiaIntervista.reflection.questions.q5')
  ];

  return (
    <SelfReflection 
      title={t('apps.doppiaIntervista.reflection.title')}
      description={t('apps.doppiaIntervista.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
    />
  );
};

export default DoppiaIntervistaReflection;
