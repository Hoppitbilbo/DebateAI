import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivitySession } from "./useActivitySession";
import { useEvaluationFlow } from "./useEvaluationFlow";

const mocks = vi.hoisted(() => ({ evaluateActivity: vi.fn() }));

vi.mock("@/i18n", () => ({ default: { language: "en" } }));
vi.mock("@/utils/evaluationUtils", () => ({
  evaluateActivity: mocks.evaluateActivity,
  parseEvaluation: (text: string) => ({ markdown: text }),
}));
vi.mock("@/services/aiClient", () => ({ useAiClient: () => ({ formatError: (e: Error) => e.message }) }));

const fakeSession = (evaluate: ActivitySession["evaluate"]) =>
  ({ evaluate, complete: vi.fn().mockResolvedValue(true), assignment: null, jev: null }) as unknown as ActivitySession;

const input = { activity: "WikiChat", characters: "Napoleone", messages: [], reflection: "r" };

beforeEach(() => mocks.evaluateActivity.mockReset());

describe("useEvaluationFlow", () => {
  it("shows the server's evaluation of a saved attempt", async () => {
    const evaluate = vi.fn().mockResolvedValue({ evaluation: "## Bravo", scoreConversation: 8 });
    const session = fakeSession(evaluate);
    const { result } = renderHook(() => useEvaluationFlow(session));
    await act(() => result.current.run(input));
    expect(evaluate).toHaveBeenCalledWith({ activity: "WikiChat", characters: "Napoleone", reflection: "r", locale: "en" }, expect.any(Function));
    expect(result.current.evaluation).toEqual({ markdown: "## Bravo", scoreConversation: 8, scoreReflection: undefined });
    expect(mocks.evaluateActivity).not.toHaveBeenCalled();
    expect(session.complete).not.toHaveBeenCalled();
  });

  it("evaluates locally without a server session", async () => {
    mocks.evaluateActivity.mockResolvedValue({ markdown: "local" });
    const { result } = renderHook(() => useEvaluationFlow(fakeSession(vi.fn().mockResolvedValue(null))));
    await act(() => result.current.run(input));
    expect(result.current.evaluation).toEqual({ markdown: "local" });
  });

  it("hands in the reflection alone when the evaluation fails", async () => {
    const session = fakeSession(vi.fn().mockRejectedValue(new Error("no model")));
    const { result } = renderHook(() => useEvaluationFlow(session));
    await act(() => result.current.run(input));
    expect(result.current.error).toBe("no model");
    expect(session.complete).toHaveBeenCalledWith({ reflection: "r" });
  });

  it("shows the streamed evaluation at most once per frame", async () => {
    let finish: (v: unknown) => void = () => {};
    const evaluate = vi.fn((_req: unknown, onDelta: (d: string, full: string) => void) => {
      onDelta("a", "## A");
      onDelta("b", "## AB");
      onDelta("c", "## ABC");
      return new Promise((resolve) => (finish = resolve));
    });
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    const { result } = renderHook(() => useEvaluationFlow(fakeSession(evaluate as unknown as ActivitySession["evaluate"])));
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.run(input);
    });
    expect(frames).toHaveLength(1); // three chunks, one frame
    expect(result.current.partial).toBe("");
    act(() => frames[0](0));
    expect(result.current.partial).toBe("## ABC");
    await act(async () => {
      finish({ evaluation: "## Fine" });
      await running;
    });
    expect(result.current.evaluation?.markdown).toBe("## Fine");
    vi.restoreAllMocks();
  });
});
