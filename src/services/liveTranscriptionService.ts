import { GoogleGenAI, LiveServerMessage, Modality, Session } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const liveModel = import.meta.env.VITE_GEMINI_LIVE_MODEL || "gemini-live-2.5-flash-preview";

interface StartLiveTranscriptionOptions {
  languageCode?: string;
  onTranscription: (text: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
}

export interface LiveTranscriptionController {
  stop: () => Promise<void>;
}

const getSupportedRecorderMimeType = (): string | undefined => {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidateTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return candidateTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
};

export const isLiveTranscriptionAvailable = (): boolean => {
  return !!apiKey && typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
};

export const startLiveTranscription = async (
  options: StartLiveTranscriptionOptions,
): Promise<LiveTranscriptionController> => {
  if (!isLiveTranscriptionAvailable()) {
    throw new Error("Live transcription is not available in this browser or API key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  let session: Session | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;

  const handleServerMessage = (message: LiveServerMessage) => {
    const transcription = message.serverContent?.inputTranscription;
    if (transcription?.text) {
      options.onTranscription(transcription.text, !!transcription.finished);
    }
  };

  session = await ai.live.connect({
    model: liveModel,
    config: {
      responseModalities: [Modality.TEXT],
      inputAudioTranscription: {},
      systemInstruction: options.languageCode
        ? `You are receiving live speech. Use language code ${options.languageCode} for transcription alignment.`
        : undefined,
    },
    callbacks: {
      onmessage: handleServerMessage,
      onerror: (event: ErrorEvent) => {
        options.onError?.(event.message || "Live API connection error.");
      },
      onclose: () => {
        if (!stopped) {
          options.onError?.("Live API connection closed unexpectedly.");
        }
      },
    },
  });

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  const mimeType = getSupportedRecorderMimeType();
  mediaRecorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (!event.data || event.data.size === 0 || !session) {
      return;
    }

    session.sendRealtimeInput({ audio: event.data });
  };

  mediaRecorder.onerror = () => {
    options.onError?.("Microphone recording error.");
  };

  mediaRecorder.start(250);

  const stop = async () => {
    if (stopped) {
      return;
    }

    stopped = true;

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    stream?.getTracks().forEach((track) => track.stop());

    if (session) {
      try {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } catch (error) {
        console.warn("Failed to send audio stream end:", error);
      }

      session.close();
    }

    session = null;
    mediaRecorder = null;
    stream = null;
  };

  return { stop };
};

