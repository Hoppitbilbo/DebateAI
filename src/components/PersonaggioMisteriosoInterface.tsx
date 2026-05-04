import { useState, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next'; 
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { WikiCharacter, Message } from "./personaggio-misterioso/types";
import GameSetup from "./personaggio-misterioso/GameSetup";
import GameHeader from "./personaggio-misterioso/GameHeader";
import ChatInterface from "./personaggio-misterioso/ChatInterface";
import FinalGuess from "./personaggio-misterioso/FinalGuess";
import { aiFacade } from "@/services/aiFacade";
import { getAIGameAndReflectionEvaluation, AIScoreEvaluation } from "@/utils/evaluationUtils";
import { ConversationData } from "@/utils/evaluationUtils";
import { Button } from "@/components/ui/button";
import AppLayout from "@/components/shared/AppLayout";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface"; 
import { useLiveAi } from "@/hooks/useLiveAi";

// Helper for flexible name checking
const normalizeString = (str: string) => {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
};

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
  
  // Stato per la valutazione strutturata
  const [aiStructuredEvaluation, setAiStructuredEvaluation] = useState<AIScoreEvaluation | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [guessCorrect, setGuessCorrect] = useState(false);
  const [nameScore, setNameScore] = useState<number | null>(null);

  const handleLiveTextReceived = useCallback((text: string, isStreaming: boolean) => {
    setConversation((prev) => {
      if (isStreaming && prev[prev.length - 1]?.role === "character") {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        updated[updated.length - 1] = { ...last, content: `${last.content}${text}` };
        return updated;
      }
      return [...prev, { role: "character", content: text }];
    });
  }, []);

  const handleUserTranscriptionReceived = useCallback((text: string, isFinal: boolean) => {
    setConversation((prev) => {
      // If the last message was the user and wasn't finalized previously, update it.
      // We don't have a strict 'isFinal' tracking flag on the UI yet, but we can append or replace the last unfinished user turn.
      // For simplicity, let's keep it straightforward for now: 
      // check if the last message is from the user and we can overwrite it, or just append new user text when it's final.
      
      const updated = [...prev];
      const last = updated[updated.length - 1];

      if (last?.role === "user") {
        updated[updated.length - 1] = { ...last, content: text };
        return updated;
      } else {
        return [...updated, { role: "user", content: text }];
      }
    });

    if (isFinal) {
      // Reduce question count if a complete question was recognized
      setQuestionsLeft((prev) => {
        const remaining = prev - 1;
        if (remaining === 0) {
          setReadyForFinalGuess(true);
          toast.info(t('apps.personaggioMisterioso.game.questionsFinished'));
        }
        return remaining;
      });
    }
  }, [t]);

  const systemInstruction = selectedCharacter ? t('apps.personaggioMisterioso.game.systemInstruction', {
    characterName: selectedCharacter.title,
    snippet: selectedCharacter.snippet,
  }) : undefined;

  const { isLiveMode, setIsLiveMode, isLiveAvailable, sendLiveMessage, resetLiveSession } = useLiveAi({
    onTextReceived: handleLiveTextReceived,
    onUserTranscription: handleUserTranscriptionReceived,
    systemInstruction,
    characterName: selectedCharacter?.title,
    characterBio: selectedCharacter?.snippet,
  });

  useEffect(() => {
    setQuestionsLeft(difficulty);
  }, [difficulty]);

  const handleCharacterSelect = (character: WikiCharacter) => {
    setSelectedCharacter(character);
    setConversation([]);
    setShowFinalGuess(false);
    setIsGameStarted(false); 
    setActivityPhase("game");
    setFinalGuess("");
    setReasoning("");
    setUserReflection("");
    setAiStructuredEvaluation(null); // Resetta la valutazione strutturata
    setGuessCorrect(false);
    setReadyForFinalGuess(false);
    setNameScore(null);
  };

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

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !selectedCharacter || isAiResponding) return;

    const userMessage: Message = {
      role: "user",
      content: currentQuestion,
    };

    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);
    setCurrentQuestion("");
    setIsAiResponding(true);
    setReadyForFinalGuess(false);

    if (isLiveMode && !isLiveAvailable) {
      toast.error("Live mode is enabled but non disponibile.");
      return;
    }

    if (isLiveMode) {
      sendLiveMessage(currentQuestion);
      const remaining = questionsLeft - 1;
      setQuestionsLeft(remaining);
      if (remaining === 0) {
        setReadyForFinalGuess(true);
        toast.info(t('apps.personaggioMisterioso.game.questionsFinished'));
      }
      setIsAiResponding(false);
      return;
    }

    try {
      const history = conversation
        .slice(1) // Exclude the initial character greeting
        .map(msg => ({
          role: (msg.role === 'character' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: msg.content }],
        }));

      const systemInstruction = t('apps.personaggioMisterioso.game.systemInstruction', {
        characterName: selectedCharacter.title,
        snippet: selectedCharacter.snippet,
      });

      const chat = aiFacade.text.startChat({ history, systemInstructionText: systemInstruction });

      const aiResponseText = await aiFacade.text.sendMessage(chat, currentQuestion);

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
      // Add the error message to the conversation to inform the user
      setConversation(prev => [...prev, aiErrorMessage]);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleProceedToGuess = () => {
    setShowFinalGuess(true);
    setActivityPhase("final-guess");
    setReadyForFinalGuess(false);
    setHideCharacter(false); 
    toast.success(t('apps.personaggioMisterioso.game.timeToGuess'));
  };

  const handleSubmitGuess = () => {
    if (!finalGuess.trim() || !selectedCharacter) return;

    const normalizedFinalGuess = normalizeString(finalGuess);
    const normalizedCharacterName = normalizeString(selectedCharacter.title);
    
    const isCorrect = normalizedCharacterName.includes(normalizedFinalGuess) || 
                      normalizedFinalGuess.includes(normalizedCharacterName) ||
                      (normalizedCharacterName.split(' ').some(part => normalizedFinalGuess.includes(part) && part.length > 3) && 
                       normalizedFinalGuess.split(' ').some(part => normalizedCharacterName.includes(part) && part.length > 3));

    setGuessCorrect(isCorrect);
    setNameScore(isCorrect ? 10 : 0); // Punteggio per il nome

    toast(isCorrect ? t('apps.personaggioMisterioso.game.correctGuess') : t('apps.personaggioMisterioso.game.incorrectGuess'), {
      description: t('apps.personaggioMisterioso.game.reflectionPrompt')
    });

    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    if (!selectedCharacter) return;
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);
    setAiStructuredEvaluation(null); // Resetta prima di una nuova valutazione

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
      setAiStructuredEvaluation({ // Imposta un oggetto di errore
        textualFeedback: t('apps.personaggioMisterioso.evaluation.aiError', { errorMessage }),
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNewGame = () => {
    resetLiveSession();
    setSelectedCharacter(null);
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
    setAiStructuredEvaluation(null); // Resetta anche questo
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
            <div className="mb-4 flex justify-end">
              <Button
                variant={isLiveMode ? "default" : "outline"}
                onClick={() => setIsLiveMode((prev) => !prev)}
                disabled={!isLiveAvailable}
              >
                {isLiveMode ? "Live mode ON" : "Live mode OFF"}
              </Button>
            </div>
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
