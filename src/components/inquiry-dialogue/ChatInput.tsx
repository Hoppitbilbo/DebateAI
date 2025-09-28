import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MessageCircle, Send } from "lucide-react";
import { Character } from "./types";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  characters: [Character, Character];
  selectedCharacter: string;
  setSelectedCharacter: (name: string) => void;
  nextSpeaker: "character1" | "character2";
  onSendMessage: (message: string) => void;
  onContinueDialogue: () => void;
  isLoading: boolean;
}

const ChatInput = ({ 
  characters, 
  selectedCharacter, 
  setSelectedCharacter, 
  nextSpeaker,
  onSendMessage,
  onContinueDialogue,
  isLoading
}: ChatInputProps) => {
  const { t } = useTranslation();
  const [userInput, setUserInput] = useState("");

  const handleSend = () => {
    if (!userInput.trim() || isLoading) return;
    onSendMessage(userInput.trim());
    setUserInput("");
  };

  return (
    <div className="p-4 border-t space-y-4">
      <div className="flex gap-2">
        {[characters[0].name, characters[1].name].map((name) => (
          <Button
            key={name}
            variant="outline"
            onClick={() => setSelectedCharacter(selectedCharacter === name ? "all" : name)}
            className={selectedCharacter === name ? "bg-education text-white" : ""}
          >
            <MessageCircle className="h-4 w-4 mr-2" />
            {selectedCharacter === name ? t('apps.inquiryDialogue.chat.speakToAll') : t('apps.inquiryDialogue.chat.speakTo', { name })}
          </Button>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder={selectedCharacter === "all" ? t('apps.inquiryDialogue.chat.askBothPlaceholder') : t('apps.inquiryDialogue.chat.askCharacterPlaceholder', { character: selectedCharacter })}
          disabled={isLoading}
        />
        <Button onClick={handleSend} disabled={isLoading || !userInput.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <Button 
        onClick={onContinueDialogue} 
        disabled={isLoading}
        className="w-full"
      >
        <ArrowRight className="h-4 w-4 mr-2" /> {t('apps.inquiryDialogue.chat.nextIntervention', { character: nextSpeaker === "character1" ? characters[0].name : characters[1].name })}
      </Button>
    </div>
  );
};

export default ChatInput;