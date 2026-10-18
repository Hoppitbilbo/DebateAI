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
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/api", () => ({ api: mocks.api }));

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

  it("drops the answer of a sync superseded by a newer one", async () => {
    const { result } = await loggedIn();
    let resolveFirst: (v: unknown) => void = () => {};
    mocks.api.put
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ status: "active", turns: 2, progress: 0, ended: false });

    let first: Promise<unknown> = Promise.resolve();
    await act(async () => {
      first = result.current.sync([msg("user", "uno")]);
      await result.current.sync([msg("user", "uno"), msg("user", "due")]);
    });
    let firstReason: unknown;
    await act(async () => {
      resolveFirst({ status: "turn_limit", ended: true, reason: "turn_limit" });
      firstReason = await first;
    });
    expect(firstReason).toBeNull();
    expect(result.current.endReason).toBeNull();
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
      await result.current.complete({ reflection: "r", evaluation: "e" });
    });
    expect(mocks.api.post).toHaveBeenLastCalledWith("/api/sessions/42/complete", { reflection: "r", evaluation: "e" });
  });
});
