import { Message } from "@/types/conversation";
import { TFunction } from 'i18next';
import { startChat } from "@/services/aiService"; // Import the startChat instance
import { ChatSession } from "@google/generative-ai";

// Define a more specific character type, expecting title and snippet
interface CharacterForAI {
  title: string;
  snippet: string;
}

/**
 * Generates a contextual AI response using Vertex AI for the ConvinciTu app.
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