
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getAIGameAndReflectionEvaluation, ConversationData } from "@/utils/evaluationUtils";
import { Message } from "@/types/conversation";
import { model } from "@/services/aiService";
import { ChatSession } from "@google/generative-ai";
import AppLayout from "@/components/shared/AppLayout";
import ChatInterface from "@/components/shared/ChatInterface";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface";
import { Card } from "@/components/ui/card";
import { useTranslation } from "react-i18next";

interface Character {
  name: string;
  bio: string;
}

interface ImpersonaTuChatProps {
  aiCharacter: Character;
  userCharacter: Character;
  topic: string;
}

const ImpersonaTuChat = ({ aiCharacter, userCharacter, topic }: ImpersonaTuChatProps) => {
  const { t } = useTranslation();
  // Corrected state type: Use Message[]
  const [messages, setMessages] = useState<Message[]>([]); 
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activityPhase, setActivityPhase] = useState<"chatting" | "reflection" | "evaluating" | "feedback">("chatting");
  const [userReflection, setUserReflection] = useState<string | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [chat, setChat] = useState<ChatSession | null>(null); // State for Vertex AI chat session

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize or re-initialize chat session
  const initializeChat = () => {
      setIsLoading(true); // Show loading while setting up
      setMessages([]); // Clear previous messages
      const systemPrompt = `Sei ${aiCharacter.name}. La tua biografia è: ${aiCharacter.bio}. \
Interagisci come se fossi realmente ${aiCharacter.name}, basandoti sulla tua biografia e sul contesto storico. \
Stai conversando con uno studente che sta cercando di impersonare ${userCharacter.name} (la sua biografia è: ${userCharacter.bio}). \
L'argomento della vostra discussione è: "${topic}". \
Il tuo obiettivo è mantenere una conversazione realistica e coinvolgente nel ruolo di ${aiCharacter.name}, discutendo dell'argomento ${topic} con lo studente (che interpreta ${userCharacter.name}). \
Rispondi alle sue affermazioni, poni domande pertinenti e guida la conversazione, sempre rimanendo nel personaggio. \
Non devi MAI rivelare di essere un'intelligenza artificiale o un modello linguistico. Parla sempre in prima persona come ${aiCharacter.name}. \
Mantieni un tono e uno stile appropriati al tuo personaggio e all'epoca.`;

      const initialAiMessage = t('apps.impersonaTu.chat.greeting', { 
        aiCharacterName: aiCharacter.name, 
        topic,
        userCharacterName: userCharacter.name 
      });

      try {
          const newChat = model.startChat({
            history: [
              { role: "user", parts: [{ text: systemPrompt }] },
              { role: "model", parts: [{ text: initialAiMessage }] },
            ],
            generationConfig: {
              temperature: 0.75,
              maxOutputTokens: 1000,
            },
          });
          setChat(newChat);
          // Set initial message - Use Message type
          setMessages([{ role: "assistant", content: initialAiMessage }]); 
      } catch (error) {
          console.error("Error initializing chat:", error);
          toast.error(t('apps.impersonaTu.chat.initError'));
          setMessages([]); 
          setChat(null); // Ensure chat is null on error
      } finally {
          setIsLoading(false);
      }
  };

  // Initialize chat on component mount or when characters/topic change
  useEffect(() => {
    initializeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiCharacter, userCharacter, topic]); 


  const handleSend = async () => {
    if (!input.trim() || isLoading || !chat) {
        if (!chat) toast.error(t('apps.impersonaTu.chat.sessionError'));
        return;
    }

    const userMessageContent = input.trim();
    const currentInput = input; 
    setInput(""); 

    // Add user message optimistically - Use Message type
    const newUserMessage: Message = {
      role: "user",
      content: userMessageContent,
    };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const result = await chat.sendMessage(userMessageContent);
      const response = await result.response; 
      const aiTextResponse = await response.text();

      // Add AI response - Use Message type
      const aiResponseMessage: Message = {
        role: "assistant",
        content: aiTextResponse,
      };
      setMessages(prev => [...prev, aiResponseMessage]);

    } catch (error) {
      console.error("Error sending message to Vertex AI:", error);
      toast.error(t('apps.impersonaTu.chat.sendError'));
      setMessages(prev => prev.filter(msg => msg !== newUserMessage));
      setInput(currentInput); 
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndActivity = () => {
    if (messages.filter(m => m.role === 'user').length < 2) {
      toast.warning(t('apps.impersonaTu.chat.minMessagesWarning'));
      return;
    }
    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("evaluating");
    setIsEvaluating(true);
    setAiEvaluation(null);

    try {
      const conversationData: ConversationData = {
        character: `Studente nel ruolo di ${userCharacter.name}`,
        topic: `Discussione su "${topic}" tra ${aiCharacter.name} (AI) e ${userCharacter.name} (Studente)`,
        // Ensure the messages passed here conform to the expected structure in evaluationUtils
        messages: messages, 
      };
      console.log("Invio dati per valutazione:", { conversationData, reflection }); 
      const evaluationResult = await getAIGameAndReflectionEvaluation(conversationData, reflection);
      console.log("Valutazione ricevuta:", evaluationResult); 
      setAiEvaluation(evaluationResult.textualFeedback);
      setActivityPhase("feedback");
    } catch (error) {
      console.error("Errore durante la generazione della valutazione:", error);
      toast.error("Si è verificato un errore durante la valutazione AI.");
      setAiEvaluation("Errore durante la valutazione. Controlla la console per dettagli.");
      setActivityPhase("feedback"); 
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleStartNewChat = () => {
    initializeChat(); 
    setInput("");
    setActivityPhase("chatting");
    setUserReflection(null);
    setAiEvaluation(null);
    setIsEvaluating(false);
    toast.success(t('apps.impersonaTu.chat.newChatStarted'));
  };

  // --- Render Logic --- 

  if (activityPhase === "chatting") {
    return (
      <AppLayout
        title={t('apps.impersonaTu.title')}
        subtitle={t('apps.impersonaTu.subtitle')}
        onReset={handleStartNewChat}
      >
        {/* Character Info Header */}
        <Card className="p-4 bg-white/90 backdrop-blur-sm border-education/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-semibold text-education truncate" title={aiCharacter.name}>
                {aiCharacter.name}
              </p>
              <p className="text-xs text-education-muted">{t('apps.impersonaTu.chat.aiCharacter')}</p>
            </div>
            <div className="border-x border-education/20 px-4">
              <p className="text-sm font-medium text-education-dark">{t('apps.impersonaTu.chat.topic')}</p>
              <p className="text-sm text-education font-semibold truncate" title={topic}>
                {topic}
              </p>
            </div>
            <div>
              <p className="font-semibold text-education truncate" title={userCharacter.name}>
                {userCharacter.name}
              </p>
              <p className="text-xs text-education-muted">{t('apps.impersonaTu.chat.yourCharacter')}</p>
            </div>
          </div>
        </Card>

        {/* Chat Interface */}
        <ChatInterface
          messages={messages}
          input={input}
          onInputChange={setInput}
          onSendMessage={handleSend}
          onEndActivity={handleEndActivity}
          isLoading={isLoading || !chat}
          placeholder={t('apps.impersonaTu.chat.placeholder', { characterName: userCharacter.name })}
          userCharacterName={userCharacter.name}
          aiCharacterName={aiCharacter.name}
          minMessagesForEnd={2}
          className="h-[500px]"
        />
      </AppLayout>
    );
  }

  if (activityPhase === "reflection") {
    return (
      <AppLayout
        title={t('apps.impersonaTu.title')}
        subtitle={t('apps.impersonaTu.subtitle')}
        onReset={handleStartNewChat}
      >
        <ReflectionInterface
          title={t('apps.impersonaTu.reflection.title')}
          description={t('apps.impersonaTu.reflection.description')}
          onSubmit={handleReflectionSubmit}
          placeholder={t('apps.impersonaTu.reflection.placeholder', { 
            userCharacterName: userCharacter.name, 
            aiCharacterName: aiCharacter.name 
          })}
          characterName={userCharacter.name}
        />
      </AppLayout>
    );
  }

  if (activityPhase === "evaluating") {
    return (
      <AppLayout
        title={t('apps.impersonaTu.title')}
        subtitle={t('apps.impersonaTu.subtitle')}
        onReset={handleStartNewChat}
      >
        <Card className="p-8 bg-white/90 backdrop-blur-sm border-education/20">
          <div className="text-center">
            <div className="animate-spin h-10 w-10 border-4 border-education border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-education-dark">{t('apps.impersonaTu.chat.evaluating')}</p>
            <p className="text-education-muted">{t('apps.impersonaTu.chat.evaluatingDescription')}</p>
          </div>
        </Card>
      </AppLayout>
    );
  }

  if (activityPhase === "feedback") {
    return (
      <AppLayout
        title={t('apps.impersonaTu.title')}
        subtitle={t('apps.impersonaTu.subtitle')}
        onReset={handleStartNewChat}
      >
        <FeedbackInterface
          userReflection={userReflection!}
          aiEvaluation={aiEvaluation}
          isLoading={isEvaluating}
          onStartNewChat={handleStartNewChat}
          messages={messages}
          characterName={`${userCharacter.name} (interpretato da te)`}
          topic={`Discussione su "${topic}" con ${aiCharacter.name}`}
        />
      </AppLayout>
    );
  }

  // This should never be reached
  return null;
};

export default ImpersonaTuChat;
