import { GoogleGenAI, LiveServerMessage, Modality, Session } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const liveModel = import.meta.env.VITE_GEMINI_LIVE_MODEL || "gemini-2.0-flash-exp";

interface StartLiveTranscriptionOptions {
  languageCode?: string;
  onTranscription: (text: string, isFinal: boolean) => void;
  onError?: (errorMessage: string) => void;
}

export interface LiveTranscriptionController {
  stop: () => Promise<void>;
}



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
  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let scriptProcessor: ScriptProcessorNode | null = null;
  let gainNode: GainNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
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
    
    // Get float32 PCM
    const inputBuffer = audioProcessingEvent.inputBuffer;
    const inputData = inputBuffer.getChannelData(0);

    // Convert to PCM16
    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      let sample = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }

    // Convert to base64
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
      console.error(e);
    }
  };

  source.connect(scriptProcessor);
  scriptProcessor.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const stop = async () => {
    if (stopped) {
      return;
    }

    stopped = true;

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

    if (session) {
      try {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } catch (error) {
        console.warn("Failed to send audio stream end:", error);
      }

      session.close();
    }

    session = null;
    scriptProcessor = null;
    source = null;
    gainNode = null;
    audioContext = null;
    stream = null;
  };

  return { stop };
};

