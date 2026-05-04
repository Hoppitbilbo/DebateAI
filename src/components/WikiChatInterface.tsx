import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Message, ActivityPhase } from "@/types/conversation";
import { ConversationData, getAIGameAndReflectionEvaluation } from "@/utils/evaluationUtils";
import { WikiChatMessage } from "./WikiChatbot/types";
import AppLayout from "./shared/AppLayout";
import ChatInterface from "./shared/ChatInterface";
import ReflectionInterface from "./shared/ReflectionInterface";
import FeedbackInterface from "./shared/FeedbackInterface";
import { useTranslation } from "react-i18next";
import { aiFacade } from "@/services/aiFacade";
import { useAiChatSession } from "@/hooks/useAiChatSession";
import { Button } from "@/components/ui/button";
import { useLiveAi } from "@/hooks/useLiveAi";

interface WikiChatInterfaceProps {
  wikiTitle: string;
  wikiSummary: string;
  onSessionComplete?: () => void;
}

const WikiChatInterface = ({ wikiTitle, wikiSummary, onSessionComplete }: WikiChatInterfaceProps) => {
  const { t, i18n } = useTranslation();
  const { chat, startSession, send, isLoading, resetSession } = useAiChatSession();
  const [messages, setMessages] = useState<WikiChatMessage[]>([]);
  const [input, setInput] = useState("");
  
  // States for reflection phase
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const handleLiveTextReceived = useCallback((text: string, isStreaming: boolean) => {
    setMessages((prev) => {
      if (isStreaming && prev[prev.length - 1]?.role === "assistant") {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, content: `${last.content}${text}` };
        return updated;
      }
      return [...prev, { role: "assistant", content: text }];
    });
  }, []);

  const handleUserTranscriptionReceived = useCallback((text: string, isFinal: boolean) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];

      if (last?.role === "user") {
        updated[updated.length - 1] = { ...last, content: text };
        return updated;
      } else {
        return [...updated, { role: "user", content: text }];
      }
    });
  }, []);

  const buildSystemPrompt = useCallback(() => `${t('apps.wikiChat.systemPrompt', {
    defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
  })}\n\n${wikiSummary}`,
  [t, wikiSummary]);

  const { isLiveMode, setIsLiveMode, isLiveAvailable, sendLiveMessage, resetLiveSession } = useLiveAi({
    onTextReceived: handleLiveTextReceived,
    onUserTranscription: handleUserTranscriptionReceived,
    systemInstruction: buildSystemPrompt(),
    characterName: wikiTitle,
    characterBio: wikiSummary,
  });

  const initializeWikiChat = useCallback(() => {
    if (!aiFacade.text.isAvailable()) {
      console.error("AI Service is not available. Please check your API key configuration.");
      setMessages([
        { role: "assistant", content: "⚠️ AI Service is not available. Please configure your Google Gemini API key in the .env file." }
      ]);
      return null;
    }

    const systemPrompt = buildSystemPrompt();
    const nextChat = startSession({
      history: [
        {
          role: "user" as const,
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model" as const,
          parts: [{ text: "Okay, I am ready to act as the Wikipedia page for " + wikiTitle + "." }],
        }
      ],
      systemInstructionText: systemPrompt,
    });

    setMessages([
      { role: "assistant", content: t('apps.wikiChat.welcome', { title: wikiTitle, defaultValue: `Benvenuto! Sono ${wikiTitle}. Cosa vorresti sapere?` }) }
    ]);

    return nextChat;
  }, [buildSystemPrompt, startSession, t, wikiTitle]);

  // Initialize chat with system prompt
  useEffect(() => {
    try {
      initializeWikiChat();
    } catch (error) {
      console.error("Failed to initialize chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setMessages([
        { role: "assistant", content: `Sorry, I couldn't initialize the chat: ${errorMessage}` }
      ]);
    }
  }, [initializeWikiChat]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    if (isLiveMode && !isLiveAvailable) {
      toast.error("Live mode is enabled but not available.");
      return;
    }
    if (!isLiveMode && !chat) return;
    
    setMessages(prev => [...prev, { role: "user", content: message }]);
    
    try {
      if (isLiveMode) {
        sendLiveMessage(message);
      } else {
        const text = await send(message, chat);
        setMessages(prev => [...prev, { role: "assistant", content: text }]);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      toast.error(t('errors.aiCommunication', { defaultValue: "Si è verificato un errore durante la comunicazione con l'assistente AI." }));
      setMessages(prev => prev.slice(0, -1));
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
  
  const handleStartNewChat = () => {
    try {
      resetLiveSession();
      resetSession();
      const newChat = initializeWikiChat();
      if (!newChat) {
        return;
      }
      setActivityPhase("chatting");
      setUserReflection("");
      setAiEvaluation(null);
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
      <div className="mb-4 flex justify-end">
        <Button
          variant={isLiveMode ? "default" : "outline"}
          onClick={() => setIsLiveMode((prev) => !prev)}
          disabled={!isLiveAvailable}
        >
          {isLiveMode ? "Live mode ON" : "Live mode OFF"}
        </Button>
      </div>

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
