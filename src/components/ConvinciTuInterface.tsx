import { useTranslation } from "react-i18next";
import { useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Message, ActivityPhase } from "@/types/conversation";
import { getAIGameAndReflectionEvaluation, ConversationData } from "@/utils/evaluationUtils";
import CharacterSelection from "./ConvinciTu/CharacterSelection";
import ConversationSection from "./ConvinciTu/ConversationSection";
import { generateAIResponse } from "@/services/aiResponseService";
import AppLayout from "@/components/shared/AppLayout";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface";

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
