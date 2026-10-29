import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityMessage } from "./types";
import { useActivitySession } from "./useActivitySession";

// Characterization tests for useActivitySession (refactoring task 0.4).

const mocks = vi.hoisted(() => ({
  user: null as null | { id: number },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  evaluateSession: vi.fn(),
}));

vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));
vi.mock("@/services/aiService", () => ({ evaluateSession: mocks.evaluateSession }));

const assignment = { id: 5, appType: "convinci-tu", maxTurns: 3, minTurns: 1, allowLive: false, requireReflection: false };

const render = (url = "/apps/convinci-tu") =>
  renderHook(() => useActivitySession("convinci-tu"), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>,
  });

const msg = (role: ActivityMessage["role"], content: string, extra: Partial<ActivityMessage> = {}): ActivityMessage => ({
  id: Math.random().toString(36),
  role,
  content,
  ...extra,
});

beforeEach(() => {
  mocks.user = null;
  Object.values(mocks.api).forEach((fn) => fn.mockReset());
  mocks.evaluateSession.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("guest mode", () => {
  it("keeps everything local", async () => {
    const { result } = render();
    let id: number | null = 1;
    await act(async () => {
      id = await result.current.begin("title");
    });
    expect(id).toBeNull();

    let reason: unknown;
    await act(async () => {
      reason = await result.current.sync([msg("user", "ciao"), msg("user", "  "), msg("assistant", "salve")]);
    });
    expect(reason).toBeNull();
    expect(result.current.turns).toBe(1);
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(mocks.api.put).not.toHaveBeenCalled();
    expect(result.current.allowLive).toBe(true);
    expect(result.current.requireReflection).toBe(true);
    expect(result.current.turnsLeft).toBeNull();
  });
});

describe("assignment loading", () => {
  it("loads ?assignment=ID for logged-in users", async () => {
    mocks.user = { id: 1 };
    mocks.api.get.mockResolvedValue(assignment);
    const { result } = render("/apps/convinci-tu?assignment=5");
    await waitFor(() => expect(result.current.loadingAssignment).toBe(false));
    expect(mocks.api.get).toHaveBeenCalledWith("/api/assignments/5");
    expect(result.current.assignment).toEqual(assignment);
    expect(result.current.allowLive).toBe(false);
    expect(result.current.turnsLeft).toBe(3);
  });

  it("rejects an assignment for another app", async () => {
    mocks.user = { id: 1 };
    mocks.api.get.mockResolvedValue({ ...assignment, appType: "impersona-tu" });
    const { result } = render("/apps/convinci-tu?assignment=5");
    await waitFor(() => expect(result.current.assignmentError).toBe("wrong_app"));
    expect(result.current.assignment).toBeNull();
  });
});

describe("server session", () => {
  const loggedIn = async () => {
    mocks.user = { id: 1 };
    mocks.api.get.mockResolvedValue(assignment);
    mocks.api.post.mockResolvedValue({ id: 42 });
    const hook = render("/apps/convinci-tu?assignment=5");
    await waitFor(() => expect(hook.result.current.assignment).not.toBeNull());
    await act(async () => {
      await hook.result.current.begin("Napoleone: guerra", { topic: "guerra" });
    });
    return hook;
  };

  it("creates the session for the assignment", async () => {
    const { result } = await loggedIn();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/sessions", {
      appType: "convinci-tu",
      assignmentId: 5,
      title: "Napoleone: guerra",
      context: { topic: "guerra" },
    });
    expect(result.current.sessionId).toBe(42);
    expect(result.current.getSessionId()).toBe(42);
  });

  it("sends only finished, non-empty messages and reports the judge's end reason", async () => {
    const { result } = await loggedIn();
    const jev = { engine: "jev", progress: 100, completed: true, goals: [] };
    mocks.api.put.mockResolvedValue({ status: "goal_reached", turns: 1, progress: 100, ended: true, reason: "goal_reached", jev });

    let reason: unknown;
    await act(async () => {
      reason = await result.current.sync(
        [msg("system", "intro"), msg("user", "ciao", { name: "Io" }), msg("assistant", "", {}), msg("assistant", "parz", { streaming: true })],
        { topic: "guerra" },
      );
    });
    expect(mocks.api.put).toHaveBeenCalledWith("/api/sessions/42/transcript", {
      messages: [
        { role: "system", content: "intro", name: undefined },
        { role: "user", content: "ciao", name: "Io" },
      ],
      context: { topic: "guerra" },
      baseRevision: 0,
    });
    expect(reason).toBe("goal_reached");
    expect(result.current.endReason).toBe("goal_reached");
    expect(result.current.jev).toEqual(jev);
    expect(result.current.judging).toBe(false);
  });

  it("ignores a judgement with engine none", async () => {
    const { result } = await loggedIn();
    mocks.api.put.mockResolvedValue({ status: "active", turns: 1, progress: 0, ended: false, jev: { engine: "none" } });
    await act(async () => {
      await result.current.sync([msg("user", "ciao")]);
    });
    expect(result.current.jev).toBeNull();
    expect(result.current.endReason).toBeNull();
  });

  it("sends saves one at a time on the previous revision and drops a superseded answer", async () => {
    const { result } = await loggedIn();
    let resolveFirst: (v: unknown) => void = () => {};
    mocks.api.put
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ status: "active", turns: 2, progress: 0, ended: false, revision: 2 });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.sync([msg("user", "uno")]);
      second = result.current.sync([msg("user", "uno"), msg("user", "due")]);
    });
    // the second save waits for the first
    expect(mocks.api.put).toHaveBeenCalledTimes(1);
    let firstReason: unknown;
    await act(async () => {
      resolveFirst({ status: "turn_limit", ended: true, reason: "turn_limit", revision: 1 });
      firstReason = await first;
      await second;
    });
    expect(mocks.api.put).toHaveBeenCalledTimes(2);
    expect(mocks.api.put.mock.calls[0][1].baseRevision).toBe(0);
    expect(mocks.api.put.mock.calls[1][1].baseRevision).toBe(1);
    expect(firstReason).toBeNull();
    expect(result.current.endReason).toBeNull();
  });

  it("saves without a base revision after a stale one", async () => {
    const { result } = await loggedIn();
    mocks.api.put
      .mockRejectedValueOnce(Object.assign(new Error("stale"), { code: "stale_revision" }))
      .mockResolvedValueOnce({ status: "active", turns: 1, progress: 0, ended: false, revision: 5 });
    await act(async () => {
      await result.current.sync([msg("user", "uno")]);
      await result.current.sync([msg("user", "uno")]);
    });
    expect(mocks.api.put.mock.calls[1][1]).not.toHaveProperty("baseRevision");
  });

  it("swallows sync errors", async () => {
    const { result } = await loggedIn();
    mocks.api.put.mockRejectedValue(new Error("offline"));
    let reason: unknown = "x";
    await act(async () => {
      reason = await result.current.sync([msg("user", "ciao")]);
    });
    expect(reason).toBeNull();
    expect(result.current.judging).toBe(false);
  });

  it("enforces maxTurns locally when the session could not be created", async () => {
    mocks.user = { id: 1 };
    mocks.api.get.mockResolvedValue(assignment);
    mocks.api.post.mockRejectedValue(new Error("down"));
    const { result } = render("/apps/convinci-tu?assignment=5");
    await waitFor(() => expect(result.current.assignment).not.toBeNull());
    await act(async () => {
      await result.current.begin("t");
    });
    let reason: unknown;
    await act(async () => {
      reason = await result.current.sync([msg("user", "1"), msg("user", "2"), msg("user", "3")]);
    });
    expect(reason).toBe("turn_limit");
    expect(result.current.turnsLeft).toBe(0);
  });

  it("completes the session and keeps an earlier end reason on manual end", async () => {
    const { result } = await loggedIn();
    mocks.api.put.mockResolvedValue({ status: "turn_limit", ended: true, reason: "turn_limit" });
    await act(async () => {
      await result.current.sync([msg("user", "ciao")]);
    });
    act(() => result.current.markManualEnd());
    expect(result.current.endReason).toBe("turn_limit");

    mocks.api.post.mockResolvedValue({ ok: true });
    await act(async () => {
      await result.current.complete({ reflection: "r" });
    });
    expect(mocks.api.post).toHaveBeenLastCalledWith("/api/sessions/42/complete", { reflection: "r" });
  });

  it("reports a failed save and sends it again on retry", async () => {
    const { result } = await loggedIn();
    mocks.api.put.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "active", turns: 1, progress: 0, ended: false, revision: 1 });
    await act(async () => {
      await result.current.sync([msg("user", "ciao")]);
    });
    expect(result.current.saveState).toBe("failed");
    await act(async () => {
      await result.current.retrySave();
    });
    expect(mocks.api.put).toHaveBeenCalledTimes(2);
    expect(mocks.api.put.mock.calls[1][1].messages).toEqual([{ role: "user", content: "ciao", name: undefined }]);
    expect(result.current.saveState).toBe("saved");
  });

  it("tells a failed hand-in from a successful one", async () => {
    const { result } = await loggedIn();
    mocks.api.post.mockRejectedValueOnce(new Error("offline"));
    let ok: unknown;
    await act(async () => {
      ok = await result.current.complete({ reflection: "r" });
    });
    expect(ok).toBe(false);
    expect(result.current.submitState).toBe("failed");

    mocks.api.post.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      ok = await result.current.retrySubmit();
    });
    expect(ok).toBe(true);
    expect(result.current.submitState).toBe("submitted");
    expect(mocks.api.post).toHaveBeenLastCalledWith("/api/sessions/42/complete", { reflection: "r" });
  });

  it("counts an attempt the server already has as handed in", async () => {
    const { result } = await loggedIn();
    mocks.api.post.mockRejectedValueOnce(Object.assign(new Error("done"), { code: "session_completed" }));
    let ok: unknown;
    await act(async () => {
      ok = await result.current.complete({ reflection: "r" });
    });
    expect(ok).toBe(true);
    expect(result.current.submitState).toBe("submitted");
  });

  it("has the server evaluate after the last save, and keeps failed AI lines out of the transcript", async () => {
    const { result } = await loggedIn();
    let finishSave: (v: unknown) => void = () => {};
    mocks.api.put.mockReturnValueOnce(new Promise((resolve) => (finishSave = resolve)));
    mocks.evaluateSession.mockResolvedValue({ evaluation: "## Bravo", scoreConversation: 8 });
    let graded: unknown;
    await act(async () => {
      void result.current.sync([msg("user", "ciao"), msg("assistant", "network down", { error: true })]);
      const evaluation = result.current.evaluate({ reflection: "r", activity: "a", characters: "c", locale: "it" }, () => {});
      await Promise.resolve();
      expect(mocks.evaluateSession).not.toHaveBeenCalled();
      finishSave({ status: "active", turns: 1, progress: 0, ended: false, revision: 1 });
      graded = await evaluation;
    });
    expect(mocks.api.put.mock.calls[0][1].messages).toEqual([{ role: "user", content: "ciao", name: undefined }]);
    expect(mocks.evaluateSession).toHaveBeenCalledWith(42, expect.objectContaining({ reflection: "r" }), expect.any(Function));
    expect(graded).toEqual({ evaluation: "## Bravo", scoreConversation: 8 });
    expect(result.current.submitState).toBe("submitted");
  });

  it("marks the attempt as not saved when it could not be created", async () => {
    mocks.user = { id: 1 };
    mocks.api.post.mockRejectedValue(new Error("down"));
    const { result } = render();
    let id: unknown = 1;
    await act(async () => {
      id = await result.current.begin("t");
    });
    expect(id).toBeNull();
    expect(result.current.startFailed).toBe(true);
    expect(result.current.starting).toBe(false);
  });
});

