import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { LoginPage, ResetPasswordPage } from "./AuthPages";

// Fixes how the auth forms report busy and errors before the shared
// useBusyAction replaces their try/finally (refactoring task 11.6).

const mocks = vi.hoisted(() => ({ login: vi.fn(), setUser: vi.fn(), resetPassword: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ login: mocks.login, setUser: mocks.setUser, user: null, config: { setupRequired: false } }),
  dashboardPath: () => "/dashboard",
}));
vi.mock("@/features/auth/authApi", () => ({ authApi: { resetPassword: mocks.resetPassword } }));
vi.mock("@/i18n", () => ({ default: { exists: (key: string) => key === "platform.errors.bad_credentials", language: "it" } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const at = (path: string, page: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="*" element={page} />
      </Routes>
    </MemoryRouter>,
  );

const fill = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });

describe("auth forms", () => {
  it("disables the form while logging in and shows a known error", async () => {
    let fail!: (e: Error) => void;
    mocks.login.mockReturnValue(new Promise((_, reject) => (fail = reject)));
    at("/login", <LoginPage />);
    fill("email", "a@b.it");
    fill("password", "secret123");
    fireEvent.submit(screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!);
    expect(screen.getByRole("button", { name: /platform.auth.login/ })).toHaveProperty("disabled", true);

    await act(async () => fail(new ApiError(401, "bad_credentials", "raw")));
    expect(mocks.error).toHaveBeenCalledWith("platform.errors.bad_credentials");
    expect(screen.getByRole("button", { name: /platform.auth.login/ })).toHaveProperty("disabled", false);
  });

  it("falls back to the server message, then to a generic one", async () => {
    mocks.login.mockRejectedValueOnce(new ApiError(500, "unknown_code", "Il server dice no"));
    at("/login", <LoginPage />);
    const form = screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!;
    await act(async () => void fireEvent.submit(form));
    expect(mocks.error).toHaveBeenLastCalledWith("Il server dice no");

    mocks.login.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => void fireEvent.submit(form));
    expect(mocks.error).toHaveBeenLastCalledWith("platform.errors.generic");
  });

  it("goes to the dashboard after logging in", async () => {
    mocks.login.mockResolvedValue({ role: "student" });
    at("/login", <LoginPage />);
    await act(async () => void fireEvent.submit(screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!));
    expect(screen.getByText("dashboard")).toBeTruthy();
  });

  it("checks the repeated password before resetting it", async () => {
    mocks.resetPassword.mockResolvedValue({ role: "student" });
    at("/reset-password?token=t1", <ResetPasswordPage />);
    fill("password", "nuovapass1");
    fill("password2", "diversa123");
    const form = document.querySelector("form")!;
    await act(async () => void fireEvent.submit(form));
    expect(mocks.error).toHaveBeenCalledWith("platform.auth.passwordMismatch");
    expect(mocks.resetPassword).not.toHaveBeenCalled();

    fill("password2", "nuovapass1");
    await act(async () => void fireEvent.submit(form));
    expect(mocks.resetPassword).toHaveBeenCalledWith("t1", "nuovapass1");
    expect(mocks.success).toHaveBeenCalledWith("platform.auth.passwordChanged");
    expect(screen.getByText("dashboard")).toBeTruthy();
  });
});
