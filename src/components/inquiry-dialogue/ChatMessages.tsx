import { useRef, useEffect } from "react";
import { Message } from "./types";

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatMessages = ({ messages, isLoading }: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`chat-bubble ${
            message.role === "character1" ? "chat-bubble-character1" : 
            message.role === "character2" ? "chat-bubble-character2" : 
            message.role === "user" ? "chat-bubble-user" :
            "chat-bubble-system"
          }`}
        >
          <strong>{message.character}: </strong>
          <p>{message.content}</p>
        </div>
      ))}
      {isLoading && (
        <div className="chat-bubble chat-bubble-system">
          <div className="typing-animation">
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;