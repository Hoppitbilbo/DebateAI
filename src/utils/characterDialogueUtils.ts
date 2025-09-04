
/**
 * Utility functions for generating character dialogue in the WikiInterviewChat
 */

import { Character } from "@/components/wiki-interview/types";
import { Message } from "@/types/conversation";
import { model } from "@/services/aiService"; // Correctly import the model from Firebase setup
import { buildDialogueSystemInstruction, buildDialoguePrompt, getErrorMessage, getTranslatedLabel } from "@/utils/aiPromptUtils";

/**
 * Generates a character response based on context using the Vertex AI model from Firebase.
 */
export const generateCharacterResponse = async (
  fromCharacter: Character,
  toCharacter: Character,
  theme: string,
  recentMessages: Array<{role: string; character: string; content: string}>,
  userMessage?: string,
  // isLoading is passed from WikiInterviewChat, keep in signature for compatibility
  // but not directly used by the model call itself here.
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

  // For debugging the prompt structure:
  // console.log("System Instruction for Vertex:", systemInstruction);
  // console.log("User Prompt for Vertex:", userPrompt);

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { 
        role: "system", // Role for system instruction should be 'system'
        parts: [{ text: systemInstruction }] 
      },
      // Optional: Add generationConfig if needed, e.g., maxOutputTokens, temperature
      // generationConfig: {
      //   maxOutputTokens: 100, 
      //   temperature: 0.7,
      // }
    });
    const response = await result.response;
    const aiResponseText = response.text();
    
    // Ensure the response is not empty or just whitespace
    return aiResponseText && aiResponseText.trim() !== "" ? aiResponseText.trim() : getErrorMessage('noResponse');
  } catch (error) {
    console.error("Error generating character response from Vertex AI:", error);
    const errorDetails = error instanceof Error ? error.message : undefined;
    return getErrorMessage('apologeticError', errorDetails);
  }
};

/**
 * Converts an array of chat messages to a readable string format
 */
export const conversationToString = (messages: Message[]): string => {
  return messages.map(msg => {
    const speaker = msg.role === "user" ? getTranslatedLabel('user') :
                   msg.role === "system" ? getTranslatedLabel('system') :
                   msg.characterName || "AI";

    return `${speaker}: ${msg.content}`;
  }).join('');
};
