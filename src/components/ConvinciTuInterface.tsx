/**
 * @file Manages the state and flow of the "ConvinciTu" educational game.
 * @remarks This component orchestrates the different phases of the game: character selection,
 * conversation, reflection, and feedback. It handles state for the selected character,
 * persuasion topic, conversation history, and AI interactions.
 */

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

/**
 * @interface WikiCharacter
 * @description Represents a character fetched from Wikipedia.
 * @property {string} title - The name of the character.
 * @property {string} snippet - A brief description of the character.
 * @property {number} pageid - The unique identifier for the Wikipedia page.
 */
interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @function ConvinciTuInterface
 * @description The main component for the "ConvinciTu" game. It controls the game's state,
 * transitioning between character selection, conversation, reflection, and feedback phases.
 * It manages all user interactions and AI service calls.
 * @returns {JSX.Element} The rendered game interface, which changes based on the current activity phase.
 */
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

  /**
   * @function handleCharacterSelect
   * @description Updates the state when a character is selected and resets the conversation.
   * @param {WikiCharacter} character - The character selected by the user.
   */
  const handleCharacterSelect = (character: WikiCharacter) => {
    setSelectedCharacter(character);
    setConversation([]);
  };

  /**
   * @function handleSendMessage
   * @description Sends a user's message, adds it to the conversation, and fetches the AI's response.
   * @param {string} message - The message content from the user.
   */
  const handleSendMessage = async (message: string) => {
    const userMessage: Message = {
      role: "user",
      content: message
    };
    setConversation(prev => [...prev, userMessage]);
    
    setIsLoading(true);
    try {
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

  /**
   * @function handleEndActivity
   * @description Transitions the game from the chatting phase to the reflection phase.
   */
  const handleEndActivity = () => {
    setActivityPhase("reflection");
  };

  /**
   * @function handleReflectionSubmit
   * @description Submits the user's reflection, transitions to the feedback phase, and requests an AI evaluation.
   * @param {string} reflection - The user's written reflection.
   */
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
  
  /**
   * @function handleStartNewChat
   * @description Resets the entire game state to allow the user to start a new session.
   */
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
