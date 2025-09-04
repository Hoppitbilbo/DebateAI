
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

interface WikiChatInterfaceProps {
  wikiTitle: string;
  wikiSummary: string;
  onSessionComplete?: () => void;
}

// Define an interface for session data that matches expected structure
interface SessionData {
  characterName: string;
  messages: Message[];
  topic?: string;
}

import { model } from "@/services/aiService";


const WikiChatInterface = ({ wikiTitle, wikiSummary, onSessionComplete }: WikiChatInterfaceProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<WikiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chat, setChat] = useState<ChatSession | null>(null);
  
  // States for reflection phase
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Initialize chat with system prompt
  useEffect(() => {
    const systemPrompt = `${t('apps.wikiChat.systemPrompt', {
      defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
    })}

${wikiSummary}`;
    
    const initialChat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Okay, I am ready to act as the Wikipedia page for " + wikiTitle + "."}],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000, // Adjust as needed
      },
    });
    setChat(initialChat);

    setMessages([
      { role: "assistant", content: t('apps.wikiChat.welcome', { title: wikiTitle, defaultValue: `Benvenuto! Sono ${wikiTitle}. Cosa vorresti sapere?` }) }
    ]);
  }, [wikiTitle, wikiSummary, t]);

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

  const handleEndChat = () => {
    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);

    try {
      // Prepare data for evaluation
      const conversationData: ConversationData = {
        character: wikiTitle,
        topic: wikiTitle, // Or a more specific topic if available
        messages: messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        })),
      };

      // Call the AI evaluation function
      const evaluationResult = await getAIGameAndReflectionEvaluation(conversationData, reflection);
      
      // Assicuriamoci che il feedback testuale sia correttamente estratto
      console.log("Evaluation result:", evaluationResult);
      
      // Update state with the evaluation result.
      // getAIGameAndReflectionEvaluation now ensures evaluationResult.textualFeedback is always a
      // complete Markdown string (either AI's text or a fallback with scores/rationales).
      setAiEvaluation(evaluationResult.textualFeedback);
      
    } catch (error) {
      console.error("Error generating evaluation:", error);
      toast.error(t('errors.evaluationGeneration', { defaultValue: "Errore nella generazione della valutazione. Riprova più tardi." }));
      setAiEvaluation(t('errors.evaluationGeneration', { defaultValue: "Errore nella generazione della valutazione. Riprova più tardi." }));
    } finally {
       setIsEvaluating(false);
    }
  };
  
  const handleStartNewChat = () => {
    const systemPrompt = `${t('apps.wikiChat.systemPrompt', {
      defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
    })}

${wikiSummary}`;
    
    const newChat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [{ text: "Okay, I am ready to act as the Wikipedia page for " + wikiTitle + "."}],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000, // Adjust as needed
      },
    });
    setChat(newChat);

    setMessages([
      { role: "assistant", content: t('apps.wikiChat.welcome', { title: wikiTitle, defaultValue: `Benvenuto! Sono ${wikiTitle}. Cosa vorresti sapere?` }) }
    ]);
    setActivityPhase("chatting");
    setUserReflection("");
    setAiEvaluation(null);
    setIsLoading(false); // Reset chat loading state
    setIsEvaluating(false);
    
    toast.success(t('apps.wikiChat.newConversation', { defaultValue: "Nuova conversazione iniziata!" }));
    onSessionComplete?.(); // Notify parent that the session is complete
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
