import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, BookOpen, Bot, User } from 'lucide-react';
import { Message } from '@/types/conversation';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatInterfaceProps {
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onEndActivity?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  userCharacterName?: string;
  aiCharacterName?: string;
  showEndButton?: boolean;
  minMessagesForEnd?: number;
  className?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  input,
  onInputChange,
  onSendMessage,
  onEndActivity,
  isLoading = false,
  placeholder,
  userCharacterName,
  aiCharacterName,
  showEndButton = true,
  minMessagesForEnd = 4,
  className = ''
}) => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const userMessageCount = messages.filter(m => m.role === 'user').length;
  const canEndActivity = userMessageCount >= minMessagesForEnd;

  return (
    <Card className={`flex flex-col h-[600px] bg-white/90 backdrop-blur-sm border-education/20 ${className}`}>
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex items-center justify-center h-full text-education-muted">
            <p>{t('common.startConversation')}</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={message.id || index}
            className={`flex items-end space-x-2 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role !== 'user' && (
              <Bot className="h-6 w-6 text-education flex-shrink-0 mb-1" />
            )}
            
            <div
              className={`max-w-[75%] rounded-lg px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'bg-education text-white'
                  : 'bg-gray-100 text-gray-900 border border-gray-200'
              }`}
            >
              <p className="text-xs font-semibold mb-1 opacity-80">
                {message.role === 'user' ? userCharacterName : (message.characterName || aiCharacterName)}
              </p>
              <ReactMarkdown
                className="prose prose-sm max-w-none"
                remarkPlugins={[remarkGfm]}
              >
                {message.content}
              </ReactMarkdown>
            </div>
            
            {message.role === 'user' && (
              <User className="h-6 w-6 text-education flex-shrink-0 mb-1" />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start items-end space-x-2">
            <Bot className="h-6 w-6 text-education flex-shrink-0 mb-1" />
            <div className="max-w-[75%] bg-gray-100 border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-education animate-bounce"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-education animate-bounce [animation-delay:0.1s]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-education animate-bounce [animation-delay:0.2s]"></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-education/20 p-4 bg-gray-50/50 space-y-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || t('common.writeMessage')}
            disabled={isLoading}
            className="flex-1 border-education/30 focus:border-education focus:ring-education/20"
          />
          <Button
            onClick={onSendMessage}
            disabled={isLoading || !input.trim()}
            className="bg-education hover:bg-education-dark text-white"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {showEndButton && onEndActivity && (
          <Button
            variant="outline"
            onClick={onEndActivity}
            disabled={isLoading || !canEndActivity}
            className="w-full border-education/30 text-education hover:bg-education/10 disabled:opacity-50"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            {t('common.endAndReflect')}
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ChatInterface;
