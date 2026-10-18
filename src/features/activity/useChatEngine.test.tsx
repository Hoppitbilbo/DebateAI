import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityMessage } from "./types";
import { toHistory, useChatEngine } from "./useChatEngine";
import type { ActivitySession } from "./useActivitySession";

// Characterization tests for useChatEngine (refactoring task 0.4).

const mocks = vi.hoisted(() => ({
  generateStream: vi.fn(),
  toastError: vi.fn(),
  live: { liveMode: false, liveState: "off", liveAvailable: false, toggleLive: vi.fn(), stopLive: vi.fn(), sendLiveText: vi.fn() },
}));

vi.mock("@/services/aiService", () => ({
  generateStream: mocks.generateStream,
  formatAiError: (e: unknown) => `ERR: ${(e as Error).message}`,
}));
vi.mock("@/hooks/useLiveAi", () => ({ useLiveAi: () => mocks.live }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

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
  it("runs a turn: user message, reply, then sync with context", async () => {
    const session = fakeSession({ sync: vi.fn().mockResolvedValue("goal_reached") });
    const onEnded = vi.fn();
    const { result } = renderHook(() => useChatEngine({ session, context: { topic: "t" }, onEnded }));
    const reply = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.runTurn("  ciao  ", reply, "Io", "a");
    });
    expect(reply).toHaveBeenCalledOnce();
    expect(result.current.messages).toMatchObject([{ role: "user", content: "ciao", name: "Io", speakerKey: "a" }]);
    expect(session.sync).toHaveBeenCalledWith(result.current.messagesRef.current, { topic: "t" });
    expect(onEnded).toHaveBeenCalledWith("goal_reached");
    expect(result.current.busy).toBe(false);
  });

  it("ignores blank input and ended activities", async () => {
    const reply = vi.fn();
    const blank = renderHook(() => useChatEngine({ session: fakeSession() }));
    await act(async () => {
      await blank.result.current.runTurn("   ", reply);
    });
    const ended = renderHook(() => useChatEngine({ session: fakeSession({ endReason: "turn_limit" }) }));
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
    const { result } = renderHook(() => useChatEngine({ session }));
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
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }));
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
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }));
    let text: unknown;
    await act(async () => {
      text = await result.current.respond({ system: "sys" });
    });
    expect(text).toBeNull();
    expect(result.current.messages[0]).toMatchObject({ content: "ERR: quota", error: true, streaming: false });
    expect(mocks.toastError).toHaveBeenCalledWith("ERR: quota");
  });

  it("reset stops live mode and replaces the messages", () => {
    const { result } = renderHook(() => useChatEngine({ session: fakeSession() }));
    act(() => result.current.reset([msg("system", "intro")]));
    expect(mocks.live.stopLive).toHaveBeenCalled();
    expect(result.current.messagesRef.current).toEqual([msg("system", "intro")]);
  });
});
