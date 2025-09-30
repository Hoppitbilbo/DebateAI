import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { model, startChat } from "@/services/aiService";
import { getAIGameAndReflectionEvaluation, ConversationData } from "@/utils/evaluationUtils";
import { Message as EvaluationMessage } from "@/types/conversation";
import AppLayout from "@/components/shared/AppLayout";
import ChatInterface from "@/components/shared/ChatInterface";
import ReflectionInterface from "@/components/shared/ReflectionInterface";
import FeedbackInterface from "@/components/shared/FeedbackInterface";
import AiIdentityIdentificationPhase from "@/components/AiIdentity/AiIdentityIdentificationPhase";
import { ChatSession } from "@google/generative-ai";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Character {
  name: string;
  snippet: string;
}

interface Message {
  character: string;
  content: string;
}

type DifficultyLevel = "easy" | "medium" | "hard";

interface AiIdentityChatProps {
  character1: Character;
  character2: Character;
}

const AiIdentityChat = ({ character1, character2 }: AiIdentityChatProps) => {
  const { t } = useTranslation();
  
  const [messages1, setMessages1] = useState<Message[]>([
    {
      character: "Personaggio A",
      content: t('apps.aiIdentity.greeting1'),
    },
  ]);

  const [messages2, setMessages2] = useState<Message[]>([
    {
      character: "Personaggio B",
      content: t('apps.aiIdentity.greeting2'),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [confusingNames1, setConfusingNames1] = useState<string[]>([]);
  const [confusingNames2, setConfusingNames2] = useState<string[]>([]);
  
  const [activityPhase, setActivityPhase] = useState<"chatting" | "identification" | "reflection" | "feedback">("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [userGuess1, setUserGuess1] = useState("");
  const [userGuess2, setUserGuess2] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    if (difficulty === "medium") {
      generateConfusingNamesForCharacters();
    } else {
      setConfusingNames1([]);
      setConfusingNames2([]);
    }
  }, [difficulty]);

  const generateConfusingNames = async (originalName: string): Promise<string[]> => {
    try {
      const prompt = `Generate 3 similar names that could be confused with "${originalName}" but are different. 
      These names should sound similar or have similar characteristics but be distinct names.
      Return only the names, separated by commas, no explanations.`;
      
      const chat = startChat([], prompt);
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const names = response.text().split(',').map(name => name.trim()).filter(name => name.length > 0);
      
      // Ensure we have the original name plus 3 confusing alternatives
      return [originalName, ...names.slice(0, 3)];
    } catch (error) {
      console.error("Error generating confusing names:", error);
      // Fallback to predefined similar names
      const fallbackNames = {
        "Leonardo da Vinci": ["Leonardo da Vinci", "Leonardo DiCaprio", "Leonardo Fibonacci", "Leonardo Bruni"],
        "Michelangelo": ["Michelangelo", "Michelangelo Antonioni", "Michelangelo Merisi", "Michelangelo Rossi"],
        "Galileo Galilei": ["Galileo Galilei", "Galileo Ferraris", "Galileo Galileo", "Galileo Galilea"],
        "Dante Alighieri": ["Dante Alighieri", "Dante Gabriel Rossetti", "Dante Alighero", "Dante Alighero"],
        "Marco Polo": ["Marco Polo", "Marco Aurelio", "Marco Tullio", "Marco Pollo"]
      };
      
      return fallbackNames[originalName] || [originalName, "Alternative A", "Alternative B", "Alternative C"];
    }
  };

  const getDisplayName = (originalName: string, characterLabel: "A" | "B") => {
    // Sempre mostra solo "Personaggio A" o "Personaggio B" nelle chat
    // I nomi reali non devono mai apparire nelle conversazioni
    return `Personaggio ${characterLabel}`;
  };

  const getAIResponse = async (
    char: Character, 
    userInput: string, 
    chatHistory: Message[],
    otherCharName?: string
  ): Promise<string> => {
    let systemInstruction = t('ai.systemInstructions.character', {
      name: char.name,
      bio: char.snippet
    });

    // Add identity mystery instructions for all difficulty levels
    systemInstruction += `\n\nYou are playing an identity guessing game. You must NEVER reveal your name or identity directly in your responses. Do not say phrases like "I am [name]", "My name is", "I am known as", or any similar direct identification. Respond naturally to questions about your life, work, and experiences, but maintain an air of mystery about your exact identity. Let the user guess who you are through your descriptions and answers. You are Personaggio ${char === character1 ? 'A' : 'B'} in this conversation.`;

    // For easy mode, add context about knowing the other character
    if (difficulty === "easy" && otherCharName) {
      systemInstruction += `\n\nYou know that the other character is ${otherCharName}, but you don't know which character (A or B) they are. You should not reveal their identity either.`;
    }

    try {
      const chat: ChatSession = startChat([], systemInstruction);
      for (const msg of chatHistory) {
        if (msg.character === t('chat.you')) {
          await chat.sendMessage(msg.content);
        } else if (msg.character.includes(char.name)) {
          const result = await chat.sendMessage(userInput);
          const response = await result.response;
          const aiText = response.text();
          if (aiText.trim() !== msg.content.trim()) {
            console.warn(`Mismatch in conversation history. Expected "${msg.content}", got "${aiText}"`);
          }
        }
      }

      const result = await chat.sendMessage(userInput);
      const response = await result.response;
      const aiText = response.text();
      return aiText && aiText.trim() !== "" ? aiText.trim() : t('chat.noResponse');
    } catch (error) {
      console.error(`Error getting response from ${char.name}:`, error);
      return t('chat.errorResponse', { character: char.name });
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessageContent = input.trim();
    setInput("");
    setIsLoading(true);

    const userMessageObj: Message = { character: t('chat.you'), content: userMessageContent };
    setMessages1(prev => [...prev, userMessageObj]);
    setMessages2(prev => [...prev, userMessageObj]);

    const [response1Result, response2Result] = await Promise.allSettled([
      getAIResponse(character1, userMessageContent, messages1, character2.name),
      getAIResponse(character2, userMessageContent, messages2, character1.name)
    ]);

    if (response1Result.status === "fulfilled") {
      setMessages1(prev => [...prev, { character: "Personaggio A", content: response1Result.value }]);
    } else {
      console.error("Error from character 1:", response1Result.reason);
      setMessages1(prev => [...prev, { character: "Personaggio A", content: t('chat.technicalProblem') }]);
    }

    if (response2Result.status === "fulfilled") {
      setMessages2(prev => [...prev, { character: "Personaggio B", content: response2Result.value }]);
    } else {
      console.error("Error from character 2:", response2Result.reason);
      setMessages2(prev => [...prev, { character: "Personaggio B", content: t('chat.technicalProblem') }]);
    }
    
    setIsLoading(false);
  };
  
  const handleEndActivity = () => {
    if (difficulty === "hard" && (!userGuess1.trim() || !userGuess2.trim())) {
      toast.error(t('apps.aiIdentity.pleaseGuessBothCharacters'));
      return;
    }
    // For easy mode, go to identification phase instead of reflection
    if (difficulty === "easy") {
      setActivityPhase("identification");
    } else {
      setActivityPhase("reflection");
    }
  };

  const handleIdentificationComplete = (guess1: string, guess2: string) => {
    setUserGuess1(guess1);
    setUserGuess2(guess2);
    // After identification, go to reflection phase for easy mode
    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);
    setAiEvaluation(null);

    const combinedMessagesForEvaluation: EvaluationMessage[] = [];
    const processedUserMessages = new Set<string>();

    messages1.forEach((msg1, index) => {
      if (msg1.character === "Tu") {
        const userContent = msg1.content;
        if (!processedUserMessages.has(userContent + index)) {
          combinedMessagesForEvaluation.push({ role: "user", content: userContent });
          processedUserMessages.add(userContent + index);
        }

        const char1Response = messages1[index + 1];
        if (char1Response && !char1Response.character.includes("Tu")) {
          combinedMessagesForEvaluation.push({
            role: "assistant",
            content: char1Response.content,
            characterName: character1.name,
          });
        }

        const userMessageIndexInM2 = messages2.findIndex(
          (m2, m2Idx) => m2.character === "Tu" && m2.content === userContent && m2Idx >= index
        );

        if (userMessageIndexInM2 !== -1) {
          const char2Response = messages2[userMessageIndexInM2 + 1];
          if (char2Response && !char2Response.character.includes("Tu")) {
            combinedMessagesForEvaluation.push({
              role: "assistant",
              content: char2Response.content,
              characterName: character2.name,
            });
          }
        }
      }
    });
    
    try {
      const conversationData: ConversationData = {
        character: `${character1.name} & ${character2.name}`,
        topic: "Ai Identity",
        messages: combinedMessagesForEvaluation,
      };

      const evaluationResult = await getAIGameAndReflectionEvaluation(
        conversationData,
        reflection
      );
      
      let finalEvaluation = evaluationResult.textualFeedback;
      
      if (difficulty === "hard" || difficulty === "easy") {
        const correct1 = userGuess1.toLowerCase().trim() === character1.name.toLowerCase().trim();
        const correct2 = userGuess2.toLowerCase().trim() === character2.name.toLowerCase().trim();
        const guessResult = `\n\n${t('apps.aiIdentity.identificationResults')}:\n${t('apps.aiIdentity.character1')}: ${correct1 ? "✅" : "❌"} ${userGuess1} ${correct1 ? t('apps.aiIdentity.correct') : `(${t('apps.aiIdentity.wrong')}: ${character1.name})`}\n${t('apps.aiIdentity.character2')}: ${correct2 ? "✅" : "❌"} ${userGuess2} ${correct2 ? t('apps.aiIdentity.correct') : `(${t('apps.aiIdentity.wrong')}: ${character2.name})`}`;
        finalEvaluation += guessResult;
      }
      
      setAiEvaluation(finalEvaluation);
    } catch (error) {
      console.error("Error generating AI reflection evaluation:", error);
      const errorMessage = error instanceof Error ? error.message : t('errors.unknownError');
      setAiEvaluation(t('errors.evaluationError', { error: errorMessage }));
      toast.error(t('errors.aiEvaluationError'));
    } finally {
      setIsEvaluating(false);
    }
  };
  
  const getCombinedMessagesForDisplay = (): EvaluationMessage[] => {
    const combined: EvaluationMessage[] = [];
    let i = 0, j = 0;
    while (i < messages1.length || j < messages2.length) {
      if (i < messages1.length && messages1[i].character === "Tu") {
        combined.push({ role: "user", content: messages1[i].content });
        
        if (i + 1 < messages1.length && !messages1[i+1].character.includes("Tu")) {
          combined.push({ role: "assistant", content: messages1[i+1].content, characterName: character1.name });
        }
        
        const userMsgContent = messages1[i].content;
        const m2UserIdx = messages2.findIndex(m => m.character === "Tu" && m.content === userMsgContent);
        if (m2UserIdx !== -1 && m2UserIdx + 1 < messages2.length && !messages2[m2UserIdx+1].character.includes("Tu")) {
           combined.push({ role: "assistant", content: messages2[m2UserIdx+1].content, characterName: character2.name });
        }
        i += 2;
        if(m2UserIdx !== -1) j = m2UserIdx + 2;
      } else if (i < messages1.length) {
         combined.push({ role: "assistant", content: messages1[i].content, characterName: character1.name });
         i++;
      } else if (j < messages2.length && messages2[j].character !== "Tu") {
         combined.push({ role: "assistant", content: messages2[j].content, characterName: character2.name });
         j++;
      } else {
          break;
      }
    }
    return combined.filter(msg => !(msg.role === "assistant" && (msg.content.startsWith("Ciao, sono") || msg.content.startsWith("Benvenuto! Sono"))));
  };

  const generateConfusingNamesForCharacters = async () => {
    if (difficulty === "medium") {
      const [names1, names2] = await Promise.all([
        generateConfusingNames(character1.name),
        generateConfusingNames(character2.name)
      ]);
      setConfusingNames1(names1);
      setConfusingNames2(names2);
    }
  };

  const handleStartNewChat = () => {
    setMessages1([
      {
        character: "Personaggio A",
        content: t('apps.aiIdentity.greeting1'),
      },
    ]);
    setMessages2([
      {
        character: "Personaggio B", 
        content: t('apps.aiIdentity.greeting2'),
      },
    ]);
    setSelectedCharacter("all");
    setInput("");
    setUserGuess1("");
    setUserGuess2("");
    setActivityPhase("chatting");
    setUserReflection("");
    setAiEvaluation(null);
    setIsEvaluating(false);
    setConfusingNames1([]);
    setConfusingNames2([]);
    toast.success(t('apps.aiIdentity.newChatStarted'));
  };

  if (activityPhase === "identification") {
    return (
      <AppLayout
        title={t('apps.aiIdentity.title')}
        subtitle={t('apps.aiIdentity.subtitle')}
        onReset={handleStartNewChat}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          <AiIdentityIdentificationPhase
            character1Name={character1.name}
            character2Name={character2.name}
            character1Snippet={character1.snippet}
            character2Snippet={character2.snippet}
            onIdentificationComplete={handleIdentificationComplete}
          />
        </div>
      </AppLayout>
    );
  }

  if (activityPhase === "reflection") {
    return (
      <AppLayout
        title={t('apps.aiIdentity.title')}
        subtitle={t('apps.aiIdentity.subtitle')}
        onReset={handleStartNewChat}
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {difficulty === "hard" && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">{t('apps.aiIdentity.identifyCharacters')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="guess1">{t('apps.aiIdentity.character1Guess')}</Label>
                  <Input
                    id="guess1"
                    value={userGuess1}
                    onChange={(e) => setUserGuess1(e.target.value)}
                    placeholder={t('apps.aiIdentity.enterCharacterName')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="guess2">{t('apps.aiIdentity.character2Guess')}</Label>
                  <Input
                    id="guess2"
                    value={userGuess2}
                    onChange={(e) => setUserGuess2(e.target.value)}
                    placeholder={t('apps.aiIdentity.enterCharacterName')}
                    className="mt-1"
                  />
                </div>
              </div>
            </Card>
          )}
          
          <ReflectionInterface
            title={t('reflection.title', { activity: t('apps.aiIdentity.name') })}
            description={t('reflection.aiIdentityDescription')}
            onSubmit={handleReflectionSubmit}
            placeholder={t('reflection.aiIdentityPlaceholder')}
          />
        </div>
      </AppLayout>
    );
  }

  if (activityPhase === "feedback") {
    return (
      <AppLayout
        title={t('apps.aiIdentity.title')}
        subtitle={t('apps.aiIdentity.subtitle')}
        onReset={handleStartNewChat}
      >
        <FeedbackInterface
          userReflection={userReflection}
          aiEvaluation={aiEvaluation}
          isLoading={isEvaluating}
          onStartNewChat={handleStartNewChat}
          messages={getCombinedMessagesForDisplay()}
          characterName={`${character1.name} & ${character2.name}`}
          topic={t('apps.aiIdentity.name')}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t('apps.aiIdentity.title')}
      subtitle={t('apps.aiIdentity.subtitle')}
      onReset={handleStartNewChat}
    >
      {/* Difficulty Selector */}
      <Card className="mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="font-semibold mb-2">{t('apps.aiIdentity.difficulty')}</h3>
            <div className="flex gap-2">
              <Button
                variant={difficulty === "easy" ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty("easy")}
              >
                {t('apps.aiIdentity.easy')}
              </Button>
              <Button
                variant={difficulty === "medium" ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty("medium")}
              >
                {t('apps.aiIdentity.medium')}
              </Button>
              <Button
                variant={difficulty === "hard" ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty("hard")}
              >
                {t('apps.aiIdentity.hard')}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Character 1 Chat */}
        <Card className="bg-white/90 backdrop-blur-sm border-education/20">
          <div className="p-4 border-b border-education/20">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-education-dark">Personaggio A</h3>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setSelectedCharacter(selectedCharacter === character1.name ? "all" : character1.name)}
                className={`border-education/30 text-education hover:bg-education/10 ${
                  selectedCharacter === character1.name ? "bg-education text-white hover:bg-education-dark" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {selectedCharacter === character1.name ? t('apps.aiIdentity.backToAll') : t('apps.aiIdentity.onlyThis')}
              </Button>
            </div>
            {difficulty === "medium" && confusingNames1.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <p className="font-medium mb-1">{t('apps.aiIdentity.possibleNames')}:</p>
                <div className="flex flex-wrap gap-2">
                  {confusingNames1.map((name, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="h-[400px] overflow-y-auto p-4 space-y-3">
            {messages1.map((message, index) => (
              <div
                key={`char1-msg-${index}`}
                className={`flex ${message.character === t('chat.you') ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                    message.character === t('chat.you')
                      ? "bg-education text-white"
                      : "bg-blue-100 text-blue-900 border border-blue-200" 
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-80">{message.character}</p>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Character 2 Chat */}
        <Card className="bg-white/90 backdrop-blur-sm border-education/20">
          <div className="p-4 border-b border-education/20">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-education-dark">Personaggio B</h3>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setSelectedCharacter(selectedCharacter === character2.name ? "all" : character2.name)}
                className={`border-education/30 text-education hover:bg-education/10 ${
                  selectedCharacter === character2.name ? "bg-education text-white hover:bg-education-dark" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {selectedCharacter === character2.name ? t('apps.aiIdentity.backToAll') : t('apps.aiIdentity.onlyThis')}
              </Button>
            </div>
            {difficulty === "medium" && confusingNames2.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                <p className="font-medium mb-1">{t('apps.aiIdentity.possibleNames')}:</p>
                <div className="flex flex-wrap gap-2">
                  {confusingNames2.map((name, index) => (
                    <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="h-[400px] overflow-y-auto p-4 space-y-3">
            {messages2.map((message, index) => (
              <div
                key={`char2-msg-${index}`}
                className={`flex ${message.character === t('chat.you') ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg shadow-sm ${
                    message.character === t('chat.you')
                      ? "bg-education text-white"
                      : "bg-green-100 text-green-900 border border-green-200" 
                  }`}
                >
                  <p className="text-xs font-semibold mb-1 opacity-80">{message.character}</p>
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Unified Input */}
      <ChatInterface
        messages={[]}
        input={input}
        onInputChange={setInput}
        onSendMessage={handleSend}
        onEndActivity={handleEndActivity}
        isLoading={isLoading}
        placeholder={t('apps.aiIdentity.placeholder', { 
          target: selectedCharacter === "all" 
            ? t('apps.aiIdentity.placeholderAll') 
            : selectedCharacter === character1.name 
              ? "Personaggio A"
              : "Personaggio B"
        })}
        showEndButton={true}
        minMessagesForEnd={2}
        className="h-auto"
      />
    </AppLayout>
  );
};

export default AiIdentityChat;