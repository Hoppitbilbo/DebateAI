import { useCallback, useEffect, useRef } from "react";
import type { ActivityMessage } from "./types";

const BOTTOM_TOLERANCE_PX = 1;

/** Preserve autoscroll when deferred content changes height after a message renders. */
export const useChatScroll = (messages: ActivityMessage[]) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, []);

  useEffect(() => {
    atBottom.current = true;
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const trackPosition = () => {
      atBottom.current = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop <= BOTTOM_TOLERANCE_PX;
    };
    viewport.addEventListener("scroll", trackPosition, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (atBottom.current) scrollToBottom();
    });
    observer?.observe(content);
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener("scroll", trackPosition);
      observer?.disconnect();
    };
  }, [scrollToBottom]);

  return { viewportRef, contentRef };
};
