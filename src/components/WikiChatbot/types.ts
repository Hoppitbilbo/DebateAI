/**
 * @file Defines the TypeScript types used in the WikiChatbot component.
 */

/**
 * @interface WikiChatMessage
 * @description Represents a single message within the WikiChatbot conversation.
 * @property {"user" | "assistant" | "system"} role - The origin of the message. 'user' for the human user, 'assistant' for the AI, and 'system' for initial instructions.
 * @property {string} content - The textual content of the message.
 */
export interface WikiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * @interface WikiChatProps
 * @description Defines the props required to initialize the WikiChatbot.
 * @property {string} wikiTitle - The title of the Wikipedia article being discussed.
 * @property {string} wikiSummary - The summary of the Wikipedia article, used as context for the AI.
 */
export interface WikiChatProps {
  wikiTitle: string;
  wikiSummary: string;
}
