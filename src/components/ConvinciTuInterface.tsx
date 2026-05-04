import { useTranslation } from "react-i18next";
import { useState, useCallback } from "react";
import { toast } from "@/components/ui/sonner";
import { Message, ActivityPhase } from "@/types/conversation";
import { getAIGameAndReflectionEvaluation, ConversationData } from "@/utils/evaluationUtils";
import CharacterSelection from "./ConvinciTu/CharacterSelection";
import ConversationSection from "./ConvinciTu/ConversationSection";
import { generateAIResponse } from "@/services/aiResponseService";
import AppLayout from "@/components/shared/AppLayout";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface";
import { useLiveAi } from "@/hooks/useLiveAi";
import { Button } from "@/components/ui/button";

interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

const ConvinciTuInterface = () => {
  const { t } = useTranslation();
  const [selectedCharacter, setSelectedCharacter] = useState<WikiCharacter | null>(null);
  const [persuasionTopic, setPersuasionTopic] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLiveTextReceived = useCallback((text: string, isStreaming: boolean) => {
    setConversation((prev) => {
      if (isStreaming && prev[prev.length - 1]?.role === "assistant") {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, content: `${last.content}${text}`, characterName: selectedCharacter?.title };
        return updated;
      }
      return [...prev, { role: "assistant", content: text, characterName: selectedCharacter?.title }];
    });
  }, [selectedCharacter]);

  const handleUserTranscriptionReceived = useCallback((text: string, isFinal: boolean) => {
    setConversation((prev) => {
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

  const systemInstruction = selectedCharacter && persuasionTopic ? t('ai.systemInstructions.convinciTu', {
    name: selectedCharacter.title,
    prompt: persuasionTopic
  }) : undefined;

  const { isLiveMode, setIsLiveMode, isLiveAvailable, sendLiveMessage, resetLiveSession } = useLiveAi({
    onTextReceived: handleLiveTextReceived,
    onUserTranscription: handleUserTranscriptionReceived,
    systemInstruction,
    characterName: selectedCharacter?.title,
    characterBio: selectedCharacter?.snippet,
  });

  const handleCharacterSelect = (character: WikiCharacter) => {
    setSelectedCharacter(character);
    setConversation([]);
  };

  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message
    };
    setConversation(prev => [...prev, userMessage]);
    
    if (isLiveMode && !isLiveAvailable) {
      toast.error("Live mode is enabled but non disponibile.");
      return;
    }

    if (isLiveMode) {
      sendLiveMessage(message);
      return;
    }

    setIsLoading(true);
    try {
      // Ensure selectedCharacter and its snippet are passed correctly if generateAIResponse expects it
      // The updated generateAIResponse in aiResponseService.ts now expects { title: string; snippet: string; }
      if (selectedCharacter) {
        const aiResponse = await generateAIResponse(
          selectedCharacter,
          persuasionTopic,
          [...conversation, userMessage],
          t
        );
        
        const characterMessage: Message = {
          role: "assistant",
          content: aiResponse,
          characterName: selectedCharacter.title
        };
        setConversation(prev => [...prev, characterMessage]);
      }
    } catch (error) {
      console.error("Error generating AI response:", error);
      toast.error(t('apps.convinciTu.errors.responseGeneration'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndActivity = () => {
    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);
    setAiEvaluation(null); // Clear previous evaluation

    try {
      if (selectedCharacter) {
        const conversationData: ConversationData = {
          character: selectedCharacter.title,
          topic: persuasionTopic,
          messages: conversation,
        };
        
        const evaluationResult = await getAIGameAndReflectionEvaluation(
          conversationData, 
          reflection
        );
        
        setAiEvaluation(evaluationResult.textualFeedback);
      }
    } catch (error) {
      console.error("Error generating evaluation:", error);
      toast.error(t('apps.convinciTu.errors.evaluationGeneration'));
      setAiEvaluation(t('apps.convinciTu.errors.evaluationGeneration'));
    } finally {
      setIsEvaluating(false);
    }
  };
  
  const handleStartNewChat = () => {
    resetLiveSession();
    setSelectedCharacter(null);
    setPersuasionTopic("");
    setConversation([]);
    setActivityPhase("chatting");
    setUserReflection("");
    setAiEvaluation(null);
    setIsEvaluating(false);
    setIsLoading(false);
    toast.success(t('apps.convinciTu.newChatSuccess'));
  };

  return (
    <AppLayout
      title={t('apps.convinciTu.title')}
      subtitle={t('apps.convinciTu.subtitle')}
      onReset={handleStartNewChat}
    >
      {activityPhase === "chatting" && (
        <>
          <div className="mb-4 flex justify-end">
            <Button
              variant={isLiveMode ? "default" : "outline"}
              onClick={() => setIsLiveMode((prev) => !prev)}
              disabled={!isLiveAvailable}
            >
              {isLiveMode ? "Live mode ON" : "Live mode OFF"}
            </Button>
          </div>
          <CharacterSelection
            selectedCharacter={selectedCharacter}
            persuasionTopic={persuasionTopic}
            onCharacterSelect={handleCharacterSelect}
            onTopicChange={setPersuasionTopic}
          />

          {selectedCharacter && persuasionTopic && (
            <ConversationSection
              selectedCharacter={selectedCharacter}
              persuasionTopic={persuasionTopic}
              conversation={conversation}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              onEndActivity={handleEndActivity}
            />
          )}
        </>
      )}

      {activityPhase === "reflection" && (
        <ReflectionInterface
          title={t('apps.convinciTu.reflection.title')}
          description={t('apps.convinciTu.reflection.description')}
          onSubmit={handleReflectionSubmit}
          placeholder={t('apps.convinciTu.reflection.placeholder')}
          characterName={selectedCharacter?.title}
        />
      )}

      {activityPhase === "feedback" && (
        <FeedbackInterface
          userReflection={userReflection}
          aiEvaluation={aiEvaluation}
          isLoading={isEvaluating}
          onStartNewChat={handleStartNewChat}
          messages={conversation}
          characterName={selectedCharacter?.title || "N/A"}
          topic={persuasionTopic}
        />
      )}
    </AppLayout>
  );
};

export default ConvinciTuInterface;
