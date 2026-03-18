import { useCallback, useMemo, useState } from "react";
import { ChatSession, Part } from "@google/generative-ai";
import { aiFacade } from "@/services/aiFacade";

interface StartSessionParams {
  history?: { role: "user" | "model"; parts: Part[] }[];
  systemInstructionText?: string;
}

export const useAiChatSession = () => {
  const [chat, setChat] = useState<ChatSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback((params: StartSessionParams = {}) => {
    try {
      setError(null);
      const nextChat = aiFacade.text.startChat(params);
      setChat(nextChat);
      return nextChat;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start AI chat session.";
      setError(message);
      throw err;
    }
  }, []);

  const send = useCallback(async (message: string, currentChat?: ChatSession | null) => {
    const targetChat = currentChat ?? chat;
    if (!targetChat) {
      const sessionError = "AI chat session is not initialized.";
      setError(sessionError);
      throw new Error(sessionError);
    }

    setIsLoading(true);
    setError(null);
    try {
      return await aiFacade.text.sendMessage(targetChat, message);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Failed to send message to AI.";
      setError(messageText);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [chat]);

  const resetSession = useCallback(() => {
    setChat(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return useMemo(() => ({
    chat,
    isLoading,
    error,
    startSession,
    send,
    resetSession,
  }), [chat, error, isLoading, resetSession, send, startSession]);
};
