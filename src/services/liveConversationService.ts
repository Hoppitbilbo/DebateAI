import { GoogleGenAI, LiveServerMessage, MediaResolution, Modality, Session } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const liveChatModel =
  import.meta.env.VITE_GEMINI_LIVE_CHAT_MODEL ||
  "models/gemini-3.1-flash-live-preview";

export interface LiveAudioChunk {
  data: string;
  mimeType: string;
}

export interface StartLiveConversationOptions {
  languageCode?: string;
  systemInstruction?: string;
  voiceName?: string;
  onText?: (text: string) => void;
  onAudioChunk?: (audio: LiveAudioChunk) => void;
  onUserTranscription?: (text: string, isFinal: boolean) => void;
  onTurnComplete?: () => void;
  onError?: (errorMessage: string) => void;
}

export interface LiveConversationController {
  sendTextTurn: (text: string) => void;
  close: () => void;
}

export const isLiveConversationAvailable = (): boolean => {
  return !!apiKey && typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
};

const getTextFromMessage = (message: LiveServerMessage): string | undefined => {
  // Ignore parts that are model thoughts
  const parts = message.serverContent?.modelTurn?.parts || [];
  return parts
    .filter((part: any) => !part.thought)
    .map((part) => part.text)
    .find((text): text is string => !!text && text.trim().length > 0);
};

const getUserTranscriptionFromMessage = (message: LiveServerMessage): { text: string, isFinal: boolean } | undefined => {
  const transcription = message.serverContent?.interrupted ? undefined : message.serverContent?.modelTurn ? undefined : message.serverContent?.turnComplete ? undefined : (message as any).serverContent?.inputTranscription; // The typedef might be missing inputTranscription in LiveServerMessage, but it exists
  if (transcription?.text) {
    return { text: transcription.text, isFinal: !!transcription.finished };
  }
  return undefined;
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

  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;
  let gainNode: GainNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  session = await ai.live.connect({
    model: liveChatModel,
    config: {
      responseModalities: [Modality.AUDIO], // Native Audio models only support AUDIO modality, transcript is included automatically
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
      inputAudioTranscription: {}, 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: options.voiceName || "Aoede",
          },
        },
      },
      ...(options.systemInstruction || options.languageCode ? {
        systemInstruction: {
          parts: [{ text: options.systemInstruction || `Use language ${options.languageCode} for this conversation unless user asks differently.` }]
        }
      } : {}),
      contextWindowCompression: {
        triggerTokens: "104857",
        slidingWindow: { targetTokens: "52428" },
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

        const userTranscription = getUserTranscriptionFromMessage(message);
        if (userTranscription && options.onUserTranscription) {
          options.onUserTranscription(userTranscription.text, userTranscription.isFinal);
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

  try {
    stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } 
    });

    audioContext = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)({
      sampleRate: 16000,
    });

    source = audioContext.createMediaStreamSource(stream);
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0; // Prevent feedback loop

    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
      if (!session) return;
      
      const inputBuffer = audioProcessingEvent.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);

      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let sample = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }

      const uint8Array = new Uint8Array(pcm16.buffer);
      let binaryString = '';
      for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
      }
      const base64Data = btoa(binaryString);

      try {
        session.sendRealtimeInput({
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: base64Data
          }
        });
      } catch (e) {
        // Ignore errors if session is closing
      }
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(gainNode);
    gainNode.connect(audioContext.destination);
  } catch (err) {
    console.error("Failed to initialize microphone for live conversation:", err);
    options.onError?.("Microphone access denied or unavailable.");
  }

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

      if (scriptProcessor) {
        scriptProcessor.disconnect();
      }
      if (gainNode) {
        gainNode.disconnect();
      }
      if (source) {
        source.disconnect();
      }
      if (audioContext) {
        void audioContext.close();
      }

      stream?.getTracks().forEach((track) => track.stop());

      try {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } catch (error) {
        // ignore
      }

      session.close();
      session = null;
      scriptProcessor = null;
      source = null;
      gainNode = null;
      audioContext = null;
      stream = null;
    },
  };
};
