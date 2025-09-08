/**
 * @file Renders the self-reflection component for the "ImpersonaTu" (Impersonate) game.
 * @remarks This component uses the shared `SelfReflection` component to guide the user through
 * a series of questions about their experience impersonating a character.
 */

import SelfReflection from "@/components/shared/SelfReflection";
import { useTranslation } from "react-i18next";

/**
 * @interface ImpersonaTuReflectionProps
 * @description Defines the props for the ImpersonaTuReflection component.
 * @property {(reflection: string) => void} onSubmit - Callback function triggered when the user submits their reflection.
 * @property {string} [characterName] - The name of the character the user impersonated.
 */
interface ImpersonaTuReflectionProps {
  onSubmit: (reflection: string) => void;
  characterName?: string;
}

/**
 * @function ImpersonaTuReflection
 * @description A component that prompts the user to reflect on their performance in the "ImpersonaTu" game.
 * It provides a structured set of questions tailored to the impersonation activity.
 * @param {ImpersonaTuReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection interface.
 */
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
