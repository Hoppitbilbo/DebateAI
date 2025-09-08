/**
 * @file Provides a generic, reusable chat interface component.
 * @remarks This component is used across various educational activities to provide a consistent
 * chat experience. It handles message display, user input, loading states, and an optional
 * "end activity" button.
 */

import React, { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, BookOpen, Bot, User } from 'lucide-react';
import { Message } from '@/types/conversation';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * @interface ChatInterfaceProps
 * @description Defines the props for the ChatInterface component.
 * @property {Message[]} messages - An array of message objects to be displayed.
 * @property {string} input - The current value of the text input field.
 * @property {(value: string) => void} onInputChange - Callback function to handle changes to the input field.
 * @property {() => void} onSendMessage - Callback function to handle sending a message.
 * @property {() => void} [onEndActivity] - Optional callback to end the chat and proceed to the next phase.
 * @property {boolean} [isLoading=false] - Flag to indicate if a response is being loaded.
 * @property {string} [placeholder] - Optional placeholder text for the input field.
 * @property {string} [userCharacterName] - Optional name to display for the user's messages.
 * @property {string} [aiCharacterName] - Optional name to display for the AI's messages.
 * @property {boolean} [showEndButton=true] - Whether to show the "End and Reflect" button.
 * @property {number} [minMessagesForEnd=4] - The minimum number of user messages required to enable the end button.
 * @property {string} [className] - Optional additional CSS classes for the component's root element.
 */
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

/**
 * @function ChatInterface
 * @description A reusable chat UI component that provides a message display area, a text input with a send button,
 * and an optional button to conclude the activity.
 * @param {ChatInterfaceProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chat interface.
 */
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

  /**
   * @function scrollToBottom
   * @description Automatically scrolls the message area to the bottom to show the latest message.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  /**
   * @function handleKeyPress
   * @description Handles the key press event on the input to send a message on "Enter".
   * @param {React.KeyboardEvent} e - The keyboard event.
   */
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
