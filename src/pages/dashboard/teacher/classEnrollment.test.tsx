import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api";
import ClassCreateDialog from "./ClassCreateDialog";
import ClassPage from "./ClassPage";

// P5: enrolment mode on class creation, sign-up link and QR, member list with
// usernames and the assisted password reset, on fake API answers.

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const LONG_CODE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFG";
const me = { id: 1, email: "prof@x.it", name: "Prof", role: "teacher", locale: "en", active: true, createdAt: "2026-01-01T00:00:00Z" };
const baseClass = { description: "", archived: false, createdAt: "2026-10-01T00:00:00Z", studentCount: 2, teacherCount: 1, assignmentCount: 0 };
const usernameClass = { ...baseClass, id: 5, name: "2B Filosofia", enrollmentMode: "username", joinCode: LONG_CODE };
const standardClass = { ...baseClass, id: 4, name: "3A Storia", enrollmentMode: "standard", joinCode: "ABC234" };
const members = [
  { userId: 21, name: "volpe.blu", email: "", username: "volpe.blu", role: "student", joinedAt: "", canResetPassword: true },
  { userId: 22, name: "Sara Bianchi", email: "s@x.it", role: "student", joinedAt: "", canResetPassword: false },
];
const routes: Record<string, unknown> = {
  "/api/classes/5": { class: usernameClass, members, invites: [] },
  "/api/classes/5/assignments": [],
  "/api/classes/4": { class: standardClass, members: [], invites: [] },
  "/api/classes/4/assignments": [],
};

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: {
    get: (path: string) => (path in routes ? Promise.resolve(routes[path]) : Promise.reject(new Error(`unexpected GET ${path}`))),
    post: mocks.post, put: vi.fn(), patch: vi.fn(), del: vi.fn(),
  },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: me, config: { mailConfigured: false }, loading: false, refresh: vi.fn(), logout: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/features/tour/tour", () => ({ usePageTour: () => undefined }));

/** A promise the test resolves or rejects by hand, to look at the in-flight state. */
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const writeText = vi.fn(() => Promise.resolve());
beforeAll(async () => {
  await i18n.changeLanguage("en");
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});
beforeEach(() => {
  mocks.post.mockReset(); // braces: a function returned by beforeEach would run as a teardown
});
afterEach(() => {
  cleanup();
  writeText.mockClear();
});

const renderClass = (id: number) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/teacher/classes/${id}?tab=students`]}>
        <Routes><Route path="/teacher/classes/:id" element={<ClassPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("class creation", () => {
  const renderDialog = () => {
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    render(<ClassCreateDialog open onOpenChange={onOpenChange} onCreated={onCreated} />);
    return { onCreated, onOpenChange };
  };

  it("starts on e-mail invitations and sends the chosen mode once, even on a double click", async () => {
    const { onCreated, onOpenChange } = renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("radiogroup", { name: "How students enrol" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "E-mail invitations" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText(/pseudonym, not anonymity/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Username and password, no e-mail" }));
    expect(screen.getByRole("radio", { name: "Username and password, no e-mail" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/pseudonym, not anonymity/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "2B Filosofia" } });
    const pending = deferred<unknown>();
    mocks.post.mockReturnValue(pending.promise);
    const create = screen.getByRole("button", { name: "Create" });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("/api/classes", { name: "2B Filosofia", description: "", enrollmentMode: "username", ownerId: undefined });
    expect((create as HTMLButtonElement).disabled).toBe(true);

    await act(async () => pending.resolve(usernameClass));
    expect(onCreated).toHaveBeenCalledWith(usernameClass);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sends the standard mode by default", async () => {
    renderDialog();
    mocks.post.mockResolvedValue(standardClass);
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "3A" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create" })); });
    expect(mocks.post).toHaveBeenCalledWith("/api/classes", expect.objectContaining({ enrollmentMode: "standard" }));
  });

  it("works from the keyboard: arrows pick the mode, Escape closes", async () => {
    const { onOpenChange } = renderDialog();
    const standard = screen.getByRole("radio", { name: "E-mail invitations" });
    standard.focus();
    fireEvent.keyDown(standard, { key: "ArrowDown" });
    const username = screen.getByRole("radio", { name: "Username and password, no e-mail" });
    await waitFor(() => expect(document.activeElement).toBe(username)); // Radix moves the focus on the next tick
    expect(username.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a network error and lets the teacher try again", async () => {
    const { onCreated } = renderDialog();
    mocks.post.mockRejectedValue(new TypeError("Failed to fetch"));
    fireEvent.change(screen.getByLabelText("Class name"), { target: { value: "3A" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create" })); });
    expect(screen.getByRole("alert").textContent).toMatch(/No connection/);
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Create" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("username class page", () => {
  it("shows the sign-up link and its QR, never the long code alone, and copies the link", async () => {
    renderClass(5);
    const link = `${window.location.origin}/iscriviti?code=${LONG_CODE}`;
    const field = (await screen.findByRole("textbox", { name: "Sign-up link" })) as HTMLInputElement;
    expect(field.value).toBe(link);
    expect(field.readOnly).toBe(true);
    expect(screen.getByRole("img", { name: "QR of the sign-up link" })).toBeTruthy();
    expect(screen.queryByText(LONG_CODE)).toBeNull();
    expect(screen.queryByText("Class code")).toBeNull();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copy link" })); });
    expect(writeText).toHaveBeenCalledWith(link);
  });

  it("regenerates the link only after the confirmation, which says old accounts stay", async () => {
    renderClass(5);
    fireEvent.click(await screen.findByRole("button", { name: "Regenerate link" }));
    let confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText(/old link will stop working for new sign-ups.*Accounts already created/)).toBeTruthy();
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(mocks.post).not.toHaveBeenCalled();

    mocks.post.mockResolvedValue({ joinCode: "NEWCODE" });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate link" }));
    confirm = screen.getByRole("alertdialog");
    await act(async () => { fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" })); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("/api/classes/5/code");
  });

  it("lists the username of accounts without e-mail and offers recovery only where allowed", async () => {
    renderClass(5);
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "E-mail or username" })).toBeTruthy();
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]).getAllByText("volpe.blu")).toHaveLength(2); // name and username
    expect(within(rows[2]).getByText("s@x.it")).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: "Password recovery link for volpe.blu" })).toBeTruthy();
    expect(within(rows[2]).queryByRole("button", { name: /Password recovery link/ })).toBeNull();
  });

  it("creates the recovery link once, then shows it with copy, expiry and the in-person instruction", async () => {
    renderClass(5);
    fireEvent.click(await screen.findByRole("button", { name: "Password recovery link for volpe.blu" }));
    const dialog = screen.getByRole("dialog", { name: "Password recovery for volpe.blu" });
    expect(within(dialog).getByText(/in person/)).toBeTruthy();

    const pending = deferred<unknown>();
    mocks.post.mockReturnValue(pending.promise);
    const create = within(dialog).getByRole("button", { name: "Create link" });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("/api/classes/5/members/21/password-reset");
    expect((create as HTMLButtonElement).disabled).toBe(true);

    const url = "http://site/reset-password?token=secret";
    await act(async () => pending.resolve({ url, expiresAt: "2026-10-30T10:15:00Z" }));
    const field = within(dialog).getByRole("textbox", { name: "Recovery link" }) as HTMLInputElement;
    expect(field.value).toBe(url);
    expect(within(dialog).getByText(/\(15 minutes\)/)).toBeTruthy();
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Copy" })); });
    expect(writeText).toHaveBeenCalledWith(url);

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Password recovery link for volpe.blu" }));
    expect(screen.queryByDisplayValue(url)).toBeNull(); // shown once
  });

  it.each([
    [new ApiError(409, "reset_not_allowed", "x"), /No recovery link can be created/],
    [new ApiError(403, "forbidden", "x"), /Only the owner of the class/],
    [new ApiError(404, "not_found", "x"), /no longer in the class/],
    [new TypeError("Failed to fetch"), /No connection/],
  ])("explains a failed recovery request (%s)", async (err, text) => {
    renderClass(5);
    fireEvent.click(await screen.findByRole("button", { name: "Password recovery link for volpe.blu" }));
    mocks.post.mockRejectedValue(err);
    const dialog = screen.getByRole("dialog");
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Create link" })); });
    expect(within(dialog).getByRole("alert").textContent).toMatch(text);
    expect(within(dialog).queryByRole("textbox")).toBeNull();
    expect((within(dialog).getByRole("button", { name: "Create link" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("standard class page", () => {
  it("keeps the short class code and no sign-up link", async () => {
    renderClass(4);
    expect(await screen.findByText("ABC234")).toBeTruthy();
    expect(screen.getByText("Class code")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Sign-up link" })).toBeNull();
  });
});
