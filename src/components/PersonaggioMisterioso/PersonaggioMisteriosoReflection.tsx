
import SelfReflection from "@/components/shared/SelfReflection";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface PersonaggioMisteriosoReflectionProps {
  onSubmit: (reflection: string) => void;
  characterName?: string;
  gameResult?: { // Added to provide context about the guess
    correctGuess: boolean;
    finalGuess?: string;
  };
  // conversation?: Message[]; // Potentially add if questions need to refer to it
}

const PersonaggioMisteriosoReflection = ({ 
  onSubmit, 
  characterName = "il personaggio misterioso",
  gameResult
}: PersonaggioMisteriosoReflectionProps) => {
  const reflectionQuestions = [
    `Come valuti la tua strategia nel porre domande per identificare ${characterName}? Quali domande sono state più efficaci e perché?`,
    `Quali indizi specifici ti hanno portato a considerare (o escludere) certi personaggi?`,
    `Se hai indovinato ${characterName}, cosa ti ha dato la certezza finale? Se non hai indovinato, cosa ti ha portato fuori strada o quale informazione ti è mancata?`,
    "Quali aspetti del personaggio o del suo contesto storico hai trovato più interessanti o sorprendenti durante il gioco?",
    `Cosa hai imparato specificamente su ${characterName} che non sapevi prima o che questa esperienza ha consolidato?`,
    "Come potresti migliorare il tuo approccio (strategia, tipo di domande, analisi delle risposte) in un futuro gioco simile?"
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-education-light">Riflessione sul Gioco</CardTitle>
        <CardDescription className="text-lg mt-2">
          Ora rifletti sulla tua esperienza nel tentativo di indovinare <span className="font-semibold text-education">{characterName}</span>.
          {gameResult && (
            <p className="mt-1 text-sm">
              {gameResult.correctGuess 
                ? `Hai indovinato correttamente!` 
                : `Non hai indovinato. La tua ipotesi era "${gameResult.finalGuess || 'N/A'}".`}
            </p>
          )}
        </CardDescription>
      </CardHeader>
      <SelfReflection 
        title="Domande per la tua Auto-Riflessione:"
        description="Prenditi un momento per pensare criticamente al tuo processo di gioco e a cosa hai appreso."
        questions={reflectionQuestions}
        onSubmit={onSubmit}
        submitButtonText="Invia Riflessione e Vedi Valutazione"
      />
    </Card>
  );
};

export default PersonaggioMisteriosoReflection;
