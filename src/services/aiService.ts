/**
 * @file Core AI service for interacting with the Google Generative AI API.
 * @remarks This service initializes the AI model and provides functions for starting chats,
 * sending messages, and generating content, both in standard and streaming modes.
 * It handles the API key configuration and provides a check for service availability.
 */

import { GoogleGenerativeAI, GenerativeModel, ChatSession, GenerateContentRequest, GenerateContentResult, Part } from "@google/generative-ai";

// Get the API key from environment variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;
/**
 * @description The initialized Generative AI model instance from Google.
 * This is exported for direct use if advanced functionality is needed.
 */
if (apiKey && apiKey !== 'your_api_key_here') {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
    console.log("Google AI service initialized successfully");
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
    console.warn("AI Service initialization failed. Please check your API key.");
  }
} else {
  console.warn("Gemini API key is not configured. AI Service will be disabled.");
  console.info("Please add your API key to the .env file as VITE_GEMINI_API_KEY");
}

/**
 * @function isAiServiceAvailable
 * @description Checks if the AI service is properly configured and available for use.
 * @returns {boolean} `true` if the model is initialized, `false` otherwise.
 */
export const isAiServiceAvailable = (): boolean => {
  return !!model;
};

/**
 * @function startChat
 * @description Starts a new chat session with the generative model.
 * @param {Array<{ role: "user" | "model"; parts: Part[] }>} [history=[]] - Optional chat history to initialize the session.
 * @param {string} [systemInstructionText] - Optional system instructions to guide the model's behavior.
 * @returns {ChatSession} A new ChatSession instance.
 * @throws {Error} If the AI service is not configured or the model is not initialized.
 */
export const startChat = (
  history: { role: "user" | "model"; parts: Part[] }[] = [],
  systemInstructionText?: string
): ChatSession => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot start chat. Please check your VITE_GEMINI_API_KEY in the .env file.");
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
 * @function sendMessage
 * @description Sends a message in an ongoing chat session.
 * @param {ChatSession} chat - The ChatSession instance.
 * @param {string} message - The message to send.
 * @returns {Promise<string>} The model's response text.
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
 * @function generateContent
 * @description Generates content from the model based on a request.
 * @param {GenerateContentRequest} request - The content generation request.
 * @returns {Promise<GenerateContentResult>} The generated content result.
 * @throws {Error} If the AI service is not configured.
 */
export const generateContent = async (request: GenerateContentRequest): Promise<GenerateContentResult> => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate content.");
  }
  return model.generateContent(request);
};

/**
 * @function getResponse
 * @description A versatile function to get a response for a given prompt, with optional system instructions.
 * @param {string} prompt - The user prompt text.
 * @param {string} [systemInstructionText] - Optional system instruction text.
 * @returns {Promise<string>} The model's response text.
 * @throws {Error} If an error occurs during AI service communication.
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
 * @function generateContentStream
 * @description Generates streaming content from the model based on a request.
 * @param {GenerateContentRequest} request - The content generation request.
 * @returns {AsyncGenerator<string, void, unknown>} An async generator that yields text chunks.
 * @throws {Error} If the AI service is not configured or an error occurs during streaming.
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
 * @function getResponseStream
 * @description A streaming version of getResponse that yields text chunks as they arrive.
 * @param {string} prompt - The user prompt text.
 * @param {string} [systemInstructionText] - Optional system instruction text.
 * @returns {AsyncGenerator<string, void, unknown>} An async generator that yields text chunks.
 * @throws {Error} If an error occurs during AI service communication.
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