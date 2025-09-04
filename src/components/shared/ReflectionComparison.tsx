
import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { Message } from "@/types/conversation";
import { toast } from "sonner";
import ReflectionDisplayCard from "./ReflectionDisplayCard"; // Import the new component

interface ReflectionComparisonProps {
  userReflection: string;
  aiEvaluation: string | null;
  isLoading: boolean;
  onContinue: () => void;
  continueButtonText?: React.ReactNode;
  activityType?: string;
  characterName?: string;
  topic?: string;
  conversation?: Message[];
  className?: string;
  hideContinueButton?: boolean; // New prop
}

const ReflectionComparison = ({
  userReflection,
  aiEvaluation,
  isLoading,
  onContinue,
  continueButtonText = "Continua",
  activityType = "Attività",
  characterName,
  topic,
  conversation = [],
  className = "",
  hideContinueButton = false, // Default to false
}: ReflectionComparisonProps) => {
  
  const handleDownload = () => {
    try {
      downloadReflection({
        activityType,
        characterName,
        topic,
        conversation,
        userReflection,
        aiEvaluation: aiEvaluation || undefined
      });
      toast.success("Riflessione scaricata con successo!");
    } catch (error) {
      console.error("Error downloading reflection:", error);
      toast.error("Errore durante il download della riflessione");
    }
  };
  
  return (
    <div className={`space-y-8 max-w-4xl mx-auto ${className}`}>
      <ReflectionDisplayCard
        title="La tua riflessione"
        content={userReflection}
        contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap dark:text-gray-100" 
      />

      <ReflectionDisplayCard
        title="Feedback"
        content={aiEvaluation}
        isLoading={isLoading}
        renderAsHtml={true} 
      />

      <div className={`flex flex-col sm:flex-row gap-4 ${hideContinueButton ? 'justify-start' : 'justify-between'}`}>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="bg-white text-education border-education hover:bg-education hover:text-white"
          disabled={isLoading}
        >
          <Download className="mr-2 h-5 w-5" />
          Scarica Riflessione
        </Button>
        
        {!hideContinueButton && (
          <Button
            onClick={onContinue}
            className="bg-education hover:bg-education-dark text-white"
            disabled={isLoading}
          >
            {continueButtonText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReflectionComparison;
