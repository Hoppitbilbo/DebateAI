import {
  ChatSession,
  GenerateContentRequest,
  GenerateContentResult,
  GenerativeModel,
  GoogleGenerativeAI,
  Part,
} from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const textModelName = import.meta.env.VITE_GEMINI_TEXT_MODEL || "gemini-3-flash-preview";

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;

const extractRetryDelay = (errorMessage: string): string | null => {
  const match = errorMessage.match(/Please retry in\s+([\d.]+)s/i) || errorMessage.match(/retryDelay":"([^"]+)"/i);
  return match?.[1] ?? null;
};

export const formatAiServiceError = (error: unknown): string => {
  const fallbackMessage = "Si è verificato un errore durante la comunicazione con Gemini.";

  if (!(error instanceof Error) || !error.message) {
    return fallbackMessage;
  }

  const message = error.message;
  const isQuotaError =
    message.includes("429") ||
    message.toLowerCase().includes("quota exceeded") ||
    message.toLowerCase().includes("rate limit");

  if (!isQuotaError) {
    return message;
  }

  const retryDelay = extractRetryDelay(message);
  const retryText = retryDelay ? ` Riprova tra circa ${retryDelay} secondi.` : " Riprova più tardi.";

  return `La quota Gemini per il modello ${textModelName} è stata superata o non è disponibile per questa API key.${retryText} Se vuoi continuare subito, controlla billing/piano oppure imposta un modello diverso tramite VITE_GEMINI_TEXT_MODEL.`;
};

if (apiKey && apiKey !== "your_api_key_here") {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: textModelName });
    console.log(`Google AI service initialized successfully with model ${textModelName}`);
  } catch (error) {
    console.error("Error initializing GoogleGenerativeAI:", error);
    console.warn("AI Service initialization failed. Please check your API key.");
  }
} else {
  console.warn("Gemini API key is not configured. AI Service will be disabled.");
  console.info("Please add your API key to the .env file as VITE_GEMINI_API_KEY");
}

export const isAiServiceAvailable = (): boolean => {
  return !!model;
};

export const startChat = (
  history: { role: "user" | "model"; parts: Part[] }[] = [],
  systemInstructionText?: string,
): ChatSession => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot start chat. Please check your VITE_GEMINI_API_KEY in the .env file.");
  }

  if (!model) {
    throw new Error("AI model is not initialized. This should not happen if isAiServiceAvailable() returns true.");
  }

  const chatOptions: {
    history: { role: "user" | "model"; parts: Part[] }[];
    systemInstruction?: { role: string; parts: Part[] };
  } = { history };

  if (systemInstructionText) {
    chatOptions.systemInstruction = {
      role: "system",
      parts: [{ text: systemInstructionText }],
    };
  }

  return model.startChat(chatOptions);
};

export const sendMessage = async (chat: ChatSession, message: string): Promise<string> => {
  if (!isAiServiceAvailable()) {
    console.warn("AI Service not available. Returning mock response.");
    return "Mock response: AI service is not available.";
  }

  try {
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error sending message to AI service:", error);
    throw new Error(formatAiServiceError(error));
  }
};

export const generateContent = async (request: GenerateContentRequest): Promise<GenerateContentResult> => {
  if (!isAiServiceAvailable()) {
    throw new Error("AI Service is not configured. Cannot generate content.");
  }

  try {
    return await model.generateContent(request);
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error(formatAiServiceError(error));
  }
};

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
    throw new Error(formatAiServiceError(error));
  }
};

export const generateContentStream = async function* (
  request: GenerateContentRequest,
): AsyncGenerator<string, void, unknown> {
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
    throw new Error(formatAiServiceError(error));
  }
};

export const getResponseStream = async function* (
  prompt: string,
  systemInstructionText?: string,
): AsyncGenerator<string, void, unknown> {
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
    throw new Error(formatAiServiceError(error));
  }
};

export { model, textModelName };
