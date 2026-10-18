import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import AssignmentProgressPage from "./AssignmentProgressPage";
import ClassPage from "./ClassPage";
import TeacherDashboard from "./TeacherDashboard";

// Renders the teacher pages on fake API answers (refactoring task 6.3).

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const me = { id: 1, email: "prof@x.it", name: "Prof", role: "teacher", locale: "en", active: true, createdAt: "2026-01-01T00:00:00Z" };
const cls = { id: 4, name: "3A Storia", description: "Classe", joinCode: "ABC234", archived: false, createdAt: "2026-10-01T00:00:00Z", studentCount: 1, teacherCount: 1, assignmentCount: 1 };
const assignment = {
  id: 7, classId: 4, className: "3A Storia", title: "Napoleone", instructions: "Intervista", appType: "wiki-chatbot", config: {}, goals: ["g1"],
  minTurns: 0, maxTurns: 10, autoEnd: true, requireReflection: true, allowLive: true, published: true, createdAt: "", updatedAt: "",
  stats: { students: 1, started: 1, completed: 1 },
};
const session = { id: 11, appType: "wiki-chatbot", title: "t", status: "completed", turns: 4, progress: 100, costUsd: 0.01, startedAt: "", updatedAt: "2026-10-18T10:00:00Z", scoreConversation: 8 };
const routes: Record<string, unknown> = {
  "/api/classes?mine=1": [cls],
  "/api/classes/4": {
    class: cls,
    members: [{ userId: 2, name: "Sara Bianchi", email: "s@x.it", role: "student", joinedAt: "" }],
    invites: [{ id: 3, kind: "invite", email: "pending@x.it", role: "student", locale: "it", createdAt: "", expiresAt: "2099-01-01T00:00:00Z", emailSent: false }],
  },
  "/api/classes/4/assignments": [assignment],
  "/api/classes/4/progress": { cells: [{ assignmentId: 7, userId: 2, status: "completed", progress: 100, sessionId: 11, score: 8, costUsd: 0.01 }] },
  "/api/assignments/7/progress": { assignment, students: [{ userId: 2, name: "Sara Bianchi", email: "s@x.it", session, attemptCount: 2 }] },
};

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: {
    get: (path: string) => (path in routes ? Promise.resolve(routes[path]) : Promise.reject(new Error(`unexpected GET ${path}`))),
    post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(),
  },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: me, loading: false, refresh: vi.fn(), logout: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

beforeAll(() => i18n.changeLanguage("en"));
afterEach(cleanup);

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/classes/:id" element={<ClassPage />} />
          <Route path="/teacher/assignments/:id" element={<AssignmentProgressPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("teacher pages", () => {
  it("lists the teacher's classes", async () => {
    renderAt("/teacher");
    expect(await screen.findByText("3A Storia")).toBeTruthy();
  });

  it("shows a class: assignments, members, progress and settings", async () => {
    renderAt("/teacher/classes/4?tab=assignments");
    expect(await screen.findByText("Napoleone")).toBeTruthy();

    cleanup();
    renderAt("/teacher/classes/4?tab=students");
    expect(await screen.findByText("Sara Bianchi")).toBeTruthy();
    expect(screen.getByText("pending@x.it")).toBeTruthy();
    expect(screen.getByText("ABC234")).toBeTruthy();

    cleanup();
    renderAt("/teacher/classes/4?tab=progress");
    expect(await screen.findByText("100% · 8")).toBeTruthy();

    cleanup();
    renderAt("/teacher/classes/4?tab=settings");
    expect(((await screen.findByDisplayValue("Classe")) as HTMLTextAreaElement).value).toBe("Classe");
  });

  it("shows how the students did on an assignment", async () => {
    renderAt("/teacher/assignments/7");
    expect(await screen.findByText("Sara Bianchi")).toBeTruthy();
    expect(screen.getByText("1/1")).toBeTruthy(); // completed
    expect(screen.getByText("8.0")).toBeTruthy(); // average conversation score
    fireEvent.click(screen.getByText("Open"));
  });
});
