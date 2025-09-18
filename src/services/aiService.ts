import { GoogleGenerativeAI, GenerativeModel, ChatSession, GenerateContentRequest, GenerateContentResult, Part } from "@google/generative-ai";

const API_KEY_STORAGE_KEY = 'gemini_api_key';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Gets the API key from session storage or environment variables (fallback)
 */
const getApiKey = (): string | null => {
  // First try session storage
  const sessionApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
  if (sessionApiKey && sessionApiKey.trim()) {
    return sessionApiKey.trim();
  }
  
  // Fallback to environment variable
  const envApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envApiKey && envApiKey !== 'your_api_key_here') {
    return envApiKey;
  }
  
  return null;
};

/**
 * Initializes the AI service with the current API key
 */
const initializeAiService = (): boolean => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn("No Gemini API key found. AI Service will be disabled.");
    console.info("Please add your API key using the API key button in the navbar.");
    genAI = null;
    model = null;
    return false;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
    console.log("Google AI service initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
    console.warn("AI Service initialization failed. Please check your API key.");
    genAI = null;
    model = null;
    return false;
  }
};

// Initialize on module load
initializeAiService();

/**
 * Checks if the AI service is available and configured.
 */
export const isAiServiceAvailable = (): boolean => {
  // Try to reinitialize if model is not available
  if (!model) {
    initializeAiService();
  }
  return !!model;
};

/**
 * Reinitializes the AI service (useful when API key changes)
 */
export const reinitializeAiService = (): boolean => {
  return initializeAiService();
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
    throw new Error("AI Service is not configured. Cannot start chat. Please add your API key using the API key button in the navbar.");
  }

  if (!model) {
    throw new Error("AI model is not initialized. This should not happen if isAiServiceAvailable() returns true.");
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