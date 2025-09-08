/**
 * @file Renders the feedback screen for the "Doppia Intervista" (Double Interview) game.
 * @remarks This component displays the user's reflection, the AI's evaluation of their performance,
 * and the complete conversation history. It also allows the user to download the activity summary
 * or start a new interview.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionDisplayCard from "@/components/shared/ReflectionDisplayCard";
import { Message as EvaluationMessage } from "@/types/conversation";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * @interface DoppiaIntervistaFeedbackProps
 * @description Defines the props for the DoppiaIntervistaFeedback component.
 * @property {string} userReflection - The reflection text submitted by the user.
 * @property {string | null} aiEvaluation - The AI-generated feedback on the user's interview.
 * @property {boolean} isLoading - Flag indicating if the AI evaluation is being generated.
 * @property {() => void} onStartNewChat - Callback function to initiate a new interview session.
 * @property {EvaluationMessage[]} messages - The history of the conversation.
 * @property {string} character1Name - The name of the first character in the interview.
 * @property {string} character2Name - The name of the second character in the interview.
 * @property {string} topic - The topic of the interview.
 */
interface DoppiaIntervistaFeedbackProps {
  userReflection: string;
  aiEvaluation: string | null;
  isLoading: boolean;
  onStartNewChat: () => void;
  messages: EvaluationMessage[];
  character1Name: string;
  character2Name:string;
  topic: string;
}

/**
 * @function DoppiaIntervistaFeedback
 * @description A component that presents the final feedback for the "Doppia Intervista" activity.
 * It shows the user's reflection, AI feedback, and a collapsible conversation history.
 * @param {DoppiaIntervistaFeedbackProps} props - The props for the component.
 * @returns {JSX.Element} The rendered feedback screen.
 */
const DoppiaIntervistaFeedback: React.FC<DoppiaIntervistaFeedbackProps> = ({
  userReflection,
  aiEvaluation,
  isLoading,
  onStartNewChat,
  messages,
  character1Name,
  character2Name,
  topic,
}) => {
  const { t } = useTranslation();
  const [isConversationExpanded, setIsConversationExpanded] = useState(true);

  /**
   * @function toggleConversation
   * @description Toggles the visibility of the conversation history section.
   */
  const toggleConversation = () => {
    setIsConversationExpanded(!isConversationExpanded);
  };

  /**
   * @function handleDownload
   * @description Handles the download of the activity summary, including the conversation and reflections.
   * Displays a toast notification on success or failure.
   */
  const handleDownload = () => {
    try {
      downloadReflection({
        activityType: t('apps.doppiaIntervista.feedback.activityName'),
        characterName: `${character1Name} & ${character2Name}`, 
        topic,
        conversation: messages,
        userReflection,
        aiEvaluation: aiEvaluation || undefined,
      });
      toast.success(t('apps.doppiaIntervista.feedback.downloadSuccess'));
    } catch (error) {
      console.error("Error downloading reflection:", error);
      toast.error(t('apps.doppiaIntervista.feedback.downloadError'));
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-education-light">{t('apps.doppiaIntervista.feedback.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversation History Section */}
        <div className="border rounded-lg p-4">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={toggleConversation}
          >
            <h3 className="text-xl font-semibold">{t('apps.doppiaIntervista.feedback.conversationHistory')}</h3>
            <Button variant="ghost" size="sm">
              {isConversationExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>

          {isConversationExpanded && (
            <div className="mt-4 max-h-96 overflow-y-auto pr-2">
              {messages.map((message, index) => (
                <div key={index} className={`mb-4 p-3 rounded-lg ${message.role === 'user' ? 'bg-muted ml-auto w-fit max-w-[80%]' : 'bg-primary/10 mr-auto w-fit max-w-[80%]'}`}>
                  <p className="font-semibold mb-1">
                    {message.role === 'user' ? t('apps.doppiaIntervista.feedback.userLabel') : (message.characterName || 'AI')}
                  </p>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reflection and Evaluation Section */}
        <div className="space-y-4">
          <ReflectionDisplayCard
            title={t('apps.doppiaIntervista.feedback.yourReflection')}
            content={userReflection}
            contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap dark:text-gray-100"
          />
          <ReflectionDisplayCard
            title={t('apps.doppiaIntervista.feedback.aiFeedback')}
            content={aiEvaluation}
            isLoading={isLoading}
            renderAsHtml={true}
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="w-full sm:w-auto flex items-center"
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" /> {t('apps.doppiaIntervista.feedback.downloadButton')}
          </Button>
          <Button
            onClick={onStartNewChat}
            className="w-full sm:w-auto bg-education hover:bg-education-dark text-white flex items-center"
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> {t('apps.doppiaIntervista.feedback.newInterviewButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DoppiaIntervistaFeedback;
