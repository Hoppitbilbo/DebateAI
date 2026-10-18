import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/services/aiService";
import { useAiClient } from "@/services/aiClient";
import { useLiveAi } from "@/hooks/useLiveAi";
import type { ActivitySession, EndReason } from "./useActivitySession";
import { ActivityMessage, newId } from "./types";

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
  const [messages, setMessagesState] = useState<ActivityMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef<ActivityMessage[]>([]);
  const contextRef = useRef(context);
  contextRef.current = context;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const setMessages = useCallback((next: ActivityMessage[] | ((prev: ActivityMessage[]) => ActivityMessage[])) => {
    const value = typeof next === "function" ? next(messagesRef.current) : next;
    messagesRef.current = value;
    setMessagesState(value);
  }, []);

  const ended = session.endReason === "goal_reached" || session.endReason === "turn_limit";

  const afterTurn = useCallback(async () => {
    const reason = await session.sync(messagesRef.current, contextRef.current);
    if (reason) onEndedRef.current?.(reason);
  }, [session]);

  const addMessage = useCallback((m: Omit<ActivityMessage, "id">) => {
    const msg = { ...m, id: newId() };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }, [setMessages]);

  const patchMessage = useCallback((id: string, patch: Partial<ActivityMessage>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, [setMessages]);

  /** Streams one assistant reply into the conversation. Returns the text or null on error. */
  const respond = useCallback(async (args: { system: string; history?: ChatMessage[]; name?: string; speakerKey?: string; maxTokens?: number }) => {
    const msg = addMessage({ role: "assistant", content: "", name: args.name, speakerKey: args.speakerKey, streaming: true });
    try {
      const text = await ai.generateStream(
        { task: "chat", system: args.system, messages: args.history ?? toHistory(messagesRef.current.filter((m) => m.id !== msg.id), args.speakerKey), sessionId: session.getSessionId(), maxTokens: args.maxTokens },
        (_d, full) => patchMessage(msg.id, { content: full }),
      );
      patchMessage(msg.id, { content: text || "…", streaming: false });
      return text;
    } catch (e) {
      patchMessage(msg.id, { content: ai.formatError(e), streaming: false, error: true });
      toast.error(ai.formatError(e));
      return null;
    }
  }, [addMessage, patchMessage, session, ai]);

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
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)));
      }
    },
    onUserText: (text) => {
      if (!liveUserId.current) {
        liveUserId.current = addMessage({ role: "user", content: text }).id;
      } else {
        patchMessage(liveUserId.current, { content: text });
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
    setBusy(true);
    try {
      await reply();
    } finally {
      setBusy(false);
    }
    await afterTurn();
  }, [busy, ended, addMessage, afterTurn, liveCtl]);

  useEffect(() => {
    if (ended && liveCtl.liveMode) liveCtl.stopLive();
  }, [ended, liveCtl]);

  const reset = useCallback((initial: ActivityMessage[] = []) => {
    liveCtl.stopLive();
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
    runTurn,
    afterTurn,
    busy,
    setBusy,
    ended,
    live: liveCtl,
    reset,
  };
};

export type ChatEngine = ReturnType<typeof useChatEngine>;
