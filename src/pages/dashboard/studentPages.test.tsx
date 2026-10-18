import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import type { InviteSender } from "@/features/teacher/teacherApi";
import InviteForm from "./InviteForm";
import SessionDetailPage from "./SessionDetailPage";
import StudentDashboard from "./StudentDashboard";

// Student dashboard, session detail and invite form on fake API answers
// (refactoring task 7.2).

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
const me = { id: 2, email: "s@x.it", name: "Sara", role: "student", locale: "en", active: true, createdAt: "" };
const assignment = {
  id: 7, classId: 4, className: "3A", title: "Intervista a Napoleone", instructions: "", appType: "wiki-chatbot", config: {}, goals: [],
  minTurns: 0, maxTurns: 0, autoEnd: true, requireReflection: true, allowLive: true, published: true, createdAt: "", updatedAt: "",
};
const routes: Record<string, unknown> = {
  "/api/me/assignments": [assignment],
  "/api/me/classes": [{ id: 4, name: "3A", description: "", archived: false, createdAt: "", studentCount: 20, teacherCount: 1, assignmentCount: 1 }],
  "/api/me/sessions": [],
  "/api/sessions/11": {
    id: 11, userId: 2, userName: "Sara", appType: "wiki-chatbot", title: "Napoleone", status: "completed", turns: 1, progress: 100, costUsd: 0,
    startedAt: "", updatedAt: "", context: {}, transcript: [{ role: "user", content: "Perché la Russia?" }], jev: null,
    reflection: "Ho capito il blocco continentale", evaluation: "",
  },
};

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: {
    get: (path: string) => (path in routes ? Promise.resolve(routes[path]) : Promise.reject(new Error(`unexpected GET ${path}`))),
    post: mocks.post, put: vi.fn(), patch: vi.fn(), del: vi.fn(),
  },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: me, config: { allowJoinByCode: true }, loading: false }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

beforeAll(() => i18n.changeLanguage("en"));
afterEach(cleanup);

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("StudentDashboard", () => {
  it("lists the assignments and joins a class by code", async () => {
    renderAt("/student?join=abc234");
    expect(await screen.findByText("Intervista a Napoleone")).toBeTruthy();
    mocks.post.mockResolvedValue({ name: "3B" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Join" }));
    });
    expect(mocks.post).toHaveBeenCalledWith("/api/classes/join", { code: "ABC234" });
  });
});

describe("SessionDetailPage", () => {
  it("shows the transcript and the reflection", async () => {
    renderAt("/sessions/11");
    expect(await screen.findByText("Perché la Russia?")).toBeTruthy();
    expect(screen.getByText("Ho capito il blocco continentale")).toBeTruthy();
  });
});

describe("InviteForm", () => {
  it("sends the addresses to the given sender and shows the results", async () => {
    const invite = vi.fn<InviteSender>().mockResolvedValue([{ email: "a@x.it", status: "invited", emailSent: false, link: "http://site/register?token=t" }]);
    render(<InviteForm invite={invite} roles={["student", "teacher"]} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "a@x.it" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Send invitations/ }));
    });
    expect(invite).toHaveBeenCalledWith({ emails: ["a@x.it"], role: "student", locale: "en" });
    expect(screen.getByText("a@x.it")).toBeTruthy();
  });
});
