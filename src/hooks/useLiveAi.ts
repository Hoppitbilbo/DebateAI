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
import { formatAiError, getAiStatus, type PromptRecipe } from "@/services/aiService";

/** "thinking": the student's turn has arrived, the character's answer has not started yet. */
export type LiveState = "off" | "connecting" | "listening" | "thinking" | "speaking";

/** Why a voice session stopped by itself; the chat then goes on in text. */
type LiveFailure = "microphone" | "connection" | "start";

/** One toast at a time: a dropped connection reports an error and a close. */
const FAILURE_TOAST_ID = "live-failure";

export interface UseLiveAiOptions {
  /** The character; the server writes the voice instructions from it. */
  recipe?: PromptRecipe;
  characterName?: string;
  characterBio?: string;
  sessionId?: number | null;
  /** Disable live entirely (e.g. assignment forbids it). */
  disabled?: boolean;
  onAssistantText: (text: string, isNewTurn: boolean) => void;
  onUserText?: (text: string, isFinal: boolean) => void;
  onTurnComplete?: () => void;
  /** The character called a function declared by the server (e.g. the mystery game is won). */
  onFunctionCall?: (name: string) => void;
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
  /** The character's audio reply is still arriving: a gap between chunks is not its end. */
  const replyOpen = useRef(false);
  const cbRef = useRef(opts);
  cbRef.current = opts;

  useEffect(() => {
    void getAiStatus().then((s) => setServerLive(s.live));
  }, []);

  const browserSupport = isLiveSupportedByBrowser();
  const liveAvailable = serverLive && browserSupport && !opts.disabled;
  /** The server offers voice but this browser cannot use it: the student is told to write. */
  const liveUnsupported = serverLive && !browserSupport && !opts.disabled;

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
    replyOpen.current = false;
  }, []);

  /** The character has finished speaking: back to listening, or closed if finishLive asked. */
  const afterReply = useCallback(() => {
    if (finishingRef.current) setLiveMode(false);
    else setLiveState("listening");
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
      if (sourcesRef.current.length > 0 || replyOpen.current || !controllerRef.current) return;
      afterReply();
    };
    replyOpen.current = true;
    setLiveState("speaking");
  }, [afterReply]);

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

  /**
   * Voice stopped by itself: the student is told why and that the chat goes on
   * in text; a turn left half done is closed and saved like a finished one.
   */
  const fail = useCallback((kind: LiveFailure, detail?: string) => {
    toast.error(t(`platform.live.failed.${kind}`), { id: FAILURE_TOAST_ID, description: detail });
    if (assistantTurnOpen.current || userBuffer.current) {
      assistantTurnOpen.current = false;
      userBuffer.current = "";
      cbRef.current.onTurnComplete?.();
    }
    setLiveMode(false);
  }, [t]);

  const { characterName, characterBio, sessionId } = opts;
  // A recipe is a new object on every render: reconnect only when its content changes.
  const recipeKey = opts.recipe ? JSON.stringify(opts.recipe) : "";

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
          recipe: recipeKey ? (JSON.parse(recipeKey) as PromptRecipe) : undefined,
          voiceName: voice,
          sessionId,
          onText: (text) => {
            const isNew = !assistantTurnOpen.current;
            assistantTurnOpen.current = true;
            cbRef.current.onAssistantText(text, isNew);
          },
          onAudioChunk: playChunk,
          onFunctionCall: (name) => cbRef.current.onFunctionCall?.(name),
          onInterrupted: () => {
            // the student spoke over the character
            stopPlayback();
            setLiveState("listening");
          },
          onUserTranscription: (text, isFinal) => {
            if (assistantTurnOpen.current) {
              // the student started a new turn
              assistantTurnOpen.current = false;
            }
            userBuffer.current += text;
            cbRef.current.onUserText?.(userBuffer.current.trim(), isFinal);
            // Gemini sends the transcription when the student's turn ends, rarely marked as finished.
            setLiveState("thinking");
          },
          onTurnComplete: () => {
            assistantTurnOpen.current = false;
            userBuffer.current = "";
            replyOpen.current = false;
            cbRef.current.onTurnComplete?.();
            if (sourcesRef.current.length === 0) afterReply();
          },
          onError: (msg) => {
            if (cancelled) return;
            if (msg === "microphone") return fail("microphone");
            console.error("Live conversation error:", msg);
            fail("connection");
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
          console.error("Live conversation could not start:", e);
          fail("start", formatAiError(e));
        }
      }
    })();
    return () => {
      cancelled = true;
      disconnect();
    };
  }, [liveMode, recipeKey, characterName, characterBio, sessionId, disconnect, playChunk, stopPlayback, afterReply, fail]);

  useEffect(() => () => disconnect(), [disconnect]);

  const sendLiveText = useCallback((text: string) => {
    if (!controllerRef.current) return false;
    assistantTurnOpen.current = false;
    controllerRef.current.sendTextTurn(text);
    setLiveState("thinking");
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
    if (sourcesRef.current.length === 0 && !replyOpen.current) setLiveMode(false);
    else finishingRef.current = true;
  }, []);

  return { liveMode, liveState, liveAvailable, liveUnsupported, toggleLive, stopLive, finishLive, sendLiveText };
};

export type LiveControls = ReturnType<typeof useLiveAi>;
