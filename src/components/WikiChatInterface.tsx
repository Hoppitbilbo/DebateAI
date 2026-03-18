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
import { aiFacade, LiveConversationAudioChunk, LiveConversationHandle } from "@/services/aiFacade";
import { useAiChatSession } from "@/hooks/useAiChatSession";
import { Button } from "@/components/ui/button";

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
  const [isLiveMode, setIsLiveMode] = useState(false);

  const liveControllerRef = useRef<LiveConversationHandle | null>(null);
  const isLiveAssistantStreamingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<LiveConversationAudioChunk[]>([]);
  const isAudioPlayingRef = useRef(false);

  const cleanupAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    isAudioPlayingRef.current = false;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (typeof window === "undefined") return null;

    const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new Context();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playAudioChunk = useCallback(async (chunk: LiveConversationAudioChunk) => {
    const audioContext = await ensureAudioContext();
    if (!audioContext) return;

    const binary = atob(chunk.data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    if (chunk.mimeType.includes("pcm")) {
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const audioBuffer = audioContext.createBuffer(1, pcm.length, 24000);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) {
        channel[i] = pcm[i] / 32768;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
      return;
    }

    const blob = new Blob([bytes], { type: chunk.mimeType || "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    try {
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [ensureAudioContext]);

  const processAudioQueue = useCallback(async () => {
    if (isAudioPlayingRef.current) return;

    isAudioPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const next = audioQueueRef.current.shift();
        if (!next) continue;
        await playAudioChunk(next);
      }
    } finally {
      isAudioPlayingRef.current = false;
    }
  }, [playAudioChunk]);

  const enqueueAudioChunk = useCallback((chunk: LiveConversationAudioChunk) => {
    audioQueueRef.current.push(chunk);
    void processAudioQueue();
  }, [processAudioQueue]);

  const buildSystemPrompt = useCallback(() => `${t('apps.wikiChat.systemPrompt', {
    defaultValue: 'You are the living embodiment of the Wikipedia page provided below. Answer from a first-person perspective, using information from the text. Be the character. Do not break character. Do not say you are an AI.',
  })}\n\n${wikiSummary}`,
  [t, wikiSummary]);

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

    if (isLiveMode && !liveControllerRef.current) {
      toast.error("Live mode is enabled but not connected yet.");
      return;
    }
    if (!isLiveMode && !chat) return;
    
    setMessages(prev => [...prev, { role: "user", content: message }]);
    
    try {
      if (isLiveMode && liveControllerRef.current) {
        isLiveAssistantStreamingRef.current = false;
        liveControllerRef.current.sendTextTurn(message);
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
      liveControllerRef.current?.close();
      liveControllerRef.current = null;
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

  useEffect(() => {
    const connectLiveConversation = async () => {
      if (!isLiveMode) {
        liveControllerRef.current?.close();
        liveControllerRef.current = null;
        cleanupAudioPlayback();
        return;
      }

      if (!aiFacade.live.isConversationAvailable()) {
        toast.error("Live conversation non disponibile: controlla la API key.");
        setIsLiveMode(false);
        return;
      }

      try {
        liveControllerRef.current = await aiFacade.live.startConversation({
          languageCode: i18n.language,
          onText: (text) => {
            if (!text.trim()) return;
            setMessages((prev) => {
              if (isLiveAssistantStreamingRef.current && prev[prev.length - 1]?.role === "assistant") {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: `${last.content}${text}` };
                return updated;
              }

              isLiveAssistantStreamingRef.current = true;
              return [...prev, { role: "assistant", content: text }];
            });
          },
          onAudioChunk: (chunk) => {
            enqueueAudioChunk(chunk);
          },
          onTurnComplete: () => {
            isLiveAssistantStreamingRef.current = false;
          },
          onError: (errorMessage) => {
            toast.error(errorMessage);
          },
        });
      } catch (error) {
        console.error("Failed to start live conversation:", error);
        toast.error("Impossibile avviare la live conversation.");
        setIsLiveMode(false);
      }
    };

    connectLiveConversation();

    return () => {
      liveControllerRef.current?.close();
      liveControllerRef.current = null;
    };
  }, [cleanupAudioPlayback, enqueueAudioChunk, isLiveMode, i18n.language]);


  useEffect(() => {
    return () => {
      cleanupAudioPlayback();
    };
  }, [cleanupAudioPlayback]);

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
          disabled={!aiFacade.live.isConversationAvailable()}
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
