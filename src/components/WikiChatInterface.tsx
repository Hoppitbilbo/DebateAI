/**
 * @file Manages the state and flow of the "WikiChat" educational game.
 * @remarks This component orchestrates the different phases of the game: chatting with the AI
 * embodiment of a Wikipedia page, user reflection, and AI-driven feedback.
 */

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Message, ActivityPhase } from "@/types/conversation";
import { ConversationData, getAIGameAndReflectionEvaluation } from "@/utils/evaluationUtils";
import { WikiChatMessage } from "./WikiChatbot/types";
import { ChatSession } from "@google/generative-ai";
import AppLayout from "./shared/AppLayout";
import ChatInterface from "./shared/ChatInterface";
import ReflectionInterface from "./shared/ReflectionInterface";
import FeedbackInterface from "./shared/FeedbackInterface";
import { useTranslation } from "react-i18next";
import { startChat, isAiServiceAvailable } from "@/services/aiService";

/**
 * @interface WikiChatInterfaceProps
 * @description Defines the props for the WikiChatInterface component.
 * @property {string} wikiTitle - The title of the Wikipedia page for the chat.
 * @property {string} wikiSummary - The summary of the Wikipedia page to be used as context.
 * @property {() => void} [onSessionComplete] - Optional callback triggered when a new session is started.
 */
interface WikiChatInterfaceProps {
  wikiTitle: string;
  wikiSummary: string;
  onSessionComplete?: () => void;
}

/**
 * @function WikiChatInterface
 * @description The main component for the "WikiChat" game. It controls the game's state,
 * transitioning between chatting, reflection, and feedback phases.
 * @param {WikiChatInterfaceProps} props - The props for the component.
 * @returns {JSX.Element} The rendered game interface.
 */
const WikiChatInterface = ({ wikiTitle, wikiSummary, onSessionComplete }: WikiChatInterfaceProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<WikiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<ChatSession | null>(null);
  
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    const systemPrompt = `${t('apps.wikiChat.systemPrompt', {
      defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
    })}

${wikiSummary}`;
    
    if (!isAiServiceAvailable()) {
      console.error("AI Service is not available. Please check your API key configuration.");
      setMessages([
        { role: "assistant", content: "⚠️ AI Service is not available. Please configure your Google Gemini API key in the .env file." }
      ]);
      return;
    }

    try {
      const initialChat = startChat(
        [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Okay, I am ready to act as the Wikipedia page for " + wikiTitle + "." }] }
        ],
        systemPrompt
      );
      setChat(initialChat);

      setMessages([
        { role: "assistant", content: t('apps.wikiChat.welcome', { title: wikiTitle, defaultValue: `Benvenuto! Sono ${wikiTitle}. Cosa vorresti sapere?` }) }
      ]);
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setMessages([
        { role: "assistant", content: `Sorry, I couldn't initialize the chat: ${errorMessage}` }
      ]);
    }
  }, [wikiTitle, wikiSummary, t]);

  /**
   * @function handleSendMessage
   * @description Sends the user's message to the AI and updates the chat history.
   * @param {string} message - The message to send.
   */
  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !chat) return;
    
    setMessages(prev => [...prev, { role: "user", content: message }]);
    setIsLoading(true);
    
    try {
      const result = await chat.sendMessage(message);
      const response = await result.response;
      const text = response.text();

      setMessages(prev => [...prev, { role: "assistant", content: text }]);
    } catch (error) {
      console.error("Error generating response:", error);
      toast.error(t('errors.aiCommunication', { defaultValue: "Si è verificato un errore durante la comunicazione con l'assistente AI." }));
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function handleEndChat
   * @description Transitions the activity to the reflection phase.
   */
  const handleEndChat = () => {
    setActivityPhase("reflection");
  };

  /**
   * @function handleReflectionSubmit
   * @description Submits the user's reflection and triggers the AI evaluation process.
   * @param {string} reflection - The user's written reflection.
   */
  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);

    try {
      const conversationData: ConversationData = {
        character: wikiTitle,
        topic: wikiTitle,
        messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        })),
      };

      const evaluationResult = await getAIGameAndReflectionEvaluation(conversationData, reflection);
      setAiEvaluation(evaluationResult.textualFeedback);
      
    } catch (error) {
      console.error("Error generating evaluation:", error);
      toast.error(t('errors.evaluationGeneration', { defaultValue: "Errore nella generazione della valutazione. Riprova più tardi." }));
      setAiEvaluation(t('errors.evaluationGeneration', { defaultValue: "Errore nella generazione della valutazione. Riprova più tardi." }));
    } finally {
       setIsEvaluating(false);
    }
  };
  
  /**
   * @function handleStartNewChat
   * @description Resets the component state to start a new chat session.
   */
  const handleStartNewChat = () => {
    if (!isAiServiceAvailable()) {
      console.error("AI Service is not available. Please check your API key configuration.");
      return;
    }

    const systemPrompt = `${t('apps.wikiChat.systemPrompt', {
      defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
    })}\n\n${wikiSummary}`;
    
    try {
      const newChat = startChat(
        [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "model", parts: [{ text: "Okay, I am ready to act as the Wikipedia page for " + wikiTitle + "." }] }
        ],
        systemPrompt
      );
      
      setChat(newChat);
      setMessages([
        { role: "assistant", content: t('apps.wikiChat.welcome', { title: wikiTitle, defaultValue: `Benvenuto! Sono ${wikiTitle}. Cosa vorresti sapere?` }) }
      ]);
      setActivityPhase("chatting");
      setUserReflection("");
      setAiEvaluation(null);
      setIsLoading(false);
      setIsEvaluating(false);
      
      toast.success(t('apps.wikiChat.newConversation', { defaultValue: "Nuova conversazione iniziata!" }));
      onSessionComplete?.();
    } catch (error) {
      console.error("Failed to start new chat:", error);
      toast.error(t('apps.wikiChat.errorStartingChat', { defaultValue: "Failed to start a new chat. Please try again." }));
    }
  };

  return (
    <AppLayout
      title={t('apps.wikiChat.title', { title: wikiTitle, defaultValue: `Chat con ${wikiTitle}` })}
      subtitle={t('apps.wikiChat.subtitle', { defaultValue: "Conversa con una pagina di Wikipedia che prende vita" })}
      onReset={handleStartNewChat}
    >
      {activityPhase === "chatting" && (
        <ChatInterface
          messages={messages.map((msg): Message => ({ role: msg.role, content: msg.content }))}
          input={input}
          onInputChange={setInput}
          onSendMessage={() => { if (input.trim()) { handleSendMessage(input); setInput(''); } }}
          isLoading={isLoading}
          onEndActivity={handleEndChat}
          placeholder={t('apps.wikiChat.placeholder', { title: wikiTitle, defaultValue: `Fai una domanda a ${wikiTitle}...` })}
        />
      )}

      {activityPhase === "reflection" && (
        <ReflectionInterface
          onSubmit={handleReflectionSubmit}
          title={t('apps.wikiChat.reflection.title', { defaultValue: 'Riflessione sulla Chat di Wikipedia' })}
          description={t('apps.wikiChat.reflection.description', { defaultValue: 'Rifletti su ciò che hai imparato durante la conversazione.' })}
          placeholder={t('apps.wikiChat.reflection.placeholder', { defaultValue: 'Cosa hai scoperto? Cosa ti ha sorpreso? Quali dubbi hai ancora?' })}
          characterName={wikiTitle}
        />
      )}

      {activityPhase === "feedback" && (
        <FeedbackInterface
          userReflection={userReflection}
          aiEvaluation={aiEvaluation}
          isLoading={isEvaluating}
          onStartNewChat={handleStartNewChat}
          messages={messages.map((msg): Message => ({ role: msg.role, content: msg.content }))}
          characterName={wikiTitle}
          topic={wikiTitle}
        />
      )}
    </AppLayout>
  );
};

export default WikiChatInterface;
