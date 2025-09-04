
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'character';
  content: string;
  characterName?: string;
  timestamp?: string;
}

export interface CharacterProfile {
  name: string;
  shortBio: string;
  longBio: string;
  imageUrl?: string;
}

export interface ConversationState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export type ActivityPhase = "chatting" | "reflection" | "feedback";
