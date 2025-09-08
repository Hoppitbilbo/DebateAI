/**
 * @file Renders the main chat interface for the "Personaggio Misterioso" game.
 * @remarks This component handles the display of the conversation, user input for questions,
 * and visual feedback for loading states and remaining questions.
 */

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Message } from "./types";
import { useTranslation } from "react-i18next";

/**
 * @interface ChatInterfaceProps
 * @description Defines the props for the ChatInterface component.
 * @property {string} currentQuestion - The current text in the question input field.
 * @property {(value: string) => void} onQuestionChange - Callback for when the question input changes.
 * @property {() => void} onAskQuestion - Callback to submit the current question.
 * @property {number} questionsLeft - The number of questions the user has remaining.
 * @property {Message[]} conversation - The array of messages in the conversation history.
 * @property {boolean} showChat - Whether the chat history is currently visible.
 * @property {() => void} onToggleChat - Callback to toggle the visibility of the chat history.
 * @property {boolean} [isResponding] - Optional flag to indicate if the AI is currently generating a response.
 */
interface ChatInterfaceProps {
  currentQuestion: string;
  onQuestionChange: (value: string) => void;
  onAskQuestion: () => void;
  questionsLeft: number;
  conversation: Message[];
  showChat: boolean;
  onToggleChat: () => void;
  isResponding?: boolean;
}

/**
 * @function ChatInterface
 * @description The user interface for the conversation part of the "Personaggio Misterioso" game.
 * It includes the conversation display, a textarea for user questions, and a send button.
 * @param {ChatInterfaceProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chat interface.
 */
const ChatInterface = ({
  currentQuestion,
  onQuestionChange,
  onAskQuestion,
  questionsLeft,
  conversation,
  showChat,
  onToggleChat,
  isResponding,
}: ChatInterfaceProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-education-dark">
          {t('apps.personaggioMisterioso.chat.title', { defaultValue: 'Conversazione' })}
        </h3>
        <Button variant="ghost" size="icon" onClick={onToggleChat}>
          {showChat ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </Button>
      </div>

      {showChat && (
        <div className={`space-y-4 ${conversation.length > 0 ? 'max-h-[400px] overflow-y-auto' : ''} pr-2`}>
          {conversation.length === 0 && !isResponding && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              {t('apps.personaggioMisterioso.chat.empty', { defaultValue: 'La conversazione apparirà qui.' })}
            </p>
          )}
          {conversation.map((msg, index) => (
            <div
              key={index}
              className={`p-3 rounded-lg flex flex-col ${
                msg.role === "user"
                  ? "bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]"
                  : "bg-gray-100 dark:bg-gray-700 mr-auto max-w-[80%]"
              }`}
            >
              <div className={`text-sm ${msg.role === "user" ? "text-right" : "text-left"} text-gray-700 dark:text-gray-300 markdown-content`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {isResponding && (
            <div className="flex items-center justify-start mr-auto max-w-[80%]">
              <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500 dark:text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('apps.personaggioMisterioso.chat.thinking', { defaultValue: 'Il personaggio sta pensando...' })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-end space-x-2 md:space-x-4">
        <div className="flex-grow">
          <Textarea
            placeholder={
              questionsLeft > 0
                ? t('apps.personaggioMisterioso.chat.placeholder', { defaultValue: 'Scrivi la tua domanda...' })
                : t('apps.personaggioMisterioso.chat.noMoreQuestions', { defaultValue: 'Non hai più domande.' })
            }
            value={currentQuestion}
            onChange={(e) => onQuestionChange(e.target.value)}
            disabled={questionsLeft === 0 || isResponding}
            className="min-h-[80px] md:min-h-[100px] resize-none"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && questionsLeft > 0 && currentQuestion.trim() && !isResponding) {
                e.preventDefault();
                onAskQuestion();
              }
            }}
          />
        </div>
        <Button 
          className="bg-education hover:bg-education-dark shrink-0"
          size="lg"
          onClick={onAskQuestion}
          disabled={questionsLeft === 0 || !currentQuestion.trim() || isResponding}
        >
          {isResponding ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <ArrowUp className="h-5 w-5" />
          )}
          <span className="sr-only">
            {t('apps.personaggioMisterioso.chat.send', { defaultValue: 'Invia domanda' })}
          </span>
        </Button>
      </div>
       <p className="text-sm text-muted-foreground text-center">
        {t('apps.personaggioMisterioso.chat.questionsLeft', { defaultValue: 'Domande rimaste: {{count}}', count: questionsLeft })}
      </p>
    </div>
  );
};

export default ChatInterface;
