
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReflectionDisplayCard from "@/components/shared/ReflectionDisplayCard";
import { Message } from "@/types/conversation";
import { ChevronDown, ChevronUp, RefreshCcw, Download } from "lucide-react";
import { downloadReflection } from "@/utils/downloadUtils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface ConvinciTuFeedbackProps {
  userReflection: string;
  aiEvaluation: string | null;
  isLoading: boolean;
  onStartNewChat: () => void;
  messages: Message[];
  characterName: string;
  topic: string;
}

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

  const toggleConversation = () => {
    setIsConversationExpanded(!isConversationExpanded);
  };

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
