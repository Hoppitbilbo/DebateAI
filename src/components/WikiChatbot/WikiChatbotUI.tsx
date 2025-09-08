/**
 * @file Renders the user interface for the WikiChatbot.
 * @remarks This component displays the chat messages, handles user input, and shows loading states.
 * It is a presentational component that receives its state and handlers as props.
 */

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, BookOpen } from "lucide-react";

/**
 * @interface ChatMessage
 * @description Represents a single message in the chat.
 * @property {"user" | "assistant" | "system"} role - The role of the message sender.
 * @property {string} content - The text content of the message.
 */
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * @interface WikiChatbotUIProps
 * @description Defines the props for the WikiChatbotUI component.
 * @property {ChatMessage[]} messages - The array of messages to display in the chat.
 * @property {string} input - The current value of the input field.
 * @property {(input: string) => void} setInput - The function to update the input field's value.
 * @property {boolean} isLoading - A flag indicating if the AI is currently generating a response.
 * @property {(e: React.FormEvent) => void} handleSubmit - The function to handle form submission.
 * @property {() => void} handleEndChat - The function to end the chat and proceed to reflection.
 */
interface WikiChatbotUIProps {
  messages: ChatMessage[];
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  handleEndChat: () => void;
}

/**
 * @function WikiChatbotUI
 * @description The main UI component for the WikiChatbot. It renders the chat history,
 * input form, and controls for sending messages and ending the chat.
 * @param {WikiChatbotUIProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chat interface.
 */
const WikiChatbotUI = ({
  messages,
  input,
  setInput,
  isLoading,
  handleSubmit,
  handleEndChat
}: WikiChatbotUIProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /**
   * @function scrollToBottom
   * @description Scrolls the chat container to the latest message.
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Card className="flex flex-col w-full h-[700px] rounded-lg overflow-hidden shadow-lg border">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.filter(m => m.role !== "system").map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-education text-white"
                  : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 flex flex-col gap-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={isLoading || !input.trim()} 
            className="bg-education hover:bg-education-dark"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        
        <Button 
          variant="outline" 
          onClick={handleEndChat}
          disabled={isLoading || messages.length < 4}
          className="w-full mt-2"
        >
          <BookOpen className="mr-2 h-4 w-4" /> Concludi e Rifletti
        </Button>
      </div>
    </Card>
  );
};

export default WikiChatbotUI;