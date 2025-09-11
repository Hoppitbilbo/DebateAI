
/**
 * Type definitions for the YouModerateChat component
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

export interface YouModerateChatProps {
  characters: [Character, Character];
  theme: string;
}
