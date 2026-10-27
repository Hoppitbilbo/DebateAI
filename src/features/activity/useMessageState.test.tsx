import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMessageState } from "./useMessageState";
import type { ActivityMessage } from "./types";

const message = (content: string): ActivityMessage => ({ id: "reply", role: "assistant", content });

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("useMessageState", () => {
  it("retains every chunk immediately while publishing only once per frame", () => {
    const renders = vi.fn();
    const { result } = renderHook(() => { renders(); return useMessageState(); });
    act(() => result.current.setMessages([message("")]));
    renders.mockClear();

    for (const part of ["Uno", " due", " tre"]) {
      act(() => result.current.streamMessages((previous) => [{ ...previous[0], content: previous[0].content + part }]));
    }
    expect(result.current.messages[0].content).toBe("");
    expect(result.current.messagesRef.current[0].content).toBe("Uno due tre");
    expect(renders).not.toHaveBeenCalled();
    act(() => vi.advanceTimersToNextFrame());
    expect(result.current.messages[0].content).toBe("Uno due tre");
    expect(renders).toHaveBeenCalledOnce();
  });

  it.each(["Risposta completa", "Errore", "Nuova conversazione"])("publishes %s immediately and cancels the pending frame", (content) => {
    const { result } = renderHook(useMessageState);
    act(() => result.current.streamMessages([message("Parziale")]));
    act(() => result.current.setMessages([message(content)]));
    expect(result.current.messages[0].content).toBe(content);
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersToNextFrame());
    expect(result.current.messages[0].content).toBe(content);
  });

  it("cancels pending work on unmount and ignores late render scheduling", () => {
    const { result, unmount } = renderHook(useMessageState);
    const stream = result.current.streamMessages;
    act(() => stream([message("Parziale")]));
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    stream([message("In ritardo")]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("continues streaming after StrictMode's effect cleanup", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(useMessageState, { wrapper });
    act(() => result.current.streamMessages([message("Risposta")]));
    act(() => vi.advanceTimersToNextFrame());
    expect(result.current.messages[0].content).toBe("Risposta");
  });
});
