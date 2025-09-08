/**
 * @file Renders the self-reflection component for the "WikiInterview" activity.
 * @remarks This component uses the shared `SelfReflection` component to guide the user through
 * a series of questions about their experience moderating the interview.
 */

import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

/**
 * @interface WikiInterviewReflectionProps
 * @description Defines the props for the WikiInterviewReflection component.
 * @property {(reflection: string) => void} onSubmit - Callback function triggered when the user submits their reflection.
 */
interface WikiInterviewReflectionProps {
  onSubmit: (reflection: string) => void;
}

/**
 * @function WikiInterviewReflection
 * @description A component that prompts the user to reflect on their performance in the "WikiInterview" game.
 * It provides a structured set of questions tailored to the interview moderation activity.
 * @param {WikiInterviewReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection interface.
 */
const WikiInterviewReflection = ({ onSubmit }: WikiInterviewReflectionProps) => {
  const { t } = useTranslation();

  const reflectionQuestions = t('apps.wikiInterview.reflection.questions', { returnObjects: true }) as string[];

  return (
    <SelfReflection 
      title={t('apps.wikiInterview.reflection.title')}
      description={t('apps.wikiInterview.reflection.description')}
      questions={reflectionQuestions}
      onSubmit={onSubmit}
      className="max-w-2xl mx-auto bg-gray-800 border-gray-700 text-white"
    />
  );
};

export default WikiInterviewReflection;
