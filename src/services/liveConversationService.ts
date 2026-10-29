// Real-time voice conversation through the Gemini Live API (Google Gen AI SDK).
// The server mints a single-use ephemeral token (model, voice and system
// instruction are locked in it), so the real API key never reaches the browser.
import { GoogleGenAI, LiveServerMessage, Modality, Session } from "@google/genai";
import { api } from "@/lib/api";

export interface LiveAudioChunk {
  data: string;
  mimeType: string;
}

export interface StartLiveConversationOptions {
  systemInstruction?: string;
  voiceName?: string;
  sessionId?: number | null;
  onText?: (text: string) => void;
  onAudioChunk?: (audio: LiveAudioChunk) => void;
  onUserTranscription?: (text: string, isFinal: boolean) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onError?: (errorMessage: string) => void;
  onClose?: () => void;
}

export interface LiveConversationController {
  sendTextTurn: (text: string) => void;
  setMicMuted: (muted: boolean) => void;
  close: () => void;
}

interface LiveTokenResponse {
  /** Identifies this conversation when its usage is reported (once). */
  grantId: string;
  token: string;
  model: string;
  providerId: number;
  voiceName: string;
}

export const isLiveSupportedByBrowser = (): boolean =>
  typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof AudioContext !== "undefined";

const floatTo16BitBase64 = (input: Float32Array): string => {
  const pcm16 = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

export const startLiveConversation = async (options: StartLiveConversationOptions): Promise<LiveConversationController> => {
  const tokenInfo = await api.post<LiveTokenResponse>("/api/ai/live/token", {
    sessionId: options.sessionId ?? 0,
    systemInstruction: options.systemInstruction ?? "",
    voiceName: options.voiceName ?? "",
  });

  const ai = new GoogleGenAI({ apiKey: tokenInfo.token, httpOptions: { apiVersion: "v1alpha" } });
  let session: Session | null = null;
  let manuallyClosed = false;
  let micMuted = false;
  const usage = { input: 0, output: 0 };

  let stream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let processor: ScriptProcessorNode | null = null;
  let gain: GainNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;

  const reportUsage = () => {
    // The server takes provider, model, attempt and duration from the grant.
    void api.post("/api/ai/live/usage", {
      grantId: tokenInfo.grantId,
      inputTokens: usage.input,
      outputTokens: usage.output,
    }).catch(() => undefined);
  };

  session = await ai.live.connect({
    model: tokenInfo.model,
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: tokenInfo.voiceName || "Aoede" } } },
      ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
    },
    callbacks: {
      onmessage: (message: LiveServerMessage) => {
        const sc = message.serverContent;
        if (sc?.interrupted) options.onInterrupted?.();
        const out = sc?.outputTranscription?.text;
        if (out) options.onText?.(out);
        for (const part of sc?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) {
            options.onAudioChunk?.({ data: part.inlineData.data, mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000" });
          }
        }
        const input = sc?.inputTranscription;
        if (input?.text) options.onUserTranscription?.(input.text, !!input.finished);
        if (message.usageMetadata) {
          usage.input += message.usageMetadata.promptTokenCount ?? 0;
          usage.output += message.usageMetadata.responseTokenCount ?? 0;
        }
        if (sc?.turnComplete) options.onTurnComplete?.();
      },
      onerror: (event: ErrorEvent) => options.onError?.(event.message || "Live API error"),
      onclose: (event: CloseEvent) => {
        if (!manuallyClosed) {
          options.onError?.(event.reason || "Live connection closed");
          reportUsage();
        }
        options.onClose?.();
      },
    },
  });

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    audioContext = new AudioContext({ sampleRate: 16000 });
    source = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(4096, 1, 1);
    gain = audioContext.createGain();
    gain.gain.value = 0; // keep the graph running without echoing the mic
    processor.onaudioprocess = (e) => {
      if (!session || micMuted) return;
      try {
        session.sendRealtimeInput({ audio: { mimeType: "audio/pcm;rate=16000", data: floatTo16BitBase64(e.inputBuffer.getChannelData(0)) } });
      } catch {
        /* session closing */
      }
    };
    source.connect(processor);
    processor.connect(gain);
    gain.connect(audioContext.destination);
  } catch (err) {
    console.error("Microphone unavailable for live conversation:", err);
    options.onError?.("microphone");
  }

  return {
    sendTextTurn: (text: string) => {
      if (!session || !text.trim()) return;
      session.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
    },
    setMicMuted: (muted: boolean) => {
      micMuted = muted;
    },
    close: () => {
      if (!session) return;
      manuallyClosed = true;
      processor?.disconnect();
      gain?.disconnect();
      source?.disconnect();
      void audioContext?.close();
      stream?.getTracks().forEach((t) => t.stop());
      try {
        session.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        /* ignore */
      }
      session.close();
      session = null;
      reportUsage();
    },
  };
};
