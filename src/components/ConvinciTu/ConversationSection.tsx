
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send } from "lucide-react";
import { Message } from "@/types/conversation";
import { useTranslation } from "react-i18next";
import MarkdownViewer from "@/components/shared/MarkdownViewer";

interface ConversationSectionProps {
  selectedCharacter: { title: string } | null;
  persuasionTopic: string;
  conversation: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onEndActivity: () => void;
}

const ConversationSection = ({
  selectedCharacter,
  persuasionTopic,
  conversation,
  isLoading,
  onSendMessage,
  onEndActivity,
}: ConversationSectionProps) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="bg-purple-50 dark:bg-gray-800 p-4 rounded-lg">
          <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
            {t('apps.convinciTu.chat.currentPromptLabel')}
          </p>
          <p className="text-gray-700 dark:text-gray-300 mt-1">
            {t('apps.convinciTu.chat.promptValue', { characterName: selectedCharacter?.title, topic: persuasionTopic })}
          </p>
        </div>

        <div className="space-y-4 mt-6">
          {conversation.length === 0 ? (
            <div className="flex items-center space-x-2 text-sm text-education">
              <MessageSquare className="h-4 w-4" />
              <span>{t('common.startConversation')}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {conversation.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    msg.role === "user"
                      ? "bg-blue-100 dark:bg-blue-900 ml-6"
                      : "bg-gray-100 dark:bg-gray-700 mr-6"
                  }`}
                >
                  <p className={`text-sm font-medium mb-1 ${msg.role === 'user' ? 'text-blue-800 dark:text-blue-200' : 'text-gray-800 dark:text-gray-200'}`}>
                    {msg.role === "user" ? t('common.you') : selectedCharacter?.title}
                  </p>
                  {msg.role === "user" ? (
                    <p className="text-gray-700 dark:text-gray-300">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="text-gray-700 dark:text-gray-300">
                      <MarkdownViewer content={msg.content} className="text-sm" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="bg-gray-100 dark:bg-gray-700 mr-6 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">
                    {selectedCharacter?.title}
                  </p>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-150"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-300"></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-end space-x-4">
          <div className="flex-grow">
            <Textarea
              placeholder={t('apps.convinciTu.chat.placeholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
              disabled={isLoading}
            />
          </div>
          <Button 
            className="bg-education hover:bg-education-dark"
            size="icon"
            onClick={handleSendMessage}
            disabled={isLoading || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {conversation.length > 0 && (
          <div className="pt-4 border-t">
            <Button 
              onClick={onEndActivity}
              className="w-full bg-education hover:bg-education-dark"
            >
              {t('common.endAndReflect')}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ConversationSection;
