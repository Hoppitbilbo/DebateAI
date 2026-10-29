import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./auth";

// The auth context loads the session at start and logs in/out through authApi (task 7.1).

const mocks = vi.hoisted(() => ({
  authApi: {
    publicConfig: vi.fn().mockResolvedValue({ siteName: "Scuola" }),
    me: vi.fn().mockResolvedValue({ user: null }),
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
  },
  resetAiStatus: vi.fn(),
}));
vi.mock("@/features/auth/authApi", () => ({ authApi: mocks.authApi }));
vi.mock("@/services/aiService", () => ({ resetAiStatus: mocks.resetAiStatus }));

let queryClient = new QueryClient();
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);

describe("AuthProvider", () => {
  it("loads the config, logs in and out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ siteName: "Scuola" });
    expect(result.current.user).toBeNull();

    const user = { id: 1, email: "a@x.it", name: "A", role: "admin", locale: "it", active: true, createdAt: "" };
    mocks.authApi.login.mockResolvedValue(user);
    await act(async () => {
      await result.current.login("a@x.it", "secret123");
    });
    expect(mocks.authApi.login).toHaveBeenCalledWith("a@x.it", "secret123");
    expect(result.current.user).toEqual(user);

    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.user).toBeNull();
  });

  it("marks the server unavailable when it cannot load the session", async () => {
    mocks.authApi.me.mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.serverAvailable).toBe(false);
  });

  it("drops the previous account's cached data when the account changes", async () => {
    queryClient = new QueryClient();
    mocks.resetAiStatus.mockClear();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The first session load clears nothing.
    expect(mocks.resetAiStatus).not.toHaveBeenCalled();

    const a = { id: 1, email: "a@x.it", name: "A", role: "student", locale: "it", active: true, createdAt: "" };
    mocks.authApi.login.mockResolvedValue(a);
    await act(async () => {
      await result.current.login("a@x.it", "secret123");
    });
    queryClient.setQueryData(["my-sessions"], [{ id: 7 }]);

    await act(async () => {
      await result.current.logout();
    });
    expect(queryClient.getQueryData(["my-sessions"])).toBeUndefined();
    expect(mocks.resetAiStatus).toHaveBeenCalledTimes(2);

    queryClient.setQueryData(["my-sessions"], [{ id: 8 }]);
    mocks.authApi.login.mockResolvedValue({ ...a, id: 2, email: "b@x.it" });
    await act(async () => {
      await result.current.login("b@x.it", "secret123");
    });
    expect(queryClient.getQueryData(["my-sessions"])).toBeUndefined();
  });
});
