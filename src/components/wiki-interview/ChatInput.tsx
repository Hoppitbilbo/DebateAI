/**
 * @file Renders the input section for the WikiInterview chat.
 * @remarks This component includes controls for selecting which character to address,
 * an input field for the user's message, and buttons to send a message or continue the dialogue.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, MessageCircle, Send } from "lucide-react";
import { Character } from "./types";
import { useTranslation } from "react-i18next";

/**
 * @interface ChatInputProps
 * @description Defines the props for the ChatInput component.
 * @property {[Character, Character]} characters - The two characters in the interview.
 * @property {string} selectedCharacter - The name of the character currently being addressed ("all" for both).
 * @property {(name: string) => void} setSelectedCharacter - Callback to set the character to be addressed.
 * @property {"character1" | "character2"} nextSpeaker - Indicates which character is scheduled to speak next.
 * @property {(message: string) => void} onSendMessage - Callback to send a message from the user.
 * @property {() => void} onContinueDialogue - Callback to prompt the next character to speak without user input.
 * @property {boolean} isLoading - Flag indicating if an AI response is being generated.
 */
interface ChatInputProps {
  characters: [Character, Character];
  selectedCharacter: string;
  setSelectedCharacter: (name: string) => void;
  nextSpeaker: "character1" | "character2";
  onSendMessage: (message: string) => void;
  onContinueDialogue: () => void;
  isLoading: boolean;
}

/**
 * @function ChatInput
 * @description A component that provides the user with controls for interacting with the interview chat.
 * @param {ChatInputProps} props - The props for the component.
 * @returns {JSX.Element} The rendered chat input section.
 */
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

  /**
   * @function handleSend
   * @description Trims the user input and calls the onSendMessage callback.
   */
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
            {selectedCharacter === name ? t('apps.wikiInterview.chat.speakToAll') : t('apps.wikiInterview.chat.speakTo', { name })}
          </Button>
        ))}
      </div>
      
      <div className="flex gap-2">
        <Input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder={selectedCharacter === "all" ? t('apps.wikiInterview.chat.askBothPlaceholder') : t('apps.wikiInterview.chat.askCharacterPlaceholder', { character: selectedCharacter })}
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
        <ArrowRight className="h-4 w-4 mr-2" /> {t('apps.wikiInterview.chat.nextIntervention', { character: nextSpeaker === "character1" ? characters[0].name : characters[1].name })}
      </Button>
    </div>
  );
};

export default ChatInput;
