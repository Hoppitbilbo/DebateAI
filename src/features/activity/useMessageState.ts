import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityMessage } from "./types";

type MessageUpdate = ActivityMessage[] | ((previous: ActivityMessage[]) => ActivityMessage[]);

/** Keep the transcript current, but publish streaming updates at most once per frame. */
export const useMessageState = () => {
  const [messages, publish] = useState<ActivityMessage[]>([]);
  const messagesRef = useRef<ActivityMessage[]>([]);
  const frame = useRef<number | null>(null);
  const mounted = useRef(true);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelFrame();
    };
  }, [cancelFrame]);

  const updateTranscript = useCallback((next: MessageUpdate) => {
    messagesRef.current = typeof next === "function" ? next(messagesRef.current) : next;
  }, []);

  const setMessages = useCallback((next: MessageUpdate) => {
    cancelFrame();
    updateTranscript(next);
    if (mounted.current) publish(messagesRef.current);
  }, [cancelFrame, updateTranscript]);

  const streamMessages = useCallback((next: MessageUpdate) => {
    updateTranscript(next);
    if (!mounted.current || frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      publish(messagesRef.current);
    });
  }, [updateTranscript]);

  return { messages, messagesRef, setMessages, streamMessages };
};
