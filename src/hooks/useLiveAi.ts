import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  isLiveSupportedByBrowser,
  LiveAudioChunk,
  LiveConversationController,
  startLiveConversation,
} from "@/services/liveConversationService";
import { getBestVoiceForCharacter } from "@/services/voiceSelectionService";
import { getAiStatus } from "@/services/aiService";
import { formatAiError } from "@/services/aiService";

export type LiveState = "off" | "connecting" | "listening" | "speaking";

export interface UseLiveAiOptions {
  systemInstruction?: string;
  characterName?: string;
  characterBio?: string;
  sessionId?: number | null;
  /** Disable live entirely (e.g. assignment forbids it). */
  disabled?: boolean;
  onAssistantText: (text: string, isNewTurn: boolean) => void;
  onUserText?: (text: string, isFinal: boolean) => void;
  onTurnComplete?: () => void;
}

const sampleRateOf = (mime: string) => {
  const m = /rate=(\d+)/.exec(mime);
  return m ? parseInt(m[1], 10) : 24000;
};

/**
 * Voice conversation with a single AI character via Gemini Live.
 * Text appears progressively from the audio transcription, so the transcript
 * (and the JEV judge) work exactly like in text mode.
 */
export const useLiveAi = (opts: UseLiveAiOptions) => {
  const { t } = useTranslation();
  const [liveMode, setLiveMode] = useState(false);
  const [liveState, setLiveState] = useState<LiveState>("off");
  const [serverLive, setServerLive] = useState(false);

  const controllerRef = useRef<LiveConversationController | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const assistantTurnOpen = useRef(false);
  const userBuffer = useRef("");
  /** finishLive was called: the session closes when the last audio ends. */
  const finishingRef = useRef(false);
  const cbRef = useRef(opts);
  cbRef.current = opts;

  useEffect(() => {
    void getAiStatus().then((s) => setServerLive(s.live));
  }, []);

  const liveAvailable = serverLive && isLiveSupportedByBrowser() && !opts.disabled;

  const stopPlayback = useCallback(() => {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    sourcesRef.current = [];
    nextTimeRef.current = 0;
  }, []);

  const playChunk = useCallback((chunk: LiveAudioChunk) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const bin = atob(chunk.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer, 0, Math.floor(bytes.byteLength / 2));
    const buffer = ctx.createBuffer(1, pcm.length, sampleRateOf(chunk.mimeType));
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const start = Math.max(nextTimeRef.current, ctx.currentTime);
    src.start(start);
    nextTimeRef.current = start + buffer.duration;
    sourcesRef.current.push(src);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
      if (sourcesRef.current.length > 0 || !controllerRef.current) return;
      if (finishingRef.current) setLiveMode(false);
      else setLiveState("listening");
    };
    setLiveState("speaking");
  }, []);

  const disconnect = useCallback(() => {
    controllerRef.current?.close();
    controllerRef.current = null;
    stopPlayback();
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    assistantTurnOpen.current = false;
    finishingRef.current = false;
    userBuffer.current = "";
    setLiveState("off");
  }, [stopPlayback]);

  const { systemInstruction, characterName, characterBio, sessionId } = opts;

  useEffect(() => {
    if (!liveMode) {
      disconnect();
      return;
    }
    let cancelled = false;
    (async () => {
      setLiveState("connecting");
      try {
        const voice = characterName ? await getBestVoiceForCharacter(characterName, characterBio || "") : undefined;
        if (cancelled) return;
        const ctrl = await startLiveConversation({
          systemInstruction,
          voiceName: voice,
          sessionId,
          onText: (text) => {
            const isNew = !assistantTurnOpen.current;
            assistantTurnOpen.current = true;
            cbRef.current.onAssistantText(text, isNew);
          },
          onAudioChunk: playChunk,
          onInterrupted: stopPlayback,
          onUserTranscription: (text, isFinal) => {
            if (assistantTurnOpen.current) {
              // the student started a new turn
              assistantTurnOpen.current = false;
            }
            userBuffer.current += text;
            cbRef.current.onUserText?.(userBuffer.current.trim(), isFinal);
          },
          onTurnComplete: () => {
            assistantTurnOpen.current = false;
            userBuffer.current = "";
            cbRef.current.onTurnComplete?.();
          },
          onError: (msg) => {
            if (msg === "microphone") toast.error(t("platform.live.micError"));
            else toast.error(t("platform.live.error", { message: msg }));
          },
          onClose: () => {
            if (!cancelled) setLiveMode(false);
          },
        });
        if (cancelled) {
          ctrl.close();
          return;
        }
        controllerRef.current = ctrl;
        setLiveState("listening");
      } catch (e) {
        if (!cancelled) {
          toast.error(formatAiError(e));
          setLiveMode(false);
          setLiveState("off");
        }
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [liveMode, systemInstruction, characterName, characterBio, sessionId, disconnect, playChunk, stopPlayback, t]);

  useEffect(() => () => disconnect(), [disconnect]);

  const sendLiveText = useCallback((text: string) => {
    if (!controllerRef.current) return false;
    assistantTurnOpen.current = false;
    controllerRef.current.sendTextTurn(text);
    return true;
  }, []);

  const toggleLive = useCallback(() => setLiveMode((v) => !v), []);
  const stopLive = useCallback(() => setLiveMode(false), []);

  /**
   * Ends the voice session without cutting the character off: the microphone
   * closes at once, the connection when the audio already received has played.
   */
  const finishLive = useCallback(() => {
    controllerRef.current?.setMicMuted(true);
    if (sourcesRef.current.length === 0) setLiveMode(false);
    else finishingRef.current = true;
  }, []);

  return { liveMode, liveState, liveAvailable, toggleLive, stopLive, finishLive, sendLiveText };
};

export type LiveControls = ReturnType<typeof useLiveAi>;
