import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type User } from "@/lib/api";
import EnrollPage from "./EnrollPage";
import { LoginPage } from "./AuthPages";

// P6: the page of the sign-up link of a username class (`/iscriviti?code=…`).

const mocks = vi.hoisted(() => ({
  classInvite: vi.fn(), registerClass: vi.fn(), joinClass: vi.fn(), login: vi.fn(), logout: vi.fn(), setUser: vi.fn(),
  error: vi.fn(), success: vi.fn(),
  user: null as User | null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/context/auth", () => ({
  useAuth: () => ({ user: mocks.user, loading: false, config: { setupRequired: false }, login: mocks.login, logout: mocks.logout, setUser: mocks.setUser }),
  dashboardPath: (u: User | null) => (u?.role === "teacher" ? "/teacher" : "/student"),
}));
vi.mock("@/features/auth/authApi", () => ({ authApi: { classInvite: mocks.classInvite, registerClass: mocks.registerClass } }));
vi.mock("@/features/student/studentApi", () => ({ useJoinClass: () => mocks.joinClass }));
vi.mock("@/i18n", () => ({ default: { exists: () => false, language: "it" } }));

const CODE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFG";
const student: User = { id: 3, email: "", username: "luca", name: "luca", role: "student", locale: "it", active: true, createdAt: "" };

beforeEach(() => {
  mocks.classInvite.mockResolvedValue({ className: "3A", enrollmentMode: "username" });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.user = null;
});

const open = async (path = `/iscriviti?code=${CODE}`) => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/iscriviti" element={<EnrollPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/student" element={<p>student dashboard</p>} />
        <Route path="/teacher" element={<p>teacher dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
  await act(async () => {});
};

const fill = (id: string, value: string) => fireEvent.change(document.getElementById(id)!, { target: { value } });
const submit = () => act(async () => void fireEvent.submit(document.querySelector("form")!));
const fillForm = (username = "Anna.B", password = "password123") => {
  fill("enroll-username", username);
  fill("enroll-password", password);
};

describe("sign-up from a class link", () => {
  it("shows the class, the pseudonym note and fields ready for a password manager", async () => {
    await open();
    expect(mocks.classInvite).toHaveBeenCalledWith(CODE);
    expect(screen.getByText("platform.enroll.title")).toBeTruthy();
    expect(screen.getByText("platform.enroll.pseudonym")).toBeTruthy();
    const username = document.getElementById("enroll-username") as HTMLInputElement;
    const password = document.getElementById("enroll-password") as HTMLInputElement;
    expect(username.autocomplete).toBe("username");
    expect(password.autocomplete).toBe("new-password");
    expect(password.type).toBe("password");
    expect(username.getAttribute("aria-describedby")).toBe("enroll-username-hint");
    expect(screen.getByText("platform.enroll.usernameHint")).toBeTruthy();
    expect(screen.getByText("platform.enroll.passwordHint")).toBeTruthy();
  });

  it("creates the account, confirms the username and goes to the class", async () => {
    const created = { ...student, username: "anna.b", name: "anna.b" };
    mocks.registerClass.mockResolvedValue(created);
    await open();
    fillForm(" Anna.B ");
    await submit();
    expect(mocks.registerClass).toHaveBeenCalledWith({ code: CODE, username: "anna.b", password: "password123", locale: "it" });
    expect(mocks.setUser).toHaveBeenCalledWith(created);
    expect(screen.getByText("platform.enroll.doneTitle")).toBeTruthy();
    expect(screen.getByText("anna.b")).toBeTruthy();
    expect(screen.getByText("platform.enroll.doneNote")).toBeTruthy();
    expect(screen.getByText(`${window.location.origin}/login`)).toBeTruthy();
    expect(document.body.textContent).not.toContain("password123");

    fireEvent.click(screen.getByRole("button", { name: "platform.enroll.goToClass" }));
    expect(screen.getByText("student dashboard")).toBeTruthy();
  });

  it("sends one request on a double submit", async () => {
    let finish!: (u: User) => void;
    mocks.registerClass.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    await open();
    fillForm();
    await submit();
    await submit();
    expect(mocks.registerClass).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /platform.enroll.submit/ })).toHaveProperty("disabled", true);
    await act(async () => finish({ ...student, username: "anna.b" }));
    expect(screen.getByText("platform.enroll.doneTitle")).toBeTruthy();
  });

  it("shows and hides the password", async () => {
    await open();
    const password = document.getElementById("enroll-password") as HTMLInputElement;
    const toggle = screen.getByRole("button", { name: "platform.auth.showPassword" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(password.type).toBe("text");
    fireEvent.click(screen.getByRole("button", { name: "platform.auth.hidePassword" }));
    expect(password.type).toBe("password");
  });

  it("checks the rules before sending and puts the focus on the wrong field", async () => {
    await open();
    fillForm("a@b", "password123");
    await submit();
    expect(mocks.registerClass).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("enroll-username");
    expect(document.getElementById("enroll-username")!.getAttribute("aria-invalid")).toBe("true");

    fillForm("anna", "corta");
    await submit();
    expect(mocks.registerClass).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe("enroll-password");

    fillForm("anna", "è".repeat(40)); // 40 characters, 80 bytes: over the bcrypt limit
    await submit();
    expect(mocks.registerClass).not.toHaveBeenCalled();
  });

  it("says a taken username next to the field and focuses it", async () => {
    mocks.registerClass.mockRejectedValue(new ApiError(409, "username_taken", "taken"));
    await open();
    fillForm();
    await submit();
    const field = document.getElementById("enroll-username")!;
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toContain("enroll-username-error");
    expect(document.getElementById("enroll-username-error")!.textContent).toBe("platform.enroll.errors.taken");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["invalid data", new ApiError(400, "invalid", "x"), "platform.enroll.errors.invalid"],
    ["a link no longer valid", new ApiError(404, "invalid_invite", "x"), "platform.enroll.errors.link"],
    ["sign-up closed", new ApiError(403, "disabled", "x"), "platform.enroll.errors.closed"],
    ["a room guest", new ApiError(403, "forbidden", "x"), "platform.enroll.errors.guest"],
    ["too many attempts", new ApiError(429, "rate_limited", "x"), "platform.errors.rate_limited"],
    ["the service down", new ApiError(503, "unavailable", "x"), "platform.errors.unavailable"],
    ["no network", new TypeError("Failed to fetch"), "platform.errors.network"],
  ])("explains %s", async (_, err, text) => {
    mocks.registerClass.mockRejectedValue(err);
    await open();
    fillForm();
    await submit();
    expect(screen.getByRole("alert").textContent).toBe(text);
    expect(mocks.setUser).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /platform.enroll.submit/ })).toHaveProperty("disabled", false);
  });
});

describe("the link itself", () => {
  it("says a missing or unknown link is not valid", async () => {
    await open("/iscriviti");
    expect(mocks.classInvite).not.toHaveBeenCalled();
    expect(screen.getByText("platform.enroll.invalidTitle")).toBeTruthy();
    cleanup();

    mocks.classInvite.mockRejectedValue(new ApiError(404, "invalid_invite", "closed"));
    await open();
    expect(screen.getByText("platform.enroll.invalidTitle")).toBeTruthy();
    expect(document.getElementById("enroll-username")).toBeNull();
  });

  it("offers to retry after a network error", async () => {
    mocks.classInvite.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await open();
    expect(screen.getByRole("alert").textContent).toBe("platform.errors.network");
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "platform.student.retry" })));
    expect(mocks.classInvite).toHaveBeenCalledTimes(2);
    expect(document.getElementById("enroll-username")).toBeTruthy();
  });
});

describe("already logged in", () => {
  it("lets a student join with their account, without creating another", async () => {
    mocks.user = student;
    mocks.joinClass.mockResolvedValue({ classId: 1, name: "3A" });
    await open();
    expect(document.getElementById("enroll-username")).toBeNull();
    expect(mocks.joinClass).not.toHaveBeenCalled(); // opening the link does not enroll
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: /platform.enroll.useMine/ })));
    expect(mocks.joinClass).toHaveBeenCalledWith(CODE);
    expect(mocks.registerClass).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("platform.student.joined");
    expect(screen.getByText("student dashboard")).toBeTruthy();
  });

  it("explains a failed join", async () => {
    mocks.user = student;
    mocks.joinClass.mockRejectedValue(new ApiError(404, "invalid_code", "x"));
    await open();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: /platform.enroll.useMine/ })));
    expect(screen.getByRole("alert").textContent).toBe("platform.enroll.errors.link");
  });

  it("lets a student log out to create a new account", async () => {
    mocks.user = student;
    mocks.logout.mockResolvedValue(undefined);
    await open();
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "platform.enroll.logoutAndCreate" })));
    expect(mocks.logout).toHaveBeenCalled();
    expect(mocks.joinClass).not.toHaveBeenCalled();
  });

  it("tells a room guest to leave the room first", async () => {
    mocks.user = { ...student, username: undefined, roomId: 9 };
    await open();
    expect(screen.getByText("platform.enroll.guestText")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /platform.enroll.useMine/ })).toBeNull();
    expect(document.getElementById("enroll-username")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "platform.enroll.guestLogout" }));
    expect(mocks.logout).toHaveBeenCalled();
  });

  it("tells a teacher the link is for students", async () => {
    mocks.user = { ...student, email: "prof@x.it", username: undefined, role: "teacher" };
    await open();
    expect(screen.getByText("platform.enroll.staffText")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /platform.enroll.useMine/ })).toBeNull();
    expect(document.getElementById("enroll-username")).toBeNull();
    expect(screen.getByRole("link", { name: "platform.nav.dashboard" }).getAttribute("href")).toBe("/teacher");
  });
});

describe("I already have an account", () => {
  it("goes to the login and comes back to the link with its code", async () => {
    mocks.login.mockImplementation(async () => {
      mocks.user = student;
      return student;
    });
    await open();
    const link = screen.getByRole("link", { name: "platform.enroll.haveAccount" });
    expect(link.getAttribute("href")).toBe(`/login?next=${encodeURIComponent(`/iscriviti?code=${CODE}`)}`);
    fireEvent.click(link);
    fill("identifier", "luca");
    fill("password", "password123");
    await act(async () => void fireEvent.submit(document.querySelector("form")!));
    expect(mocks.login).toHaveBeenCalledWith("luca", "password123");
    await act(async () => {});
    // Back on the link, logged in: joining needs one more click.
    expect(mocks.classInvite).toHaveBeenLastCalledWith(CODE);
    expect(screen.getByRole("button", { name: /platform.enroll.useMine/ })).toBeTruthy();
    expect(mocks.joinClass).not.toHaveBeenCalled();
  });
});
