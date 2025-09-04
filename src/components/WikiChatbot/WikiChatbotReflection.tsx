
import SelfReflection from "@/components/shared/SelfReflection";

interface WikiChatbotReflectionProps {
  onSubmit: (reflection: string) => void;
}

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
