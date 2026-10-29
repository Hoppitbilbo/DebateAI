import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityMessage } from "./types";
import { toHistory, useChatEngine } from "./useChatEngine";
import type { ActivitySession } from "./useActivitySession";
import type { AiClient } from "@/services/aiClient";
import AiClientProvider from "@/services/AiClientProvider";
import type { UseLiveAiOptions } from "@/hooks/useLiveAi";

// Characterization tests for useChatEngine (refactoring task 0.4).

const mocks = vi.hoisted(() => ({
  generateStream: vi.fn(),
  toastError: vi.fn(),
  liveOptions: vi.fn(),
  live: { liveMode: false, liveState: "off", liveAvailable: false, toggleLive: vi.fn(), stopLive: vi.fn(), finishLive: vi.fn(), sendLiveText: vi.fn() },
}));

vi.mock("@/hooks/useLiveAi", () => ({ useLiveAi: (options: UseLiveAiOptions) => {
  mocks.liveOptions(options);
  return mocks.live;
} }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

// The AI gateway is replaced through AiClientProvider, not by mocking modules.
const fakeAi = {
  generateStream: (...args: Parameters<AiClient["generateStream"]>) => mocks.generateStream(...args),
  formatError: (e: unknown) => `ERR: ${(e as Error).message}`,
} as AiClient;
const withAi = ({ children }: { children: ReactNode }) => <AiClientProvider client={fakeAi}>{children}</AiClientProvider>;

const fakeSession = (overrides: Partial<ActivitySession> = {}) =>
  ({
    sync: vi.fn().mockResolvedValue(null),
    getSessionId: () => 7,
    sessionId: 7,
    allowLive: true,
    endReason: null,
    ...overrides,
  }) as unknown as ActivitySession;

const msg = (role: ActivityMessage["role"], content: string, extra: Partial<ActivityMessage> = {}): ActivityMessage => ({
  id: content,
  role,
  content,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.live.liveMode = false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("toHistory", () => {
  it("drops system, error and empty messages and maps roles", () => {
    const history = toHistory([
      msg("system", "intro"),
      msg("user", "ciao"),
      msg("assistant", "boom", { error: true }),
      msg("assistant", "  "),
      msg("assistant", "salve"),
    ]);
    expect(history).toEqual([
      { role: "user", content: "ciao" },
      { role: "assistant", content: "salve" },
    ]);
  });

  it("keeps user messages addressed to the given speaker or to everyone", () => {
    const history = toHistory(
      [msg("user", "a tutti"), msg("user", "solo A", { speakerKey: "a" }), msg("user", "solo B", { speakerKey: "b" })],
      "a",
    );
    expect(history.map((m) => m.content)).toEqual(["a tutti", "solo A"]);
  });
});

describe("useChatEngine", () => {
  it("batches streaming renders and syncs the full answer before the next frame", async () => {
    vi.useFakeTimers();
    let onDelta: Parameters<AiClient["generateStream"]>[1];
    let finish: (value: string) => void;
    mocks.generateStream.mockImplementation((_options, callback) => {
      onDelta = callback;
      return new Promise<string>((resolve) => { finish = resolve; });
    });
    const session = fakeSession();
    const { result } = renderHook(() => useChatEngine({ session }), { wrapper: withAi });
    let turn: Promise<void>;
    act(() => { turn = result.current.runTurn("Ciao", () => result.current.respond({ system: "s" })); });
    act(() => onDelta("Uno", "Uno"));
    act(() => onDelta(" due", "Uno due"));
    expect(result.current.messages[1].content).toBe("");
    expect(result.current.messagesRef.current[1].content).toBe("Uno due");
    act(() => vi.advanceTimersToNextFrame());
    expect(result.current.messages[1].content).toBe("Uno due");
    act(() => onDelta(" tre", "Uno due tre"));
    await act(async () => { finish("Uno due tre"); await turn; });
    expect(result.current.messages[1]).toMatchObject({ content: "Uno due tre", streaming: false });
    expect(session.sync).toHaveBeenCalledWith(result.current.messagesRef.current, undefined, {});
    expect(vi.getTimerCount()).toBe(0);
  });

  it("flushes live transcriptions at turn end without losing buffered words", async () => {
    vi.useFakeTimers();
    const session = fakeSession();
    const { result } = renderHook(() => useChatEngine({ session, live: { characterName: "Dante" } }), { wrapper: withAi });
    const live = (): UseLiveAiOptions => mocks.liveOptions.mock.lastCall![0];
    act(() => live().onUserText!("La", false));
    act(() => live().onUserText!("La domanda", true));
    act(() => live().onAssistantText("La", true));
    act(() => live().onAssistantText(" risposta", false));
    expect(result.current.messagesRef.current.map((m) => m.content)).toEqual(["La domanda", "La risposta"]);
    await act(async () => live().onTurnComplete!());
    expect(result.current.messages.map((m) => m.content)).toEqual(["La domanda", "La risposta"]);
    expect(result.current.messages[1].streaming).toBe(false);
    expect(session.sync).toHaveBeenCalledWith(result.current.messagesRef.current, undefined, {});
    expect(vi.getTimerCount()).toBe(0);
  });

  it("runs a turn: user message, reply, then sync with context", async () => {
    const session = fakeSession({ sync: vi.fn().mockResolvedValue("goal_reached") });
    const onEnded = vi.fn();
    const { result } = renderHook(() => useChatEngine({ session, context: { topic: "t" }, onEnded }), { wrapper: withAi });
    const reply = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.runTurn("  ciao  ", reply, "Io", "a");
    });
    expect(reply).toHaveBeenCalledOnce();
    expect(result.current.messages).toMatchObject([{ role: "user", content: "ciao", name: "Io", speakerKey: "a" }]);
    expect(session.sync).toHaveBeenCalledWith(result.current.messagesRef.current, { topic: "t" }, {});
    expect(onEnded).toHaveBeenCalledWith("goal_reached");
    expect(result.current.busy).toBe(false);
  });

  it("ignores blank input and ended activities", async () => {
    const reply = vi.fn();
    const blank = renderHook(() => useChatEngine({ session: fakeSession() }), { wrapper: withAi });
    await act(async () => {
      await blank.result.current.runTurn("   ", reply);
    });
    const ended = renderHook(() => useChatEngine({ session: fakeSession({ endReason: "turn_limit" }) }), { wrapper: withAi });
    expect(ended.result.current.ended).toBe(true);
    await act(async () => {
      await ended.result.current.runTurn("ciao", reply);
    });
    expect(reply).not.toHaveBeenCalled();
    expect(ended.result.current.messages).toEqual([]);
  });

  it("forwards text to the live session instead of replying", async () => {
    mocks.live.liveMode = true;
    mocks.live.sendLiveText.mockReturnValue(true);
    const session = fakeSession();
    const reply = vi.fn();
    const { result } = renderHook(() => useChatEngine({ session }), { wrapper: withAi });
    await act(async () => {
      await result.current.runTurn("ciao", reply);
    });
    expect(mocks.live.sendLiveText).toHaveBeenCalledWith("ciao");
    expect(reply).not.toHaveBeenCalled();
    expect(session.sync).not.toHaveBeenCalled();
  });

  it("streams a reply into a new assistant message", async () => {
    mocks.generateStream.mockImplementation(async (_opts, onDelta) => {
      onDelta("Sal", "Sal");
      onDelta("ve", "Salve");
      return "Salve";
    });
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }), { wrapper: withAi });
    act(() => result.current.reset([msg("user", "ciao")]));

    let text: unknown;
    await act(async () => {
      text = await result.current.respond({ system: "sys", name: "Napoleone", maxTokens: 100 });
    });
    expect(text).toBe("Salve");
    expect(mocks.generateStream.mock.calls[0][0]).toEqual({
      task: "chat",
      system: "sys",
      messages: [{ role: "user", content: "ciao" }],
      sessionId: 7,
      maxTokens: 100,
    });
    expect(result.current.messages[1]).toMatchObject({ role: "assistant", content: "Salve", name: "Napoleone", streaming: false });
  });

  it("marks the reply as an error when generation fails", async () => {
    mocks.generateStream.mockRejectedValue(new Error("quota"));
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }), { wrapper: withAi });
    let text: unknown;
    await act(async () => {
      text = await result.current.respond({ system: "sys" });
    });
    expect(text).toBeNull();
    expect(result.current.messages[0]).toMatchObject({ content: "ERR: quota", error: true, streaming: false });
    expect(mocks.toastError).toHaveBeenCalledWith("ERR: quota");
  });

  it("reset stops live mode and replaces the messages", () => {
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }), { wrapper: withAi });
    act(() => result.current.reset([msg("system", "intro")]));
    expect(mocks.live.stopLive).toHaveBeenCalled();
    expect(result.current.messagesRef.current).toEqual([msg("system", "intro")]);
  });

  it("lets the student retry a failed reply and syncs the turn again", async () => {
    const session = fakeSession();
    const { result } = renderHook(() => useChatEngine({ session }), { wrapper: withAi });
    mocks.generateStream.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("eccomi");
    await act(() => result.current.runTurn("ciao", () => result.current.respond({ system: "s", name: "N" })));
    const failed = result.current.messages[1];
    expect(failed).toMatchObject({ error: true, content: "ERR: down" });
    expect(result.current.canRetry(failed.id)).toBe(true);

    await act(() => result.current.retry(failed.id));
    expect(result.current.messages.map((m) => m.content)).toEqual(["ciao", "eccomi"]);
    expect(session.sync).toHaveBeenCalledTimes(2);
  });

  it("opens with the character's own words from a hidden stage direction", async () => {
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }), { wrapper: withAi });
    mocks.generateStream.mockResolvedValueOnce("Sono Napoleone!");
    await act(() => result.current.open({ system: "s", cue: "[apri]", name: "Napoleone", fallback: { role: "system", content: "intro" } }));
    expect(mocks.generateStream.mock.calls[0][0].messages).toEqual([{ role: "user", content: "[apri]" }]);
    expect(result.current.messages).toMatchObject([{ role: "assistant", name: "Napoleone", content: "Sono Napoleone!" }]);

    mocks.generateStream.mockRejectedValueOnce(new Error("down"));
    await act(() => result.current.open({ system: "s", cue: "[apri]", name: "Napoleone", fallback: { role: "system", content: "intro" } }));
    expect(result.current.messages[1]).toMatchObject({ role: "system", content: "intro" });
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
