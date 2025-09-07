/**
 * @file Manages the state and flow of the "Personaggio Misterioso" (Mystery Character) game.
 * @remarks This component orchestrates the entire game, from setup (character selection, difficulty)
 * to the conversation phase, final guess, reflection, and feedback. It handles all state management
 * and interactions with AI services.
 */

import { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next'; 
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { WikiCharacter, Message } from "./personaggio-misterioso/types";
import GameSetup from "./personaggio-misterioso/GameSetup";
import GameHeader from "./personaggio-misterioso/GameHeader";
import ChatInterface from "./personaggio-misterioso/ChatInterface";
import FinalGuess from "./personaggio-misterioso/FinalGuess";
import { startChat } from "@/services/aiService";
import { getAIGameAndReflectionEvaluation, AIScoreEvaluation } from "@/utils/evaluationUtils";
import { ConversationData } from "@/utils/evaluationUtils";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/shared/AppLayout";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface"; 

/**
 * @function normalizeString
 * @description Converts a string to a normalized format for comparison (lowercase, trimmed, single spaces).
 * @param {string} str - The string to normalize.
 * @returns {string} The normalized string.
 */
const normalizeString = (str: string) => {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
};

/**
 * @function PersonaggioMisteriosoInterface
 * @description The main component for the "Personaggio Misterioso" game. It controls the game's state,
 * transitioning between setup, gameplay, guessing, reflection, and feedback phases.
 * @returns {JSX.Element} The rendered game interface, which changes based on the current activity phase.
 */
const PersonaggioMisteriosoInterface = () => {
  const { t } = useTranslation();
  const [selectedCharacter, setSelectedCharacter] = useState<WikiCharacter | null>(null);
  const [difficulty, setDifficulty] = useState(5); 
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [hideCharacter, setHideCharacter] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionsLeft, setQuestionsLeft] = useState(difficulty);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [showFinalGuess, setShowFinalGuess] = useState(false);
  const [finalGuess, setFinalGuess] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [showChat, setShowChat] = useState(true);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [readyForFinalGuess, setReadyForFinalGuess] = useState(false); 

  const [activityPhase, setActivityPhase] = useState<"game" | "final-guess" | "reflection" | "feedback">("game");
  const [userReflection, setUserReflection] = useState("");
  
  const [aiStructuredEvaluation, setAiStructuredEvaluation] = useState<AIScoreEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [guessCorrect, setGuessCorrect] = useState(false);
  const [nameScore, setNameScore] = useState<number | null>(null);

  useEffect(() => {
    setQuestionsLeft(difficulty);
  }, [difficulty]);

  /**
   * @function handleCharacterSelect
   * @description Updates the state when a character is selected and resets the game state.
   * @param {WikiCharacter} character - The character selected for the game.
   */
  const handleCharacterSelect = (character: WikiCharacter) => {
    setSelectedCharacter(character);
    setConversation([]);
    setShowFinalGuess(false);
    setIsGameStarted(false); 
    setActivityPhase("game");
    setFinalGuess("");
    setReasoning("");
    setUserReflection("");
    setAiStructuredEvaluation(null);
    setGuessCorrect(false);
    setReadyForFinalGuess(false);
    setNameScore(null);
  };

  /**
   * @function handleStartGame
   * @description Starts the game after a character and difficulty have been chosen.
   */
  const handleStartGame = () => {
    if (!selectedCharacter) {
      toast.error(t('apps.personaggioMisterioso.setup.selectCharacterError'));
      return;
    }
    setIsGameStarted(true);
    setReadyForFinalGuess(false);
    setShowFinalGuess(false); 
    setActivityPhase("game"); 
    setConversation([
      {
        role: "character", 
        content: t('apps.personaggioMisterioso.game.initialMessage', { count: questionsLeft })
      }
    ]);
    toast(t('apps.personaggioMisterioso.game.gameStarted'), {
      description: t('apps.personaggioMisterioso.game.gameStartedDesc', { count: questionsLeft })
    });
  };

  /**
   * @function handleAskQuestion
   * @description Sends the user's question to the AI and updates the conversation state.
   */
  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !selectedCharacter || isAiResponding) return;

    const userMessage: Message = {
      role: "user",
      content: currentQuestion,
    };

    setConversation(prev => [...prev, userMessage]);
    setCurrentQuestion("");
    setIsAiResponding(true);
    setReadyForFinalGuess(false);

    try {
      const history = conversation
        .slice(1)
        .map(msg => ({
          role: (msg.role === 'character' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: msg.content }],
        }));

      const systemInstruction = t('apps.personaggioMisterioso.game.systemInstruction', {
        characterName: selectedCharacter.title,
        snippet: selectedCharacter.snippet,
      });

      const chat = startChat(history, systemInstruction);
      const result = await chat.sendMessage(currentQuestion);
      const aiResponseText = result.response.text();

      const aiMessage: Message = {
        role: "character",
        content: aiResponseText || t('apps.personaggioMisterioso.game.aiDefaultError'),
      };

      setConversation(prev => [...prev, aiMessage]);
      const remaining = questionsLeft - 1;
      setQuestionsLeft(remaining);

      if (remaining === 0) {
        setReadyForFinalGuess(true);
        toast.info(t('apps.personaggioMisterioso.game.questionsFinished'));
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error(t('common.aiError'));
      const aiErrorMessage: Message = {
        role: "character",
        content: t('apps.personaggioMisterioso.game.aiErrorMessage'),
      };
      setConversation(prev => [...prev, aiErrorMessage]);
    } finally {
      setIsAiResponding(false);
    }
  };

  /**
   * @function handleProceedToGuess
   * @description Transitions the game from the questioning phase to the final guess phase.
   */
  const handleProceedToGuess = () => {
    setShowFinalGuess(true);
    setActivityPhase("final-guess");
    setReadyForFinalGuess(false);
    setHideCharacter(false); 
    toast.success(t('apps.personaggioMisterioso.game.timeToGuess'));
  };

  /**
   * @function handleSubmitGuess
   * @description Submits the user's final guess, checks if it's correct, and transitions to the reflection phase.
   */
  const handleSubmitGuess = () => {
    if (!finalGuess.trim() || !selectedCharacter) return;

    const normalizedFinalGuess = normalizeString(finalGuess);
    const normalizedCharacterName = normalizeString(selectedCharacter.title);
    
    const isCorrect = normalizedCharacterName.includes(normalizedFinalGuess) || 
                      normalizedFinalGuess.includes(normalizedCharacterName) ||
                      (normalizedCharacterName.split(' ').some(part => normalizedFinalGuess.includes(part) && part.length > 3) && 
                       normalizedFinalGuess.split(' ').some(part => normalizedCharacterName.includes(part) && part.length > 3));

    setGuessCorrect(isCorrect);
    setNameScore(isCorrect ? 10 : 0);

    toast(isCorrect ? t('apps.personaggioMisterioso.game.correctGuess') : t('apps.personaggioMisterioso.game.incorrectGuess'), {
      description: t('apps.personaggioMisterioso.game.reflectionPrompt')
    });

    setActivityPhase("reflection");
  };

  /**
   * @function handleReflectionSubmit
   * @description Submits the user's reflection and triggers the AI evaluation process.
   * @param {string} reflection - The user's written reflection.
   */
  const handleReflectionSubmit = async (reflection: string) => {
    if (!selectedCharacter) return;
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);
    setAiStructuredEvaluation(null);

    const conversationData: ConversationData = {
      character: selectedCharacter.title,
      topic: t('apps.personaggioMisterioso.evaluation.topic', { characterName: selectedCharacter.title }),
      messages: conversation.map(msg => ({
        role: msg.role === 'character' ? 'assistant' : msg.role,
        content: msg.content,
      })),
      characterSnippet: selectedCharacter.snippet,
    };

    try {
      const evaluation = await getAIGameAndReflectionEvaluation(conversationData, reflection);
      setAiStructuredEvaluation(evaluation);
    } catch (error) {
      console.error("Error generating evaluation:", error);
      const errorMessage = error instanceof Error ? error.message : t('common.unknownError');
      toast.error(t('apps.personaggioMisterioso.evaluation.generationError', { errorMessage }));
      setAiStructuredEvaluation({
        textualFeedback: t('apps.personaggioMisterioso.evaluation.aiError', { errorMessage }),
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  /**
   * @function handleNewGame
   * @description Resets the entire game state to start a new game from scratch.
   */
  const handleNewGame = () => {
    setSelectedCharacter(null);
    setIsGameStarted(false);
    setHideCharacter(true);
    setCurrentQuestion("");
    setQuestionsLeft(difficulty); 
    setConversation([]);
    setShowFinalGuess(false);
    setFinalGuess("");
    setReasoning("");
    setShowChat(true);
    setActivityPhase("game");
    setUserReflection("");
    setAiStructuredEvaluation(null);
    setGuessCorrect(false);
    setIsAiResponding(false);
    setReadyForFinalGuess(false); 
    setNameScore(null);
    toast.success(t('apps.personaggioMisterioso.game.newGameStarted'));
  };

  return (
    <AppLayout
      title={t('apps.personaggioMisterioso.title')}
      subtitle={t('apps.personaggioMisterioso.subtitle')}
      onReset={handleNewGame}
    >
      {(activityPhase === "game" && (!isGameStarted || !readyForFinalGuess)) && !showFinalGuess && (
        <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
          <div className="space-y-4">
            {!isGameStarted ? (
              <GameSetup
                onCharacterSelect={handleCharacterSelect}
                difficulty={difficulty}
                onDifficultyChange={(value) => setDifficulty(value[0])} 
                onStartGame={handleStartGame}
              />
            ) : (
              <GameHeader
                questionsLeft={questionsLeft}
                hideCharacter={hideCharacter} 
                onToggleHideCharacter={() => setHideCharacter(!hideCharacter)}
                characterName={selectedCharacter?.title || ""}
                onNewGame={handleNewGame}
              />
            )}
          </div>
        </Card>
      )}

      {isGameStarted && activityPhase === "game" && !showFinalGuess && (
         <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
          <ChatInterface
            currentQuestion={currentQuestion}
            onQuestionChange={(value) => setCurrentQuestion(value)}
            onAskQuestion={handleAskQuestion}
            questionsLeft={questionsLeft}
            conversation={conversation}
            showChat={showChat}
            onToggleChat={() => setShowChat(!showChat)}
            isResponding={isAiResponding}
          />
        </Card>
      )}
 
      {readyForFinalGuess && activityPhase === "game" && !showFinalGuess && (
        <Card className="p-6 text-center bg-white/90 backdrop-blur-sm border-education/20">
            <h3 className="text-xl font-semibold mb-4 text-education-dark">{t('apps.personaggioMisterioso.game.questionsFinishedTitle')}</h3>
            <p className="mb-6 text-education-muted">{t('apps.personaggioMisterioso.game.questionsFinishedDesc')}</p>
            <Button onClick={handleProceedToGuess} size="lg" className="bg-education hover:bg-education-dark">
                {t('apps.personaggioMisterioso.game.proceedToGuess')}
            </Button>
        </Card>
      )}

      {activityPhase === "final-guess" && (
        <Card className="p-6 bg-white/90 backdrop-blur-sm border-education/20">
          <FinalGuess
            finalGuess={finalGuess}
            reasoning={reasoning}
            onFinalGuessChange={setFinalGuess}
            onReasoningChange={setReasoning}
            onSubmitGuess={handleSubmitGuess}
 
          />
        </Card>
      )}
      
      {activityPhase === "reflection" && selectedCharacter && (
        <ReflectionInterface
          title={t('apps.personaggioMisterioso.reflection.title')}
          description={t('apps.personaggioMisterioso.reflection.description')}
          onSubmit={handleReflectionSubmit}
          placeholder={t('apps.personaggioMisterioso.reflection.placeholder')}
          characterName={selectedCharacter.title}
          gameResult={{
            correctGuess: guessCorrect,
            finalGuess: finalGuess
          }}
        />
      )}
      
      {activityPhase === "feedback" && selectedCharacter && (
        <FeedbackInterface
          userReflection={userReflection}
          aiEvaluation={aiStructuredEvaluation?.textualFeedback || null}
          isLoading={isEvaluating}
          onStartNewChat={handleNewGame}
          characterName={selectedCharacter.title}
          topic={t('apps.personaggioMisterioso.title')}
          gameResult={{
            correctGuess: guessCorrect,
            finalGuess: finalGuess,
            score: nameScore || 0
          }}
        />
      )}
    </AppLayout>
  );
};

export default PersonaggioMisteriosoInterface;
