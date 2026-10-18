import { act, renderHook, waitFor } from "@testing-library/react";
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
}));
vi.mock("@/features/auth/authApi", () => ({ authApi: mocks.authApi }));

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

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
});
