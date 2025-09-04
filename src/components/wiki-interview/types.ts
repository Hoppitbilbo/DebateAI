
/**
 * Type definitions for the WikiInterviewChat component
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

export interface WikiInterviewChatProps {
  characters: [Character, Character];
  theme: string;
}
