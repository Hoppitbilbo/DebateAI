import { createContext, useContext } from "react";
import { AiStatus, formatAiError, generate, generateJSON, GenerateOptions, generateStream, getAiStatus } from "./aiService";

/**
 * What the app needs from the AI gateway (Adapter over the HTTP calls of
 * aiService). Components and hooks get it with useAiClient, so tests and
 * future transports can provide another implementation.
 */
export interface AiClient {
  generate(o: GenerateOptions): Promise<string>;
  /** Streams the answer; onDelta receives each chunk and the text so far. */
  generateStream(o: GenerateOptions, onDelta: (chunk: string, full: string) => void): Promise<string>;
  generateJSON<T>(o: GenerateOptions): Promise<T>;
  status(force?: boolean): Promise<AiStatus>;
  /** A message for the user, in their language. */
  formatError(error: unknown): string;
}

/** The real client: the Go server's /api/ai endpoints. */
export const httpAiClient: AiClient = {
  generate,
  generateStream,
  generateJSON,
  status: getAiStatus,
  formatError: formatAiError,
};

export const AiClientContext = createContext<AiClient>(httpAiClient);

export const useAiClient = () => useContext(AiClientContext);
