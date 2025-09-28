import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionDisplayCard from "@/components/shared/ReflectionDisplayCard";
import { Message } from "@/types/conversation";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface InquiryDialogueFeedbackProps {
  userReflection: string | null; // Changed from reflection
  aiEvaluation: string | null;   // Changed from evaluation
  isLoading: boolean;
  onStartNewChat: () => void;
  messages: Message[];
  character1Name: string;
  character2Name: string;
  topic: string;
}

const InquiryDialogueFeedback: React.FC<InquiryDialogueFeedbackProps> = ({
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

  const toggleConversation = () => {
    setIsConversationExpanded(!isConversationExpanded);
  };

  const handleDownload = () => {
    try {
      downloadReflection({
        activityType: t('apps.inquiryDialogue.name'),
        characterName: `${character1Name} & ${character2Name}`,
        topic,
        conversation: messages,
        userReflection: userReflection || t('common.reflection.empty', { defaultValue: "No reflection provided." }),
        aiEvaluation: aiEvaluation || undefined,
      });
      toast.success(t('apps.inquiryDialogue.feedback.downloadSuccess'));
    } catch (error) {
      console.error("Error downloading reflection:", error);
      toast.error(t('apps.inquiryDialogue.feedback.downloadError'));
    }
  };

  return (
    <Card className="max-w-4xl mx-auto bg-gray-800 border-gray-700 text-white">
      <CardHeader className="bg-education text-white">
        <CardTitle className="text-2xl">{t('apps.inquiryDialogue.feedback.title')}</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Conversation Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-education-lighter">
              {t('apps.inquiryDialogue.feedback.conversationTitle')}
            </h3>
            <Button
              variant="ghost"
              onClick={toggleConversation}
              className="text-education-lighter hover:text-white hover:bg-education-light"
            >
              {isConversationExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isConversationExpanded ? t('common.collapse') : t('common.expand')}
            </Button>
          </div>
          {isConversationExpanded && (
            <div className="bg-gray-700/50 rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
              {messages.map((message, index) => (
                <div key={index} className="border-b border-gray-600 pb-2 last:border-b-0">
                  <p className="text-sm font-medium text-education-lighter mb-1">
                    {message.role === 'user' ? t('common.moderator', { defaultValue: 'Moderator (You)' }) : (message.characterName || t('common.system', { defaultValue: 'System' }))}
                  </p>
                  <p className="whitespace-pre-wrap text-gray-200">{message.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reflection and Evaluation Section */}
        <div className="space-y-4">
          <ReflectionDisplayCard
            title={t('feedback.yourReflection')}
            content={userReflection || t('common.reflection.empty', { defaultValue: "No reflection provided." })}
            contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap text-gray-200 bg-gray-700/50 p-4 rounded-md"
            isLoading={isLoading && !aiEvaluation} // Show loading only if AI eval is also loading
          />
          <ReflectionDisplayCard
            title={t('common.aiFeedback.title')}
            content={aiEvaluation}
            isLoading={isLoading}
            renderAsHtml={true} // Assuming AI eval is markdown
            contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap text-white bg-gray-700/50 p-4 rounded-md [&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_h5]:text-white [&_h6]:text-white [&_p]:text-white [&_li]:text-white [&_strong]:text-white [&_em]:text-white [&_code]:text-gray-300 [&_pre]:bg-gray-800 [&_blockquote]:border-l-education-light [&_a]:text-education-light [&_a:hover]:text-education-lighter"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="w-full sm:w-auto flex items-center text-education-lighter border-education-light hover:bg-education-light hover:text-gray-900"
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" /> {t('apps.inquiryDialogue.feedback.downloadReflection', { defaultValue: 'Download Reflection' })}
          </Button>
          <Button
            onClick={onStartNewChat}
            className="w-full sm:w-auto bg-education hover:bg-education-dark text-white flex items-center"
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> {t('apps.inquiryDialogue.setup.startButton', { defaultValue: 'Start New Dialogue' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default InquiryDialogueFeedback;