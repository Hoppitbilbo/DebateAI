import { GoogleGenerativeAI, GenerativeModel, ChatSession, GenerateContentRequest, GenerateContentResult, Part } from "@google/generative-ai";

// Get the API key from environment variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;

if (apiKey) {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
  }
} else {
  console.warn("Gemini API key is not configured. AI Service will be disabled.");
}

/**
 * Checks if the AI service is available and configured.
 */
export const isAiServiceAvailable = (): boolean => {
  return !!model;
};

/**
 * Starts a new chat session with the generative model.
 * @param history - Optional chat history to initialize the session.
 * @returns A new ChatSession instance.
 */
export const startChat = (
  history: { role: "user" | "model"; parts: Part[] }[] = [],
  systemInstructionText?: string
): ChatSession => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot start chat.");
  }

  const chatOptions: { history: { role: "user" | "model"; parts: Part[] }[], systemInstruction?: { role: string, parts: Part[] } } = { history };

  if (systemInstructionText) {
    chatOptions.systemInstruction = {
      role: 'system',
      parts: [{ text: systemInstructionText }],
    };
  }

  return model.startChat(chatOptions);
};

/**
 * Sends a message in an ongoing chat session.
 * @param chat - The ChatSession instance.
 * @param message - The message to send.
 * @returns The model's response text.
 */
export const sendMessage = async (chat: ChatSession, message: string): Promise<string> => {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    return "Mock response: AI service is not available.";
  }
  const result = await chat.sendMessage(message);
  const response = await result.response;
  return response.text();
};

/**
 * Generates content from the model based on a request.
 * @param request - The content generation request.
 * @returns The generated content result.
 */
export const generateContent = async (request: GenerateContentRequest): Promise<GenerateContentResult> => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate content.");
  }
  return model.generateContent(request);
};

/**
 * A versatile function to get a response for a given prompt, with optional system instructions.
 * @param prompt - The user prompt text.
 * @param systemInstructionText - Optional system instruction text.
 * @returns The model's response text.
 */
export const getResponse = async (prompt: string, systemInstructionText?: string): Promise<string> => {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    return "Mock response: AI service is not available.";
  }

  try {
    const systemInstruction: { role: "system"; parts: Part[] } | undefined = systemInstructionText
      ? { role: "system", parts: [{ text: systemInstructionText }] }
      : undefined;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    });

    const response = result.response;
    return response.text();
  } catch (error) {
    console.error("Error getting response from AI service:", error);
    throw error;
  }
};

/**
 * Generates streaming content from the model based on a request.
 * @param request - The content generation request.
 * @returns An async generator that yields text chunks.
 */
export const generateContentStream = async function* (request: GenerateContentRequest): AsyncGenerator<string, void, unknown> {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate streaming content.");
  }
  
  try {
    const result = await model.generateContentStream(request);
    
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  } catch (error) {
    console.error("Error generating streaming content:", error);
    throw error;
  }
};

/**
 * A streaming version of getResponse that yields text chunks as they arrive.
 * @param prompt - The user prompt text.
 * @param systemInstructionText - Optional system instruction text.
 * @returns An async generator that yields text chunks.
 */
export const getResponseStream = async function* (prompt: string, systemInstructionText?: string): AsyncGenerator<string, void, unknown> {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    yield "Mock response: AI service is not available.";
    return;
  }

  try {
    const systemInstruction: { role: "system"; parts: Part[] } | undefined = systemInstructionText
      ? { role: "system", parts: [{ text: systemInstructionText }] }
      : undefined;

    const request: GenerateContentRequest = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction,
    };

    yield* generateContentStream(request);
  } catch (error) {
    console.error("Error getting streaming response from AI service:", error);
    throw error;
  }
};

export { model }; // Exporting model for direct use if needed