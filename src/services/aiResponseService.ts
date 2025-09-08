/**
 * @file A service for generating AI responses for specific educational activities.
 * @remarks This service contains functions that interact with the core AI service (`aiService.ts`)
 * but are tailored with specific system prompts and logic for different games like "Convinci Tu".
 */

import { Message } from "@/types/conversation";
import { TFunction } from 'i18next';
import { startChat } from "@/services/aiService";
import { ChatSession } from "@google/generative-ai";

/**
 * @interface CharacterForAI
 * @description Defines the structure of a character object required for generating AI responses.
 * @property {string} title - The name of the character.
 * @property {string} snippet - A biographical snippet or context for the character.
 */
interface CharacterForAI {
  title: string;
  snippet: string;
}

/**
 * @function generateAIResponse
 * @description Generates a contextual AI response using Vertex AI for the "ConvinciTu" app.
 * It constructs a system prompt based on the character and topic and manages the conversation history.
 * @param {CharacterForAI | null} character - The character the AI should impersonate.
 * @param {string} topic - The topic of the persuasion conversation.
 * @param {Message[]} messages - The history of the conversation so far.
 * @param {TFunction} t - The translation function from `i18next`.
 * @returns {Promise<string>} A promise that resolves to the AI-generated response text.
 */
export const generateAIResponse = async (
  character: CharacterForAI | null,
  topic: string,
  messages: Message[],
  t: TFunction
): Promise<string> => {
  if (!character) {
    return "Seleziona un personaggio per iniziare la conversazione.";
  }

  const systemInstruction = t('ai.systemInstructions.convinciTu', {
    name: character.title,
    prompt: topic
  });

  try {
    const history = messages.slice(0, -1).map(msg => ({
      role: (msg.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: msg.content }]
    }));

    const chat: ChatSession = startChat(history, systemInstruction);
    const lastMessage = messages[messages.length - 1];

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const aiText = response.text();

    return aiText && aiText.trim() !== "" ? aiText.trim() : "Non so come rispondere a questo.";
  } catch (error) {
    console.error(`Error generating AI response for ${character.title}:`, error);
    let errorMessage = "Mi scuso, ma ho riscontrato un problema nel formulare una risposta.";
    if (error instanceof Error && error.message) {
        errorMessage += ` Dettagli: ${error.message}`;
    }
    return errorMessage;
  }
};