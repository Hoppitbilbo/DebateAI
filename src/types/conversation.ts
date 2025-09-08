/**
 * @file Defines common TypeScript types related to conversations and activities.
 */

/**
 * @interface Message
 * @description Represents a single message within any conversation in the application.
 * @property {string} [id] - An optional unique identifier for the message.
 * @property {'user' | 'assistant' | 'system' | 'character'} role - The role of the message sender.
 * @property {string} content - The textual content of the message.
 * @property {string} [characterName] - The name of the character speaking, if the role is 'assistant' or 'character'.
 * @property {string} [timestamp] - An optional timestamp for when the message was created.
 */
export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'character';
  content: string;
  characterName?: string;
  timestamp?: string;
}

/**
 * @interface CharacterProfile
 * @description Defines the structure for a character's profile information.
 * @property {string} name - The character's name.
 * @property {string} shortBio - A brief biography for the character.
 * @property {string} longBio - A more detailed biography for the character.
 * @property {string} [imageUrl] - An optional URL to an image of the character.
 */
export interface CharacterProfile {
  name: string;
  shortBio: string;
  longBio: string;
  imageUrl?: string;
}

/**
 * @interface ConversationState
 * @description Represents the state of a conversation at any given time.
 * @property {Message[]} messages - The list of messages in the conversation.
 * @property {boolean} isLoading - A flag indicating if a response is currently being loaded.
 * @property {string | null} error - An error message, if any error has occurred.
 */
export interface ConversationState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

/**
 * @type ActivityPhase
 * @description Defines the possible phases of an educational activity.
 * 'chatting': The user is actively conversing with the AI.
 * 'reflection': The user is in the self-reflection phase.
 * 'feedback': The user is viewing the feedback and evaluation.
 */
export type ActivityPhase = "chatting" | "reflection" | "feedback";
