import { useState } from "react";
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
import { ChatSession } from "@google/generative-ai";

interface Character {
  name: string;
  snippet: string; // This will be used as the bio/context for the AI
}

interface Message { // This is the local Message type for DoppiaIntervista display
  character: string; // "Tu" (User), or character.name
  content: string;
}

interface DoppiaIntervistaChatProps {
  character1: Character;
  character2: Character;
}

const DoppiaIntervistaChat = ({ character1, character2 }: DoppiaIntervistaChatProps) => {
  const { t } = useTranslation();
  
  const [messages1, setMessages1] = useState<Message[]>([
    {
      character: character1.name,
      content: t('apps.doppiaIntervista.greeting1', { name: character1.name }),
    },
  ]);

  const [messages2, setMessages2] = useState<Message[]>([
    {
      character: character2.name,
      content: t('apps.doppiaIntervista.greeting2', { name: character2.name }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all"); 
  
  const [activityPhase, setActivityPhase] = useState<"chatting" | "reflection" | "feedback">("chatting");
  const [userReflection, setUserReflection] = useState("");
  const [aiEvaluation, setAiEvaluation] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const getAIResponse = async (
    char: Character, 
    userInput: string, 
    chatHistory: Message[]
  ): Promise<string> => {
    const systemInstruction = t('ai.systemInstructions.character', {
      name: char.name,
      bio: char.snippet
    });

    try {
      const chat: ChatSession = startChat([], systemInstruction);
      for (const msg of chatHistory) {
        if (msg.character === t('chat.you')) {
          await chat.sendMessage(msg.content);
        } else if (msg.character === char.name) {
          // This is a message from the assistant, so we need to make sure the history is correct
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
      getAIResponse(character1, userMessageContent, messages1),
      getAIResponse(character2, userMessageContent, messages2)
    ]);

    if (response1Result.status === "fulfilled") {
      setMessages1(prev => [...prev, { character: character1.name, content: response1Result.value }]);
    } else {
      console.error("Error from character 1:", response1Result.reason);
      setMessages1(prev => [...prev, { character: character1.name, content: t('chat.technicalProblem') }]);
    }

    if (response2Result.status === "fulfilled") {
      setMessages2(prev => [...prev, { character: character2.name, content: response2Result.value }]);
    } else {
      console.error("Error from character 2:", response2Result.reason);
      setMessages2(prev => [...prev, { character: character2.name, content: t('chat.technicalProblem') }]);
    }
    
    setIsLoading(false);
  };
  
  const handleEndActivity = () => {
    setActivityPhase("reflection");
  };

  const handleReflectionSubmit = async (reflection: string) => {
    setUserReflection(reflection);
    setActivityPhase("feedback");
    setIsEvaluating(true);
    setAiEvaluation(null);

    // Construct combined messages for evaluation and feedback display
    const combinedMessagesForEvaluation: EvaluationMessage[] = [];
    const processedUserMessages = new Set<string>(); // To handle cases where user asks same question multiple times if needed

    messages1.forEach((msg1, index) => {
      if (msg1.character === "Tu") {
        const userContent = msg1.content;
        // Add user message once
        if (!processedUserMessages.has(userContent + index)) { // Add index to ensure uniqueness if same question is asked
          combinedMessagesForEvaluation.push({ role: "user", content: userContent });
          processedUserMessages.add(userContent + index);
        }

        // Find corresponding response from character1
        const char1Response = messages1[index + 1];
        if (char1Response && char1Response.character === character1.name) {
          combinedMessagesForEvaluation.push({
            role: "assistant",
            content: char1Response.content,
            characterName: character1.name,
          });
        }

        // Find corresponding response from character2
        // This requires finding the same user message in messages2's timeline
        const userMessageIndexInM2 = messages2.findIndex(
          (m2, m2Idx) => m2.character === "Tu" && m2.content === userContent && m2Idx >= index // Search from a similar point
        );

        if (userMessageIndexInM2 !== -1) {
          const char2Response = messages2[userMessageIndexInM2 + 1];
          if (char2Response && char2Response.character === character2.name) {
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
        topic: "Doppia Intervista", // Or a more specific topic
        messages: combinedMessagesForEvaluation,
      };

      const evaluationResult = await getAIGameAndReflectionEvaluation(
        conversationData,
        reflection
      );
      setAiEvaluation(evaluationResult.textualFeedback);
    } catch (error) {
      console.error("Error generating AI reflection evaluation:", error);
      const errorMessage = error instanceof Error ? error.message : t('errors.unknownError');
      setAiEvaluation(t('errors.evaluationError', { error: errorMessage }));
      toast.error(t('errors.aiEvaluationError'));
    } finally {
      setIsEvaluating(false);
    }
  };
  
  // Helper to get combined messages for feedback display
  const getCombinedMessagesForDisplay = (): EvaluationMessage[] => {
    const combined: EvaluationMessage[] = [];
    let i = 0, j = 0;
    while (i < messages1.length || j < messages2.length) {
      // Prioritize user messages from messages1 as the primary timeline
      if (i < messages1.length && messages1[i].character === "Tu") {
        combined.push({ role: "user", content: messages1[i].content });
        // Add char1's response if it exists
        if (i + 1 < messages1.length && messages1[i+1].character === character1.name) {
          combined.push({ role: "assistant", content: messages1[i+1].content, characterName: character1.name });
        }
        // Try to find corresponding char2 response
        const userMsgContent = messages1[i].content;
        const m2UserIdx = messages2.findIndex(m => m.character === "Tu" && m.content === userMsgContent);
        if (m2UserIdx !== -1 && m2UserIdx + 1 < messages2.length && messages2[m2UserIdx+1].character === character2.name) {
           combined.push({ role: "assistant", content: messages2[m2UserIdx+1].content, characterName: character2.name });
        }
        i += 2; // Move past user and assistant message in m1
        // Advance j in messages2 past this user interaction
        if(m2UserIdx !== -1) j = m2UserIdx + 2;
      } else if (i < messages1.length) { // char1 message without a preceding user message (e.g. initial)
         combined.push({ role: "assistant", content: messages1[i].content, characterName: character1.name });
         i++;
      } else if (j < messages2.length && messages2[j].character !== "Tu") { // char2 message without a preceding user message
         combined.push({ role: "assistant", content: messages2[j].content, characterName: character2.name });
         j++;
      } else { // Safety break for infinite loops, though logic should prevent this
          break;
      }
    }
     // Filter out initial system messages if they are not desired in the final display
    return combined.filter(msg => !(msg.role === "assistant" && (msg.content.startsWith("Ciao, sono ") || msg.content.startsWith("Benvenuto! Sono"))));
  };


  const handleStartNewChat = () => {
    setMessages1([
      {
        character: character1.name,
        content: t('apps.doppiaIntervista.greeting1', { name: character1.name }),
      },
    ]);
    setMessages2([
      {
        character: character2.name,
        content: t('apps.doppiaIntervista.greeting2', { name: character2.name }),
      },
    ]);
    setSelectedCharacter("all");
    setInput("");
    setActivityPhase("chatting");
    setUserReflection("");
    setAiEvaluation(null);
    setIsEvaluating(false);
    toast.success(t('apps.doppiaIntervista.newInterviewStarted'));
  };

  if (activityPhase === "reflection") {
    return (
      <AppLayout
        title={t('apps.doppiaIntervista.title')}
        subtitle={t('apps.doppiaIntervista.subtitle')}
        onReset={handleStartNewChat}
      >
        <ReflectionInterface
          title={t('reflection.title', { activity: t('apps.doppiaIntervista.name') })}
          description={t('reflection.doppiaIntervistaDescription')}
          onSubmit={handleReflectionSubmit}
          placeholder={t('reflection.doppiaIntervistaPlaceholder', { char1: character1.name, char2: character2.name })}
        />
      </AppLayout>
    );
  }

  if (activityPhase === "feedback") {
    return (
      <AppLayout
        title={t('apps.doppiaIntervista.title')}
        subtitle={t('apps.doppiaIntervista.subtitle')}
        onReset={handleStartNewChat}
      >
        <FeedbackInterface
          userReflection={userReflection}
          aiEvaluation={aiEvaluation}
          isLoading={isEvaluating}
          onStartNewChat={handleStartNewChat}
          messages={getCombinedMessagesForDisplay()}
          characterName={`${character1.name} & ${character2.name}`}
          topic={t('apps.doppiaIntervista.name')}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={t('apps.doppiaIntervista.title')}
      subtitle={t('apps.doppiaIntervista.subtitle')}
      onReset={handleStartNewChat}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Character 1 Chat */}
        <Card className="bg-white/90 backdrop-blur-sm border-education/20">
          <div className="p-4 border-b border-education/20">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-education-dark">{character1.name}</h3>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setSelectedCharacter(selectedCharacter === character1.name ? "all" : character1.name)}
                className={`border-education/30 text-education hover:bg-education/10 ${
                  selectedCharacter === character1.name ? "bg-education text-white hover:bg-education-dark" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {selectedCharacter === character1.name ? t('apps.doppiaIntervista.backToAll') : t('apps.doppiaIntervista.onlyThis')}
              </Button>
            </div>
          </div>
          <div className="h-[400px] overflow-y-auto p-4 space-y-3">
            {messages1.map((message, index) => (
              <div
                key={`${character1.name}-msg-${index}`}
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
              <h3 className="text-lg font-bold text-education-dark">{character2.name}</h3>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setSelectedCharacter(selectedCharacter === character2.name ? "all" : character2.name)}
                className={`border-education/30 text-education hover:bg-education/10 ${
                  selectedCharacter === character2.name ? "bg-education text-white hover:bg-education-dark" : ""
                }`}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {selectedCharacter === character2.name ? t('apps.doppiaIntervista.backToAll') : t('apps.doppiaIntervista.onlyThis')}
              </Button>
            </div>
          </div>
          <div className="h-[400px] overflow-y-auto p-4 space-y-3">
            {messages2.map((message, index) => (
              <div
                key={`${character2.name}-msg-${index}`}
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
        messages={[]} // We handle messages separately above
        input={input}
        onInputChange={setInput}
        onSendMessage={handleSend}
        onEndActivity={handleEndActivity}
        isLoading={isLoading}
        placeholder={t('apps.doppiaIntervista.placeholder', { 
          target: selectedCharacter === "all" 
            ? t('apps.doppiaIntervista.placeholderAll') 
            : t('apps.doppiaIntervista.placeholderSingle', { name: selectedCharacter })
        })}
        showEndButton={true}
        minMessagesForEnd={2}
        className="h-auto"
      />
    </AppLayout>
  );
};

export default DoppiaIntervistaChat;