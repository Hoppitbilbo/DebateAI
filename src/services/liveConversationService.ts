import { GoogleGenAI, LiveServerMessage, MediaResolution, Modality, Session } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const liveChatModel =
  import.meta.env.VITE_GEMINI_LIVE_CHAT_MODEL ||
  "gemini-live-2.5-flash-preview";

export interface LiveAudioChunk {
  data: string;
  mimeType: string;
}

export interface StartLiveConversationOptions {
  languageCode?: string;
  voiceName?: string;
  onText?: (text: string) => void;
  onAudioChunk?: (audio: LiveAudioChunk) => void;
  onTurnComplete?: () => void;
  onError?: (errorMessage: string) => void;
}

export interface LiveConversationController {
  sendTextTurn: (text: string) => void;
  close: () => void;
}

export const isLiveConversationAvailable = (): boolean => {
  return !!apiKey;
};

const getTextFromMessage = (message: LiveServerMessage): string | undefined => {
  return message.serverContent?.modelTurn?.parts
    ?.map((part) => part.text)
    .find((text): text is string => !!text && text.trim().length > 0);
};

const getAudioChunkFromMessage = (message: LiveServerMessage): LiveAudioChunk | undefined => {
  const inlineData = message.serverContent?.modelTurn?.parts
    ?.map((part) => part.inlineData)
    .find((data) => !!data?.data);

  if (!inlineData?.data) {
    return undefined;
  }

  return {
    data: inlineData.data,
    mimeType: inlineData.mimeType || "audio/pcm",
  };
};

export const startLiveConversation = async (
  options: StartLiveConversationOptions,
): Promise<LiveConversationController> => {
  if (!isLiveConversationAvailable()) {
    throw new Error("Live conversation is not available because API key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });
  let session: Session | null = null;
  let manuallyClosed = false;

  session = await ai.live.connect({
    model: liveChatModel,
    config: {
      responseModalities: [Modality.TEXT, Modality.AUDIO],
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: options.voiceName || "Zephyr",
          },
        },
      },
      systemInstruction: options.languageCode
        ? `Use language ${options.languageCode} for this conversation unless user asks differently.`
        : undefined,
      contextWindowCompression: {
        triggerTokens: 104857,
        slidingWindow: { targetTokens: 52428 },
      },
    },
    callbacks: {
      onmessage: (message: LiveServerMessage) => {
        const text = getTextFromMessage(message);
        if (text) {
          options.onText?.(text);
        }

        const audioChunk = getAudioChunkFromMessage(message);
        if (audioChunk) {
          options.onAudioChunk?.(audioChunk);
        }

        if (message.serverContent?.turnComplete) {
          options.onTurnComplete?.();
        }
      },
      onerror: (event: ErrorEvent) => {
        options.onError?.(event.message || "Live API conversation error.");
      },
      onclose: (event: CloseEvent) => {
        if (!manuallyClosed) {
          options.onError?.(`Live conversation closed: ${event.reason || "unknown reason"}`);
        }
      },
    },
  });

  return {
    sendTextTurn: (text: string) => {
      if (!session || !text.trim()) {
        return;
      }

      session.sendClientContent({
        turns: [{ role: "user", parts: [{ text }] }],
        turnComplete: true,
      });
    },
    close: () => {
      if (!session) {
        return;
      }

      manuallyClosed = true;
      session.close();
      session = null;
    },
  };
};
