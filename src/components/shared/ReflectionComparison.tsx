/**
 * @file A component that displays a side-by-side comparison of a user's reflection and AI-generated feedback.
 * @remarks This component is used in the feedback phase of various activities to help users compare their
 * self-assessment with the AI's evaluation. It also includes actions to download the reflection or continue.
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { Message } from "@/types/conversation";
import { toast } from "sonner";
import ReflectionDisplayCard from "./ReflectionDisplayCard";

/**
 * @interface ReflectionComparisonProps
 * @description Defines the props for the ReflectionComparison component.
 * @property {string} userReflection - The user's written reflection.
 * @property {string | null} aiEvaluation - The AI-generated evaluation.
 * @property {boolean} isLoading - Flag to indicate if the AI evaluation is being generated.
 * @property {() => void} onContinue - Callback function to proceed to the next step or start a new activity.
 * @property {React.ReactNode} [continueButtonText] - Optional custom text or element for the continue button.
 * @property {string} [activityType] - The type of activity, used for the download file name.
 * @property {string} [characterName] - The name of the character involved, for the download.
 * @property {string} [topic] - The topic of the activity, for the download.
 * @property {Message[]} [conversation] - The conversation history, for the download.
 * @property {string} [className] - Optional additional CSS classes for the root element.
 * @property {boolean} [hideContinueButton] - If true, the continue button will not be rendered.
 */
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
  hideContinueButton?: boolean;
}

/**
 * @function ReflectionComparison
 * @description A component that displays the user's reflection and the AI's feedback in separate cards for easy comparison.
 * @param {ReflectionComparisonProps} props - The props for the component.
 * @returns {JSX.Element} The rendered reflection comparison view.
 */
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
  hideContinueButton = false,
}: ReflectionComparisonProps) => {
  
  /**
   * @function handleDownload
   * @description Triggers the download of the activity summary, including reflections and conversation.
   */
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
