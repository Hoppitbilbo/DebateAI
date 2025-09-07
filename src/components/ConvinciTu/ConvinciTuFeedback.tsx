/**
 * @file Renders the feedback screen for the "ConvinciTu" game.
 * @remarks This component displays the user's reflection, the AI's evaluation, and the full conversation history.
 * It also provides options to download the reflection or start a new chat.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionDisplayCard from "@/components/shared/ReflectionDisplayCard";
import { Message } from "@/types/conversation";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

/**
 * @interface ConvinciTuFeedbackProps
 * @description Defines the props for the ConvinciTuFeedback component.
 * @property {string} userReflection - The reflection text written by the user.
 * @property {string | null} aiEvaluation - The AI-generated feedback on the user's performance.
 * @property {boolean} isLoading - A flag indicating if the AI evaluation is still being generated.
 * @property {() => void} onStartNewChat - Callback function to begin a new game session.
 * @property {Message[]} messages - The complete conversation history.
 * @property {string} characterName - The name of the character the user interacted with.
 * @property {string} topic - The persuasion topic for the completed activity.
 */
interface ConvinciTuFeedbackProps {
  userReflection: string;
  aiEvaluation: string | null;
  isLoading: boolean;
  onStartNewChat: () => void;
  messages: Message[];
  characterName: string;
  topic: string;
}

/**
 * @function ConvinciTuFeedback
 * @description A component that presents the final feedback for the "ConvinciTu" activity.
 * It includes the user's reflection, AI-generated feedback, and a collapsible view of the conversation.
 * Users can download their activity summary or start a new session.
 * @param {ConvinciTuFeedbackProps} props - The props for the component.
 * @returns {JSX.Element} The rendered feedback screen.
 */
const ConvinciTuFeedback: React.FC<ConvinciTuFeedbackProps> = ({
  userReflection,
  aiEvaluation,
  isLoading,
  onStartNewChat,
  messages,
  characterName,
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
   * @description Handles the download of the reflection and conversation history.
   * It formats the data and uses a utility function to create and download a file.
   * Displays a success or error toast notification.
   */
  const handleDownload = () => {
    try {
      downloadReflection({
        activityType: t('apps.convinciTu.name'),
        characterName,
        topic,
        conversation: messages,
        userReflection,
        aiEvaluation: aiEvaluation || undefined,
      });
      toast.success(t('apps.convinciTu.feedback.downloadSuccess'));
    } catch (error) {
      console.error("Error downloading reflection:", error);
      toast.error(t('apps.convinciTu.feedback.downloadError'));
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-education-light">{t('apps.convinciTu.feedback.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversation History Section */}
        <div className="border rounded-lg p-4">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={toggleConversation}
          >
            <h3 className="text-xl font-semibold">{t('apps.convinciTu.feedback.conversationHistory')}</h3>
            <Button variant="ghost" size="sm">
              {isConversationExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>

          {isConversationExpanded && (
            <div className="mt-4 max-h-96 overflow-y-auto pr-2">
              {messages.map((message, index) => (
                <div key={index} className={`mb-4 p-3 rounded-lg ${message.role === 'user' ? 'bg-muted ml-8' : 'bg-primary/10 mr-8'}`}>
                  <p className="font-semibold mb-1">
                    {message.role === 'user' ? t('common.you') : (message.characterName || 'AI')}
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
            title={t('apps.convinciTu.feedback.yourReflection')}
            content={userReflection}
            contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap dark:text-gray-100"
          />
          <ReflectionDisplayCard
            title={t('apps.convinciTu.feedback.aiFeedback')}
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
            <Download className="mr-2 h-4 w-4" /> {t('apps.convinciTu.feedback.downloadReflection')}
          </Button>
          <Button
            onClick={onStartNewChat}
            className="w-full sm:w-auto bg-education hover:bg-education-dark text-white flex items-center"
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> {t('apps.convinciTu.feedback.startNewChat')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConvinciTuFeedback;
