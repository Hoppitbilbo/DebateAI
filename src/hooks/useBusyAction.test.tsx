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
