import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { restoredMessages, titleOf, useActivityFlow } from "./useActivityFlow";

// Tests for the shared activity steps (refactoring task 5.1).

const mocks = vi.hoisted(() => ({
  session: {
    begin: vi.fn().mockResolvedValue(1),
    resume: vi.fn().mockResolvedValue(null),
    forget: vi.fn(),
    markManualEnd: vi.fn(),
    resumeId: 0,
    user: null as unknown,
    loadingAssignment: false,
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
vi.mock("sonner", () => ({ toast: { success: mocks.toast, error: mocks.toast, info: mocks.toast } }));

type EngineOptions = { live: unknown; onEnded: (reason: string) => void; context: unknown };
const lastEngineOptions = () => mocks.engineOptions[mocks.engineOptions.length - 1] as EngineOptions;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.engineOptions = [];
  mocks.session.resumeId = 0;
  mocks.session.user = null;
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
    expect(mocks.session.forget).toHaveBeenCalled(); // a restart is a new attempt
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

  it("stays on the setup when an assignment's attempt could not be created", async () => {
    mocks.session.begin.mockResolvedValueOnce(null);
    Object.assign(mocks.session, { user: { id: 1 } });
    const { result } = renderHook(() => useActivityFlow("convinci-tu"));
    let started: unknown;
    await act(async () => {
      started = await result.current.begin("t", {}, []);
    });
    expect(started).toBe(false);
    expect(result.current.phase).toBe("setup");
    expect(mocks.engine.reset).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalled();
    Object.assign(mocks.session, { user: undefined });
  });

  it("takes up the attempt in the address after a reload", async () => {
    mocks.session.resumeId = 9;
    mocks.session.user = { id: 1 };
    mocks.session.resume.mockResolvedValueOnce({
      context: { characters: [{ title: "Cesare" }, "Napoleone"], theme: "guerra" },
      transcript: [
        { role: "user", content: "Iniziate" },
        { role: "assistant", content: "Veni vidi vici", name: "Cesare" },
        { role: "assistant", content: "Impossible n'est pas français", name: "Napoleone" },
      ],
    });
    const restore = vi.fn();
    const { result } = renderHook(() => useActivityFlow("you-moderate", { restore }));
    await act(async () => {});
    expect(mocks.session.resume).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith({ characters: [{ title: "Cesare" }, "Napoleone"], theme: "guerra" }, expect.any(Array));
    expect(mocks.engine.reset.mock.calls[0][0]).toMatchObject([
      { role: "user", content: "Iniziate" },
      { role: "assistant", name: "Cesare", speakerKey: "a" },
      { role: "assistant", name: "Napoleone", speakerKey: "b" },
    ]);
    expect(result.current.phase).toBe("chat");
  });

  it("stays on the setup when there is nothing to resume", async () => {
    mocks.session.resumeId = 9;
    mocks.session.user = { id: 1 };
    const { result } = renderHook(() => useActivityFlow("convinci-tu"));
    await act(async () => {});
    expect(mocks.session.resume).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("setup");
  });
});

describe("restoring a saved attempt", () => {
  it("reads titles saved as text or as references", () => {
    expect(titleOf("Cesare")).toBe("Cesare");
    expect(titleOf({ title: "Cesare" })).toBe("Cesare");
    expect(titleOf({ title: " " })).toBeUndefined();
    expect(titleOf(undefined)).toBeUndefined();
  });

  it("leaves the speaker out when the app has one character", () => {
    expect(restoredMessages([{ role: "assistant", content: "Salve", name: "Cesare" }], { character: "Cesare" })[0].speakerKey).toBeUndefined();
  });
});
