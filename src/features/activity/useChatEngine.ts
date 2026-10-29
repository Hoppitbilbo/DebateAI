import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/services/aiService";
import { useAiClient } from "@/services/aiClient";
import { useLiveAi } from "@/hooks/useLiveAi";
import type { ActivitySession, EndReason } from "./useActivitySession";
import { ActivityMessage, newId } from "./types";
import { useMessageState } from "./useMessageState";

interface LiveConfig {
  systemInstruction?: string;
  characterName?: string;
  characterBio?: string;
}

interface Options {
  session: ActivitySession;
  /** Enables Gemini Live voice mode for single-character apps. */
  live?: LiveConfig | null;
  /** Extra context saved with the transcript (characters, topic...). */
  context?: Record<string, unknown>;
  /** Called when JEV (goal reached) or the turn limit ends the activity. */
  onEnded?: (reason: EndReason) => void;
}

interface RespondArgs {
  system: string;
  history?: ChatMessage[];
  name?: string;
  speakerKey?: string;
  maxTokens?: number;
  /** Replaces the reply if it fails, instead of an error (e.g. the old canned intro). */
  fallback?: Pick<ActivityMessage, "role" | "content">;
}

/** Converts the visible conversation into the history seen by one AI speaker. */
export const toHistory = (messages: ActivityMessage[], speakerKey?: string): ChatMessage[] =>
  messages
    .filter((m) => m.role !== "system" && !m.error && m.content.trim())
    // user messages may be addressed to one speaker only (speakerKey set)
    .filter((m) => !speakerKey || !m.speakerKey || m.speakerKey === speakerKey)
    .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

/**
 * Shared conversation engine used by every app: message list, streaming
 * replies through the AI gateway, Gemini Live voice mode, and transcript sync
 * with the JEV judge after every completed turn.
 */
export const useChatEngine = ({ session, live, context, onEnded }: Options) => {
  const ai = useAiClient();
  const { messages, messagesRef, setMessages, streamMessages } = useMessageState();
  const [busy, setBusy] = useState(false);
  const contextRef = useRef(context);
  contextRef.current = context;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const ended = session.endReason === "goal_reached" || session.endReason === "turn_limit";

  /**
   * Saves the transcript after a turn. `judge: true` asks for a judgement even
   * when the attempt already ended; `judge: false` saves without one.
   */
  const afterTurn = useCallback(async (opts: { judge?: boolean } = {}) => {
    const reason = await session.sync(messagesRef.current, contextRef.current, opts);
    if (reason) onEndedRef.current?.(reason);
  }, [session, messagesRef]);

  const addMessage = useCallback((m: Omit<ActivityMessage, "id">) => {
    const msg = { ...m, id: newId() };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, [setMessages]);

  const patchMessage = useCallback((id: string, patch: Partial<ActivityMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, [setMessages]);

  /** Keeps the chat busy (input disabled) while `work` runs. */
  const withBusy = useCallback(async <T,>(work: () => Promise<T>) => {
    setBusy(true);
    try {
      return await work();
    } finally {
      setBusy(false);
    }
  }, []);

  /** Failed replies the student can ask again, by message id. */
  const retries = useRef(new Map<string, () => Promise<unknown>>());
  const respondRef = useRef<(args: RespondArgs) => Promise<string | null>>();

  /**
   * Streams one assistant reply into the conversation. Returns the text or
   * null on error; with `fallback` a failure shows that text instead.
   */
  const respond = useCallback(async (args: RespondArgs) => {
    const msg = addMessage({ role: "assistant", content: "", name: args.name, speakerKey: args.speakerKey, streaming: true });
    try {
      const text = await ai.generateStream(
        { task: "chat", system: args.system, messages: args.history ?? toHistory(messagesRef.current.filter((m) => m.id !== msg.id), args.speakerKey), sessionId: session.getSessionId(), maxTokens: args.maxTokens },
        (_d, full) => streamMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: full } : m)),
      );
      patchMessage(msg.id, { content: text || "…", streaming: false });
      return text;
    } catch (e) {
      if (args.fallback) {
        patchMessage(msg.id, { ...args.fallback, streaming: false });
        return null;
      }
      patchMessage(msg.id, { content: ai.formatError(e), streaming: false, error: true });
      retries.current.set(msg.id, () => respondRef.current!(args));
      toast.error(ai.formatError(e));
      return null;
    }
  }, [addMessage, patchMessage, streamMessages, messagesRef, session, ai]);
  respondRef.current = respond;

  /**
   * The character speaks first, in its own voice, prompted by a hidden stage
   * direction; `fallback` is shown if no model answers.
   */
  const open = useCallback(
    (args: Omit<RespondArgs, "history"> & { cue: string; fallback: RespondArgs["fallback"] }) =>
      withBusy(() => respond({ ...args, history: [{ role: "user", content: args.cue }] })),
    [withBusy, respond],
  );

  // ----- Live voice mode -----
  const liveAssistantId = useRef<string | null>(null);
  const liveUserId = useRef<string | null>(null);

  const liveCtl = useLiveAi({
    disabled: !live || !session.allowLive || ended,
    systemInstruction: live?.systemInstruction,
    characterName: live?.characterName,
    characterBio: live?.characterBio,
    sessionId: session.sessionId,
    onAssistantText: (text, isNew) => {
      liveUserId.current = null;
      if (isNew || !liveAssistantId.current) {
        liveAssistantId.current = addMessage({ role: "assistant", content: text, name: live?.characterName, streaming: true }).id;
      } else {
        const id = liveAssistantId.current;
        streamMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)));
      }
    },
    onUserText: (text) => {
      if (!liveUserId.current) {
        liveUserId.current = addMessage({ role: "user", content: text }).id;
      } else {
        const id = liveUserId.current;
        streamMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: text } : m));
      }
    },
    onTurnComplete: () => {
      if (liveAssistantId.current) patchMessage(liveAssistantId.current, { streaming: false });
      liveAssistantId.current = null;
      liveUserId.current = null;
      void afterTurn();
    },
  });

  /**
   * Runs a full turn: adds the student's message, lets `reply` produce the AI
   * answer(s), then syncs with the server (JEV). In live mode the text is
   * forwarded to the voice session instead.
   */
  const runTurn = useCallback(async (text: string, reply: () => Promise<unknown>, userName?: string, target?: string) => {
    if (!text.trim() || busy || ended) return;
    addMessage({ role: "user", content: text.trim(), name: userName, speakerKey: target });
    if (liveCtl.liveMode && liveCtl.sendLiveText(text.trim())) return;
    await withBusy(reply);
    await afterTurn();
  }, [busy, ended, addMessage, afterTurn, liveCtl, withBusy]);

  useEffect(() => {
    if (ended && liveCtl.liveMode) liveCtl.finishLive(); // let the character finish the last answer
  }, [ended, liveCtl]);

  /** Asks again for a reply that failed, then syncs the turn with the server. */
  const retry = useCallback(async (id: string) => {
    const again = retries.current.get(id);
    if (!again || busy) return;
    retries.current.delete(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    await withBusy(again);
    await afterTurn();
  }, [busy, setMessages, afterTurn, withBusy]);

  const reset = useCallback((initial: ActivityMessage[] = []) => {
    liveCtl.stopLive();
    retries.current.clear();
    setMessages(initial);
    setBusy(false);
  }, [liveCtl, setMessages]);

  return {
    messages,
    messagesRef,
    setMessages,
    addMessage,
    patchMessage,
    respond,
    open,
    retry,
    /** Whether a failed reply can be asked again. */
    canRetry: (id: string) => retries.current.has(id),
    runTurn,
    afterTurn,
    busy,
    withBusy,
    ended,
    live: liveCtl,
    reset,
  };
};

export type ChatEngine = ReturnType<typeof useChatEngine>;
