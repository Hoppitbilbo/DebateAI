import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionDisplayCard from "@/components/shared/ReflectionDisplayCard";
import { Message } from "@/types/conversation";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface WikiInterviewFeedbackProps {
  userReflection: string | null; // Changed from reflection
  aiEvaluation: string | null;   // Changed from evaluation
  isLoading: boolean;
  onStartNewChat: () => void;
  messages: Message[];
  character1Name: string;
  character2Name: string;
  topic: string;
}

const WikiInterviewFeedback: React.FC<WikiInterviewFeedbackProps> = ({
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
        activityType: t('apps.wikiInterview.name'),
        characterName: `${character1Name} & ${character2Name}`,
        topic,
        conversation: messages,
        userReflection: userReflection || t('common.reflection.empty', { defaultValue: "No reflection provided." }),
        aiEvaluation: aiEvaluation || undefined,
      });
      toast.success(t('apps.doppiaIntervista.feedback.downloadSuccess'));
    } catch (error) {
      console.error("Error downloading reflection:", error);
      toast.error(t('apps.doppiaIntervista.feedback.downloadError'));
    }
  };

  return (
    <Card className="shadow-lg max-w-3xl mx-auto bg-gray-800 border-gray-700 text-white">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-education-light">{t('feedback.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Conversation History Section */}
        <div className="border rounded-lg p-4 border-gray-700 bg-gray-700/50">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={toggleConversation}
          >
            <h3 className="text-xl font-semibold text-education-lighter">{t('feedback.conversationHistory', { defaultValue: 'Conversation History' })}</h3>
            <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white">
              {isConversationExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>

          {isConversationExpanded && (
            <div className="mt-4 max-h-96 overflow-y-auto pr-2">
              {messages.map((message, index) => (
                <div key={index} className={`mb-4 p-3 rounded-lg ${message.role === 'user' ? 'bg-gray-600 ml-auto w-fit max-w-[80%]' : 'bg-education/20 mr-auto w-fit max-w-[80%]'}`}>
                  <p className="font-semibold mb-1 text-education-lighter">
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
            contentClassName="prose dark:prose-invert max-w-none whitespace-pre-wrap text-white bg-gray-700/50 p-4 rounded-md [&_*]:text-white [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_h4]:text-white [&_h5]:text-white [&_h6]:text-white [&_p]:text-white [&_li]:text-white [&_strong]:text-white [&_em]:text-white"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center pt-4">
          <Button
            variant="outline"
            onClick={handleDownload}
            className="w-full sm:w-auto flex items-center text-education-lighter border-education-light hover:bg-education-light hover:text-gray-900"
            disabled={isLoading}
          >
            <Download className="mr-2 h-4 w-4" /> {t('apps.doppiaIntervista.feedback.downloadReflection', { defaultValue: 'Download Reflection' })}
          </Button>
          <Button
            onClick={onStartNewChat}
            className="w-full sm:w-auto bg-education hover:bg-education-dark text-white flex items-center"
            disabled={isLoading}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> {t('apps.wikiInterview.setup.startButton', { defaultValue: 'Start New Dialogue' })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WikiInterviewFeedback;
