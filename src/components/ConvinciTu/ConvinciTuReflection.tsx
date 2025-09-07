/**
 * @file Renders the self-reflection component for the "ConvinciTu" game.
 * @remarks This component uses the shared `SelfReflection` component to guide the user through a series of
 * reflection questions related to their persuasion attempt.
 */

import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

/**
 * @interface ConvinciTuReflectionProps
 * @description Defines the props for the ConvinciTuReflection component.
 * @property {(reflection: string) => void} onSubmit - Callback function that is triggered when the user submits their reflection.
 */
interface ConvinciTuReflectionProps {
  onSubmit: (reflection: string) => void;
}

/**
 * @function ConvinciTuReflection
 * @description A component that prompts the user to reflect on their performance in the "ConvinciTu" game.
 * It provides a structured set of questions to guide the user's thoughts and captures their written reflection.
 * @param {ConvinciTuReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection interface.
 */
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
