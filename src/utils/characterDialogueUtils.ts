/**
 * @file Utility functions for generating character dialogue in the WikiInterviewChat.
 * @remarks These functions build the necessary prompts and interact with the AI service
 * to generate responses for characters in a dialogue.
 */

import { Character } from "@/components/wiki-interview/types";
import { Message } from "@/types/conversation";
import { model } from "@/services/aiService";
import { buildDialogueSystemInstruction, buildDialoguePrompt, getErrorMessage, getTranslatedLabel } from "@/utils/aiPromptUtils";

/**
 * @function generateCharacterResponse
 * @description Generates a character's response based on the dialogue context using the Vertex AI model.
 * @param {Character} fromCharacter - The character who is speaking.
 * @param {Character} toCharacter - The character being spoken to.
 * @param {string} theme - The theme of the conversation.
 * @param {Array<{role: string; character: string; content: string}>} recentMessages - The recent history of the conversation.
 * @param {string} [userMessage] - An optional message from the user/moderator to incorporate into the prompt.
 * @param {boolean} [isLoading] - A loading flag, passed for compatibility but not used directly in this function.
 * @returns {Promise<string>} A promise that resolves to the AI-generated dialogue for the character.
 */
export const generateCharacterResponse = async (
  fromCharacter: Character,
  toCharacter: Character,
  theme: string,
  recentMessages: Array<{role: string; character: string; content: string}>,
  userMessage?: string,
  isLoading?: boolean 
): Promise<string> => {

  const systemInstruction = buildDialogueSystemInstruction(
    fromCharacter.name,
    fromCharacter.bio,
    fromCharacter.dialogueStyle
  );

  const userPrompt = buildDialoguePrompt(
    fromCharacter.name,
    toCharacter.name,
    theme,
    recentMessages,
    userMessage
  );

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { 
        role: "system",
        parts: [{ text: systemInstruction }] 
      },
    });
    const response = await result.response;
    const aiResponseText = response.text();
    
    return aiResponseText && aiResponseText.trim() !== "" ? aiResponseText.trim() : getErrorMessage('noResponse');
  } catch (error) {
    console.error("Error generating character response from Vertex AI:", error);
    const errorDetails = error instanceof Error ? error.message : undefined;
    return getErrorMessage('apologeticError', errorDetails);
  }
};

/**
 * @function conversationToString
 * @description Converts an array of chat messages into a single, readable string format.
 * @param {Message[]} messages - The array of message objects.
 * @returns {string} A string representation of the conversation.
 */
export const conversationToString = (messages: Message[]): string => {
  return messages.map(msg => {
    const speaker = msg.role === "user" ? getTranslatedLabel('user') :
                   msg.role === "system" ? getTranslatedLabel('system') :
                   msg.characterName || "AI";

    return `${speaker}: ${msg.content}`;
  }).join('\n');
};
