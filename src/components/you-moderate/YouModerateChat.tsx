
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Character, Message } from "./types"; // Assuming Character is defined in ./types
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import CharacterProfiles from "./CharacterProfiles";
import { generateCharacterResponse } from "@/utils/characterDialogueUtils";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

// Define the props for YouModerateChat, including the new handlers
interface YouModerateChatProps {
  characters: [Character, Character];
  theme: string;
  onMessagesUpdate: (messages: Message[]) => void;
  handleEndChat: () => void;
}

const YouModerateChat = ({ characters, theme, onMessagesUpdate, handleEndChat }: YouModerateChatProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: "system",
      character: "System",
      content: t('apps.youModerate.chat.systemMessage', { char1: characters[0].name, char2: characters[1].name, theme }),
    },
    // Initial messages from characters can be uncommented if desired, or handled by generateCharacterResponse
    // {
    //   role: "character1",
    //   character: characters[0].name,
    //   content: generateCharacterResponse(characters[0], characters[1], theme, [{role: "system", character: "System", content: ""}], "Inizia il tuo intervento."),
    // },
    // {
    //   role: "character2",
    //   character: characters[1].name,
    //   content: generateCharacterResponse(characters[1], characters[0], theme, [{role: "system", character: "System", content: ""}], "Rispondi all'intervento iniziale."),
    // }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string>("all"); // 'all', characters[0].name, or characters[1].name
  const [nextSpeaker, setNextSpeaker] = useState<"character1" | "character2">("character1");

  // useEffect to call onMessagesUpdate when messages change
  useEffect(() => {
    onMessagesUpdate(messages);
  }, [messages, onMessagesUpdate]);

  const addMessage = (newMessage: Message) => {
    setMessages(prev => [...prev, newMessage]);
  };

  const handleUserInput = async (userMessage: string) => {
    if (isLoading) return;
    setIsLoading(true);

    addMessage({
      role: "user",
      character: "Moderatore",
      content: userMessage
    });

    // Determine which character should respond
    const characterToRespond = selectedCharacter === "all" 
      ? (nextSpeaker === "character1" ? characters[0] : characters[1]) 
      : (characters.find(c => c.name === selectedCharacter) || (nextSpeaker === "character1" ? characters[0] : characters[1]));
    
    const otherCharacter = characterToRespond.name === characters[0].name ? characters[1] : characters[0];
    const respondingRole = characterToRespond.name === characters[0].name ? "character1" : "character2";

    try {
      // Use a slice of recent messages for context
      const contextMessages = messages.slice(-4); 
      const aiResponse = await generateCharacterResponse(characterToRespond, otherCharacter, theme, contextMessages, userMessage, isLoading);
      addMessage({
        role: respondingRole,
        character: characterToRespond.name,
        content: aiResponse
      });
      // Toggle next speaker if 'all' was selected
      if (selectedCharacter === "all") {
        setNextSpeaker(respondingRole === "character1" ? "character2" : "character1");
      }
    } catch (error) {
      console.error("Error generating character response:", error);
      addMessage({
        role: "system",
        character: "System",
        content: t('apps.youModerate.chat.errorMessage')
      });
    }
    setIsLoading(false);
  };

  const handleContinueDialogue = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    const characterToSpeak = nextSpeaker === "character1" ? characters[0] : characters[1];
    const otherCharacter = nextSpeaker === "character1" ? characters[1] : characters[0];
    const speakerRole = nextSpeaker;

    try {
      const contextMessages = messages.slice(-4);
      const aiResponse = await generateCharacterResponse(characterToSpeak, otherCharacter, theme, contextMessages, undefined, isLoading);
      addMessage({
        role: speakerRole,
        character: characterToSpeak.name,
        content: aiResponse
      });
      setNextSpeaker(nextSpeaker === "character1" ? "character2" : "character1");
    } catch (error) {
      console.error("Error generating character response:", error);
      addMessage({
        role: "system",
        character: "System",
        content: t('apps.youModerate.chat.autoErrorMessage')
      });
    }
    setIsLoading(false);
  };
  
  return (
    <div className="space-y-4">
      <Card className="flex flex-col w-full h-[700px] rounded-lg overflow-hidden shadow-lg border border-gray-700 bg-gray-800">
        <Tabs defaultValue="dialogue" className="flex flex-col h-full">
          <div className="bg-education p-2 text-white flex justify-between items-center">
            <TabsList className="grid grid-cols-2 w-full bg-gray-700">
              <TabsTrigger value="dialogue" className="data-[state=active]:bg-education-dark data-[state=active]:text-white">{t('apps.youModerate.chat.dialogueTab')}</TabsTrigger>
              <TabsTrigger value="characters" className="data-[state=active]:bg-education-dark data-[state=active]:text-white">{t('apps.youModerate.chat.charactersTab')}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dialogue" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
            <ChatMessages messages={messages} isLoading={isLoading} />
            <ChatInput 
              characters={characters}
              selectedCharacter={selectedCharacter}
              setSelectedCharacter={setSelectedCharacter}
              nextSpeaker={nextSpeaker} // Keep if ChatInput uses it for UI hints
              onSendMessage={handleUserInput}
              onContinueDialogue={handleContinueDialogue}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="characters" className="flex-1 overflow-y-auto p-4 m-0 bg-gray-800">
            <CharacterProfiles characters={characters} theme={theme} />
          </TabsContent>
        </Tabs>
      </Card>
      
      <Button 
        variant="outline" 
        onClick={handleEndChat} // Changed to call the prop
        disabled={isLoading || messages.length < 3} // Adjusted threshold for ending chat
        className="w-full bg-accent hover:bg-accent-dark text-white py-2.5 border-accent-dark hover:border-accent-darker"
      >
        <BookOpen className="mr-2 h-4 w-4" /> {t('apps.youModerate.chat.endDialogueButton')}
      </Button>
    </div>
  );
};

export default YouModerateChat;
