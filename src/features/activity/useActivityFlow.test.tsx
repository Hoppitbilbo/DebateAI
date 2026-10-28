import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActivityFlow } from "./useActivityFlow";

// Tests for the shared activity steps (refactoring task 5.1).

const mocks = vi.hoisted(() => ({
  session: {
    begin: vi.fn().mockResolvedValue(1),
    markManualEnd: vi.fn(),
    assignment: { id: 3, config: { topic: "guerra" } } as unknown,
    minTurns: 4,
  },
  engine: {
    reset: vi.fn(),
    messagesRef: { current: [{ id: "1", role: "user", content: "ciao" }] },
    live: { stopLive: vi.fn() },
  },
  engineOptions: [] as unknown[],
  evaluation: { run: vi.fn(), reset: vi.fn() },
  toast: vi.fn(),
}));

vi.mock("./useActivitySession", () => ({ useActivitySession: () => mocks.session }));
vi.mock("./useChatEngine", () => ({
  useChatEngine: (opts: unknown) => {
    mocks.engineOptions.push(opts);
    return mocks.engine;
  },
}));
vi.mock("./useEvaluationFlow", () => ({ useEvaluationFlow: () => mocks.evaluation }));
vi.mock("sonner", () => ({ toast: { success: mocks.toast } }));

type EngineOptions = { live: unknown; onEnded: (reason: string) => void; context: unknown };
const lastEngineOptions = () => mocks.engineOptions[mocks.engineOptions.length - 1] as EngineOptions;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.engineOptions = [];
});

describe("useActivityFlow", () => {
  it("exposes the assignment preset and the minimum turns", () => {
    const { result } = renderHook(() => useActivityFlow("convinci-tu"));
    expect(result.current.phase).toBe("setup");
    expect(result.current.preset).toEqual({ topic: "guerra" });
    expect(result.current.minTurns).toBe(4);
  });

  it("asks for live settings with the phase and the assignment", () => {
    const live = vi.fn().mockReturnValue(null);
    renderHook(() => useActivityFlow("convinci-tu", { live, context: { topic: "t" } }));
    expect(live).toHaveBeenCalledWith("setup", mocks.session.assignment);
    expect(lastEngineOptions().context).toEqual({ topic: "t" });
  });

  it("goes setup → chat → reflection → feedback → setup", async () => {
    const { result } = renderHook(() => useActivityFlow("convinci-tu"));
    const intro = [{ id: "i", role: "system" as const, content: "via" }];
    await act(async () => {
      await result.current.begin("titolo", { topic: "t" }, intro);
    });
    expect(mocks.session.begin).toHaveBeenCalledWith("titolo", { topic: "t" });
    expect(mocks.engine.reset).toHaveBeenCalledWith(intro);
    expect(result.current.phase).toBe("chat");

    act(() => result.current.finishChat());
    expect(mocks.session.markManualEnd).toHaveBeenCalled();
    expect(mocks.engine.live.stopLive).toHaveBeenCalled();
    expect(result.current.phase).toBe("reflection");

    act(() => result.current.submitReflection("ho capito", { activity: "A", characters: "C" }));
    expect(mocks.evaluation.run).toHaveBeenCalledWith({
      activity: "A",
      characters: "C",
      messages: mocks.engine.messagesRef.current,
      reflection: "ho capito",
    });
    expect(result.current.phase).toBe("feedback");

    const resetSetup = vi.fn();
    act(() => result.current.restart(resetSetup));
    expect(resetSetup).toHaveBeenCalled();
    expect(mocks.evaluation.reset).toHaveBeenCalled();
    expect(result.current.phase).toBe("setup");
  });

  it("keeps the chat on screen when the server ends it, so the last reply can be read", () => {
    const { result } = renderHook(() => useActivityFlow("convinci-tu"));
    act(() => result.current.setPhase("chat"));
    act(() => lastEngineOptions().onEnded("goal_reached"));
    expect(mocks.toast).toHaveBeenCalledWith("platform.activity.goalReachedToast");
    expect(result.current.phase).toBe("chat");
    act(() => result.current.finishChat());
    expect(result.current.phase).toBe("reflection");
  });

  it("lets the app replace the end-of-chat behaviour", () => {
    const onEnded = vi.fn();
    const { result } = renderHook(() => useActivityFlow("convinci-tu", { onEnded }));
    act(() => lastEngineOptions().onEnded("turn_limit"));
    expect(onEnded).toHaveBeenCalledWith("turn_limit");
    expect(result.current.phase).toBe("setup");
  });
});
