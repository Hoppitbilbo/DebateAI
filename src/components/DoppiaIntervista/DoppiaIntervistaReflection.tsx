/**
 * @file Renders the self-reflection component for the "Doppia Intervista" (Double Interview) game.
 * @remarks This component utilizes the shared `SelfReflection` component to present a series of questions
 * that guide the user to reflect on their interview performance.
 */

import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

/**
 * @interface DoppiaIntervistaReflectionProps
 * @description Defines the props for the DoppiaIntervistaReflection component.
 * @property {(reflection: string) => void} onSubmit - Callback function triggered when the user submits their reflection.
 */
interface DoppiaIntervistaReflectionProps {
  onSubmit: (reflection: string) => void;
}

/**
 * @function DoppiaIntervistaReflection
 * @description A component that prompts the user to reflect on their performance in the "Doppia Intervista" game.
 * It provides a structured set of questions to guide the user's thoughts and captures their written reflection.
 * @param {DoppiaIntervistaReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection interface.
 */
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
