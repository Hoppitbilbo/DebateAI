import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

interface InquiryDialogueReflectionProps {
  onSubmit: (reflection: string) => void;
}

const InquiryDialogueReflection = ({ onSubmit }: InquiryDialogueReflectionProps) => {
  const { t } = useTranslation();

  const reflectionQuestions = t('apps.inquiryDialogue.reflection.questions', { returnObjects: true }) as string[];

  return (
    <SelfReflection 
      title={t('apps.inquiryDialogue.reflection.title')}
      description={t('apps.inquiryDialogue.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
      className="max-w-2xl mx-auto bg-gray-800 border-gray-700 text-white" // Added dark theme classes
    />
  );
};

export default InquiryDialogueReflection;