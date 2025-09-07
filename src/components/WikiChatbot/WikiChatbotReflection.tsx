/**
 * @file Renders the self-reflection component for the WikiChatbot activity.
 * @remarks This component uses the shared `SelfReflection` component to guide the user through a series of
 * reflection questions related to their conversation with the AI.
 */

import SelfReflection from "@/components/shared/SelfReflection";

/**
 * @interface WikiChatbotReflectionProps
 * @description Defines the props for the WikiChatbotReflection component.
 * @property {(reflection: string) => void} onSubmit - Callback function that is triggered when the user submits their reflection.
 */
interface WikiChatbotReflectionProps {
  onSubmit: (reflection: string) => void;
}

/**
 * @function WikiChatbotReflection
 * @description A component that prompts the user to reflect on their learning experience with the WikiChatbot.
 * It provides a structured set of questions to guide the user's thoughts and captures their written reflection.
 * @param {WikiChatbotReflectionProps} props - The props for the component.
 * @returns {JSX.Element} The rendered self-reflection interface.
 */
const WikiChatbotReflection = ({ onSubmit }: WikiChatbotReflectionProps) => {
  const reflectionQuestions = [
    "Cosa hai imparato dalla conversazione con questo personaggio o argomento?",
    "Quali informazioni ti hanno sorpreso o ti sono sembrate particolarmente interessanti?",
    "Ci sono aspetti di questo argomento che vorresti approfondire ulteriormente?",
    "Come potresti utilizzare le informazioni apprese in un contesto reale o scolastico?",
    "Quali domande avresti potuto fare per rendere la conversazione più significativa?"
  ];

  return (
    <SelfReflection 
      title="Riflessione sull'Apprendimento"
      description="Rifletti su cosa hai imparato durante questa conversazione."
      questions={reflectionQuestions}
      onSubmit={onSubmit}
    />
  );
};

export default WikiChatbotReflection;
