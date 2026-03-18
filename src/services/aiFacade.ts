import {
  ChatSession,
  GenerateContentRequest,
  GenerateContentResult,
  Part,
} from "@google/generative-ai";
import {
  generateContent,
  generateContentStream,
  getResponse,
  getResponseStream,
  isAiServiceAvailable,
  sendMessage,
  startChat,
} from "@/services/aiService";
import {
  isLiveTranscriptionAvailable,
  LiveTranscriptionController,
  startLiveTranscription,
} from "@/services/liveTranscriptionService";
import {
  isLiveConversationAvailable,
  LiveAudioChunk,
  LiveConversationController,
  startLiveConversation,
  StartLiveConversationOptions,
} from "@/services/liveConversationService";

export interface StartTextChatOptions {
  history?: { role: "user" | "model"; parts: Part[] }[];
  systemInstructionText?: string;
}

export type LiveTranscriptionHandle = LiveTranscriptionController;
export type LiveConversationHandle = LiveConversationController;
export type LiveConversationAudioChunk = LiveAudioChunk;

export const aiFacade = {
  text: {
    isAvailable: (): boolean => isAiServiceAvailable(),

    startChat: ({ history = [], systemInstructionText }: StartTextChatOptions = {}): ChatSession => {
      return startChat(history, systemInstructionText);
    },

    sendMessage: async (chat: ChatSession, message: string): Promise<string> => {
      return sendMessage(chat, message);
    },

    generateContent: async (request: GenerateContentRequest): Promise<GenerateContentResult> => {
      return generateContent(request);
    },

    generateContentStream,
    getResponse,
    getResponseStream,
  },

  live: {
    isTranscriptionAvailable: (): boolean => isLiveTranscriptionAvailable(),

    startTranscription: async (params: {
      languageCode?: string;
      onTranscription: (text: string, isFinal: boolean) => void;
      onError?: (errorMessage: string) => void;
    }): Promise<LiveTranscriptionController> => {
      return startLiveTranscription(params);
    },


    isConversationAvailable: (): boolean => isLiveConversationAvailable(),

    startConversation: async (
      params: StartLiveConversationOptions,
    ): Promise<LiveConversationController> => {
      return startLiveConversation(params);
    },
  },
};

