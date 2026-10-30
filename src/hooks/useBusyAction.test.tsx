import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBusyAction } from "./useBusyAction";

const mocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

afterEach(() => vi.clearAllMocks());

describe("useBusyAction", () => {
  it("is busy only while the action runs", async () => {
    let finish!: () => void;
    const { result } = renderHook(() => useBusyAction());
    let done!: Promise<void>;
    act(() => {
      done = result.current.run(() => new Promise<void>((r) => (finish = r)));
    });
    expect(result.current.busy).toBe(true);
    await act(async () => {
      finish();
      await done;
    });
    expect(result.current.busy).toBe(false);
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("shows a failure as a toast and frees the form", async () => {
    const { result } = renderHook(() => useBusyAction());
    await act(() => result.current.run(() => Promise.reject(new Error("Rete assente"))));
    expect(mocks.error).toHaveBeenCalledWith("Rete assente");
    expect(result.current.busy).toBe(false);
  });

  it("lets the caller word the error", async () => {
    const { result } = renderHook(() => useBusyAction(() => "Testo tradotto"));
    await act(() => result.current.run(() => Promise.reject(new Error("raw"))));
    expect(mocks.error).toHaveBeenCalledWith("Testo tradotto");
  });
});

describe("useBusyAction guards", () => {
  it("ignores a second run while the first is in flight (double click)", async () => {
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => (finish = r)));
    const { result } = renderHook(() => useBusyAction());
    let first!: Promise<void>;
    act(() => {
      first = result.current.run(action);
      void result.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
      await first;
    });
    await act(() => result.current.run(() => Promise.resolve()));
    expect(result.current.busy).toBe(false);
  });

  it("keeps the error next to the form with inline, and clears it on the next run", async () => {
    const { result } = renderHook(() => useBusyAction(() => "Testo tradotto", { inline: true }));
    await act(() => result.current.run(() => Promise.reject(new Error("raw"))));
    expect(result.current.error).toBe("Testo tradotto");
    expect(mocks.error).not.toHaveBeenCalled();
    await act(() => result.current.run(() => Promise.resolve()));
    expect(result.current.error).toBeNull();
  });
});
