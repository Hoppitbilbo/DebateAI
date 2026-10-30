import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/api";
import { AccountPage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from "./AuthPages";

// Fixes how the auth forms report busy and errors before the shared
// useBusyAction replaces their try/finally (refactoring task 11.6).

const mocks = vi.hoisted(() => ({
  login: vi.fn(), setUser: vi.fn(), resetPassword: vi.fn(), updateProfile: vi.fn(), error: vi.fn(), success: vi.fn(),
  user: null as User | null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ login: mocks.login, setUser: mocks.setUser, user: mocks.user, config: { setupRequired: false } }),
  dashboardPath: () => "/dashboard",
}));
vi.mock("@/features/auth/authApi", () => ({ authApi: { resetPassword: mocks.resetPassword, updateProfile: mocks.updateProfile, forgotPassword: vi.fn() } }));
vi.mock("@/features/tour/tour", () => ({ useTour: () => ({ enabled: true, setEnabled: vi.fn(), resetSeen: vi.fn() }) }));
vi.mock("@/i18n", () => ({ default: { exists: (key: string) => key === "platform.errors.bad_credentials", language: "it" } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user = null;
});

const at = (path: string, page: React.ReactElement) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="/iscriviti" element={<p>enroll page</p>} />
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
    fill("identifier", "a@b.it");
    fill("password", "secret123");
    fireEvent.submit(screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!);
    expect(screen.getByRole("button", { name: /platform.auth.login/ })).toHaveProperty("disabled", true);

    await act(async () => fail(new ApiError(401, "bad_credentials", "raw")));
    expect(mocks.error).toHaveBeenCalledWith("platform.errors.bad_credentials");
    expect(screen.getByRole("button", { name: /platform.auth.login/ })).toHaveProperty("disabled", false);
  });

  // P6: the raw (English) server message is never shown; a request that did
  // not reach the server says so.
  it("shows a generic text for an unknown error and a network text offline", async () => {
    mocks.login.mockRejectedValueOnce(new ApiError(500, "unknown_code", "Il server dice no"));
    at("/login", <LoginPage />);
    const form = screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!;
    await act(async () => void fireEvent.submit(form));
    expect(mocks.error).toHaveBeenLastCalledWith("platform.errors.generic");

    mocks.login.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => void fireEvent.submit(form));
    expect(mocks.error).toHaveBeenLastCalledWith("platform.errors.network");
  });

  it("asks for an e-mail or a username in a plain text field", async () => {
    mocks.login.mockResolvedValue({ role: "student" });
    at("/login", <LoginPage />);
    const field = document.getElementById("identifier") as HTMLInputElement;
    expect(field.type).toBe("text");
    expect(field.autocomplete).toBe("username");
    expect(screen.getByLabelText("platform.auth.identifier")).toBe(field);
    fill("identifier", "anna.b");
    fill("password", "secret123");
    await act(async () => void fireEvent.submit(field.closest("form")!));
    expect(mocks.login).toHaveBeenCalledWith("anna.b", "secret123");
  });

  it("goes to the dashboard after logging in", async () => {
    mocks.login.mockResolvedValue({ role: "student" });
    at("/login", <LoginPage />);
    await act(async () => void fireEvent.submit(screen.getByRole("button", { name: /platform.auth.login/ }).closest("form")!));
    expect(screen.getByText("dashboard")).toBeTruthy();
  });

  it("logs in with a username and goes back to the page in next", async () => {
    mocks.login.mockResolvedValue({ role: "student", username: "anna.b" });
    at(`/login?next=${encodeURIComponent("/iscriviti?code=ABC")}`, <LoginPage />);
    fill("identifier", "anna.b");
    fill("password", "secret123");
    await act(async () => void fireEvent.submit(document.querySelector("form")!));
    expect(mocks.login).toHaveBeenCalledWith("anna.b", "secret123");
    expect(screen.getByText("enroll page")).toBeTruthy();
  });

  it("ignores a next that leads to another site", async () => {
    mocks.login.mockResolvedValue({ role: "student" });
    at(`/login?next=${encodeURIComponent("//evil.example/x")}`, <LoginPage />);
    await act(async () => void fireEvent.submit(document.querySelector("form")!));
    expect(screen.getByText("dashboard")).toBeTruthy();
  });

  it("shows and hides the password", () => {
    at("/login", <LoginPage />);
    const field = document.getElementById("password") as HTMLInputElement;
    expect(field.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "platform.auth.showPassword" }));
    expect(field.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "platform.auth.hidePassword" }));
    expect(field.type).toBe("password");
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

  it("works for an account without e-mail: username shown, password changed", async () => {
    mocks.user = { id: 7, email: "", username: "anna.b", name: "anna.b", role: "student", locale: "it", active: true, createdAt: "" };
    mocks.updateProfile.mockResolvedValue({ ...mocks.user });
    at("/account", <AccountPage />);
    expect(screen.getByText("anna.b · platform.roles.student")).toBeTruthy();
    expect(document.querySelector('input[type="email"]')).toBeNull();
    expect(screen.getByLabelText("platform.account.displayName")).toBeTruthy();
    expect((document.querySelector('input[autocomplete="username"]') as HTMLInputElement).value).toBe("anna.b");

    fill("cur", "vecchia123");
    fill("new", "nuovapass1");
    await act(async () => void fireEvent.submit(document.getElementById("new")!.closest("form")!));
    expect(mocks.updateProfile).toHaveBeenCalledWith({ currentPassword: "vecchia123", newPassword: "nuovapass1" });
    expect(mocks.setUser).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("platform.auth.passwordChanged");
  });

  it("keeps the e-mail of an account that has one", () => {
    mocks.user = { id: 8, email: "prof@x.it", name: "Prof", role: "teacher", locale: "it", active: true, createdAt: "" };
    at("/account", <AccountPage />);
    expect(screen.getByText("prof@x.it · platform.roles.teacher")).toBeTruthy();
    expect(screen.getByLabelText("platform.auth.name")).toBeTruthy();
  });

  it("tells a student without e-mail to ask the teacher for a reset link", () => {
    at("/forgot-password", <ForgotPasswordPage />);
    expect(screen.getByText("platform.auth.forgotNoEmail")).toBeTruthy();
  });
});
