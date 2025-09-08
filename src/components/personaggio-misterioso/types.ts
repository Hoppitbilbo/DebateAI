/**
 * @file Defines the TypeScript types used in the Personaggio Misterioso game.
 */

/**
 * @interface WikiCharacter
 * @description Represents a character selected from Wikipedia.
 * @property {string} title - The name of the character.
 * @property {string} snippet - A brief description of the character from Wikipedia.
 * @property {number} pageid - The unique identifier for the Wikipedia page.
 */
export interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @interface Message
 * @description Represents a single message in the game's conversation.
 * @property {"user" | "character"} role - The sender of the message. 'user' is the player, 'character' is the AI.
 * @property {string} content - The textual content of the message.
 */
export interface Message {
  role: "user" | "character";
  content: string;
}
