import { useCallback, useEffect, useRef, useState } from "react";
import { aiFacade } from "@/services/aiFacade";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { LiveConversationAudioChunk, LiveConversationHandle } from "@/services/aiFacade";
import { getBestVoiceForCharacter } from "@/services/voiceSelectionService";

interface PcmOptions {
  numChannels: number;
  sampleRate: number;
}

const parseMimeType = (mimeType: string): PcmOptions => {
  const parts = mimeType.split(";").map((s) => s.trim());
  const options: PcmOptions = { numChannels: 1, sampleRate: 24000 };

  for (const part of parts) {
    const [key, value] = part.split("=").map((s) => s.trim());
    if (key === "rate") {
      const rate = parseInt(value, 10);
      if (!isNaN(rate)) options.sampleRate = rate;
    }
  }
  return options;
};
export interface UseLiveAiOptions {
  onTextReceived: (text: string, isStreaming: boolean) => void;
  onUserTranscription?: (text: string, isFinal: boolean) => void;
  onTurnComplete?: () => void;
  onError?: (error: string) => void;
  systemInstruction?: string;
  voiceName?: string; // Kept for backwards compatibility
  characterName?: string;
  characterBio?: string;
}

export const useLiveAi = ({ onTextReceived, onUserTranscription, onTurnComplete, onError, systemInstruction, voiceName, characterName, characterBio }: UseLiveAiOptions) => {
  const { i18n } = useTranslation();
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  const liveControllerRef = useRef<LiveConversationHandle | null>(null);
  const isLiveAssistantStreamingRef = useRef(false);
  const accumulatedUserTranscriptionRef = useRef("");
  const activeUserTranscriptionRef = useRef("");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<LiveConversationAudioChunk[]>([]);
  const isAudioPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef<number>(0);

  const cleanupAudioPlayback = useCallback(() => {
    audioQueueRef.current = [];
    isAudioPlayingRef.current = false;
    nextPlayTimeRef.current = 0;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    if (typeof window === "undefined") return null;

    const Context = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new Context();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  }, []);

  const playAudioChunk = useCallback(async (chunk: LiveConversationAudioChunk) => {
    const audioContext = await ensureAudioContext();
    if (!audioContext) return;

    const binary = atob(chunk.data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    if (chunk.mimeType.includes("pcm")) {
      const options = parseMimeType(chunk.mimeType);
      const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
      const audioBuffer = audioContext.createBuffer(options.numChannels, pcm.length, options.sampleRate);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) {
        channel[i] = pcm[i] / 32768;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      let startTime = nextPlayTimeRef.current;
      const currentTime = audioContext.currentTime;
      if (startTime < currentTime) {
        startTime = currentTime;
      }

      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
      return;
    }

    const blob = new Blob([bytes], { type: chunk.mimeType || "audio/mpeg" });
    const url = URL.createObjectURL(blob);

    try {
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [ensureAudioContext]);

  const processAudioQueue = useCallback(async () => {
    if (isAudioPlayingRef.current) return;

    isAudioPlayingRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const next = audioQueueRef.current.shift();
        if (!next) continue;
        await playAudioChunk(next);
      }
    } finally {
      isAudioPlayingRef.current = false;
    }
  }, [playAudioChunk]);

  const enqueueAudioChunk = useCallback((chunk: LiveConversationAudioChunk) => {
    audioQueueRef.current.push(chunk);
    void processAudioQueue();
  }, [processAudioQueue]);

  useEffect(() => {
    const connectLiveConversation = async () => {
      if (!isLiveMode) {
        liveControllerRef.current?.close();
        liveControllerRef.current = null;
        cleanupAudioPlayback();
        return;
      }

      if (!aiFacade.live.isConversationAvailable()) {
        toast.error("Live conversation non disponibile: controlla la API key.");
        setIsLiveMode(false);
        return;
      }

      try {
        
        // Resolve dynamic voice using AI if character name is provided and no hardcoded voice exists
        let resolvedVoice = voiceName;
        if (!resolvedVoice && characterName) {
           resolvedVoice = await getBestVoiceForCharacter(characterName, characterBio || "");
        }

        liveControllerRef.current = await aiFacade.live.startConversation({
          languageCode: i18n.language,
          systemInstruction,
          voiceName: resolvedVoice || "Aoede",
          onText: (text) => {
            if (!text.trim()) return;
            const isStreaming = isLiveAssistantStreamingRef.current;
            onTextReceived(text, isStreaming);
            isLiveAssistantStreamingRef.current = true;
          },
          onAudioChunk: (chunk) => {
            if (isLiveMode && !isLiveAssistantStreamingRef.current) {
              isLiveAssistantStreamingRef.current = true;
              onTextReceived?.("🔊 (Risposta vocale in riproduzione...)", false);
            }
            enqueueAudioChunk(chunk);
          },
          onUserTranscription: (text, isFinal) => {
            if (isFinal) {
               accumulatedUserTranscriptionRef.current += text + " ";
               activeUserTranscriptionRef.current = "";
               onUserTranscription?.(accumulatedUserTranscriptionRef.current.trim(), true);
            } else {
               activeUserTranscriptionRef.current = text;
               onUserTranscription?.((accumulatedUserTranscriptionRef.current + " " + text).trim(), false);
            }
          },
          onTurnComplete: () => {
            isLiveAssistantStreamingRef.current = false;
            accumulatedUserTranscriptionRef.current = ""; // Reset for next turn
            activeUserTranscriptionRef.current = "";
            onTurnComplete?.();
          },
          onError: (errorMessage) => {
            const errorMsg = errorMessage || "Errore nella comunicazione Live.";
            if (onError) onError(errorMsg);
            else toast.error(errorMsg);
          },
        });
      } catch (error) {
        console.error("Failed to start live conversation:", error);
        toast.error("Impossibile avviare la live conversation.");
        setIsLiveMode(false);
      }
    };

    connectLiveConversation();

    return () => {
      liveControllerRef.current?.close();
      liveControllerRef.current = null;
    };
  }, [isLiveMode, i18n.language, systemInstruction, voiceName, characterName, characterBio, cleanupAudioPlayback, enqueueAudioChunk, onTextReceived, onUserTranscription, onTurnComplete, onError]);

  useEffect(() => {
    return () => {
      cleanupAudioPlayback();
    };
  }, [cleanupAudioPlayback]);

  const sendLiveMessage = useCallback((text: string) => {
    if (!liveControllerRef.current) return false;
    isLiveAssistantStreamingRef.current = false;
    liveControllerRef.current.sendTextTurn(text);
    return true;
  }, []);

  const resetLiveSession = useCallback(() => {
    liveControllerRef.current?.close();
    liveControllerRef.current = null;
    setIsLiveMode(false);
  }, []);

  return {
    isLiveMode,
    setIsLiveMode,
    isLiveAvailable: aiFacade.live.isConversationAvailable(),
    sendLiveMessage,
    resetLiveSession
  };
};
