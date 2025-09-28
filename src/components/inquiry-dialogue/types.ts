/**
 * Type definitions for the InquiryDialogueChat component
 */

export interface Character {
  name: string;
  wikiTitle: string;
  bio: string;
  dialogueStyle: string;
}

export interface Message {
  role: "character1" | "character2" | "system" | "user";
  character: string;
  content: string;
}

export interface InquiryDialogueChatProps {
  characters: [Character, Character];
  theme: string;
}