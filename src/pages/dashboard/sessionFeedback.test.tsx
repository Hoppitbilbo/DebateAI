import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import SessionDetailPage from "./SessionDetailPage";

// Session page: teacher feedback, the student's view of it and printing (task 8.4).

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({
  user: null as unknown,
  put: vi.fn(),
  session: {} as Record<string, unknown>,
}));
const teacher = { id: 1, email: "prof@x.it", name: "Prof", role: "teacher", locale: "en", active: true, createdAt: "" };
const student = { id: 2, email: "s@x.it", name: "Sara", role: "student", locale: "en", active: true, createdAt: "" };
const baseSession = {
  id: 11, userId: 2, userName: "Sara", appType: "wiki-chatbot", title: "Napoleone", status: "completed", turns: 1, progress: 100, costUsd: 0,
  startedAt: "", updatedAt: "", context: {}, transcript: [{ role: "user", content: "Perché la Russia?" }], jev: {},
  reflection: "", evaluation: "", teacherFeedback: "",
};

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { get: () => Promise.resolve(mocks.session), post: vi.fn(), put: mocks.put, patch: vi.fn(), del: vi.fn() },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

beforeAll(() => i18n.changeLanguage("en"));
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const renderSession = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/sessions/11"]}>
        <Routes><Route path="/sessions/:id" element={<SessionDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("SessionDetailPage", () => {
  it("lets the class teacher send feedback", async () => {
    mocks.user = teacher;
    mocks.session = baseSession;
    mocks.put.mockResolvedValue({ ...baseSession, teacherFeedback: "Ottimo lavoro", teacherScore: 9 });
    renderSession();
    const box = await screen.findByLabelText("Teacher feedback");
    fireEvent.change(box, { target: { value: "Ottimo lavoro" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    });
    expect(mocks.put).toHaveBeenCalledWith("/api/sessions/11/feedback", { feedback: "Ottimo lavoro", score: null });
  });

  it("shows the student the teacher's feedback, without the form", async () => {
    mocks.user = student;
    mocks.session = { ...baseSession, teacherFeedback: "Ottime domande", teacherScore: 8 };
    renderSession();
    expect(await screen.findByText("Ottime domande")).toBeTruthy();
    expect(screen.getAllByText("8/10").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Send feedback" })).toBeNull();
  });

  it("prints the conversation", async () => {
    mocks.user = student;
    mocks.session = baseSession;
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    renderSession();
    fireEvent.click(await screen.findByRole("button", { name: /Print/ }));
    expect(print).toHaveBeenCalled();
  });
});
