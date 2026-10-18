import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import AdminPage from "./AdminPage";

// Renders each admin tab on fake API answers (refactoring task 6.2): the tabs
// get their data only through the hooks of features/admin.

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const me = { id: 1, email: "admin@x.it", name: "Admin", role: "admin", locale: "en", active: true, createdAt: "2026-01-01T00:00:00Z" };
const agg = { key: "2026-10-18", requests: 3, errors: 0, inputTokens: 10, outputTokens: 5, costUsd: 0.5 };
const budget = { monthlyUsd: 10, warnPercent: 80, blockPaidWhenExceeded: true };
const routes: Record<string, unknown> = {
  "/api/admin/overview": {
    users: { admin: 1, teacher: 2, student: 30 }, classes: 3, assignments: 4, sessions: 5, pendingInvites: 1, providers: 1,
    monthSpendUsd: 1, todaySpendUsd: 0.1, monthBudgetUsd: 10, budgetExceeded: false, requestsToday: 7, errorsToday: 0, mailConfigured: false, routingComplete: true,
  },
  "/api/admin/users?q=": [{ ...me, id: 2, name: "Prof Rossi", role: "teacher", classes: 2, costUsd: 0.2 }],
  "/api/admin/users?role=teacher": [{ ...me, id: 2, name: "Prof Rossi", role: "teacher", classes: 2, costUsd: 0.2 }],
  "/api/admin/invites": [{ id: 9, kind: "invite", email: "new@x.it", role: "student", locale: "it", createdAt: "2026-10-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", emailSent: true, invitedBy: "Admin" }],
  "/api/classes": [{ id: 4, name: "3A", description: "", archived: false, createdAt: "2026-10-01T00:00:00Z", studentCount: 20, teacherCount: 1, assignmentCount: 2 }],
  "/api/admin/settings": {
    general: { siteName: "Scuola", defaultLocale: "it", publicUrl: "", guestAccess: true, guestLive: false, guestRequestsPerHour: 60, studentRequestsPerDay: 400, allowJoinByCode: true, liveEnabled: true },
    smtp: { host: "", port: 587, username: "", from: "", security: "starttls" }, smtpHasPassword: false, budget,
    routing: { strategy: "ordered", tasks: { chat: [{ providerId: 5, model: "m1" }] }, defaultVoice: "Aoede" },
    jev: { enabled: true, threshold: 0.7, evaluateEvery: 1, maxStateChars: 24000 },
    tasks: ["chat", "judge"],
  },
  "/api/admin/providers": [{ id: 5, name: "Mio OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", hasKey: true, keyHint: "sk-…abcd", models: [{ id: "m1", free: true }], enabled: true }],
  "/api/admin/prices": [{ providerId: 5, providerName: "Mio OpenRouter", model: "m1", inputPerM: 0, outputPerM: 0 }],
  "/api/admin/usage?days=30": { days: 30, byDay: [agg], byModel: [agg], byTask: [agg], byProvider: [agg], byUser: [agg], byClass: [agg], monthSpendUsd: 1, budget },
  "/api/admin/usage/log?limit=200": [{ id: 1, createdAt: "2026-10-18T10:00:00Z", user: "Sara", provider: "p", model: "m1", task: "chat", inputTokens: 1, outputTokens: 1, costUsd: 0, ok: true, latencyMs: 9 }],
};

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: {
    get: (path: string) => (path in routes ? Promise.resolve(routes[path]) : Promise.reject(new Error(`unexpected GET ${path}`))),
    post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn(),
  },
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: me, loading: false, refresh: vi.fn(), logout: vi.fn() }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

beforeAll(() => i18n.changeLanguage("en"));
afterEach(cleanup);

const renderTab = (tab: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (ui: ReactNode) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin?tab=${tab}`]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(wrap(<AdminPage />));
};

describe("AdminPage tabs", () => {
  it.each([
    ["overview", /30/],
    ["users", "Prof Rossi"],
    ["invites", "new@x.it"],
    ["classes", "3A"],
    ["settings", /Scuola/],
    ["ai", "Mio OpenRouter"],
    ["costs", "Sara"],
  ])("%s shows its data", async (tab, text) => {
    renderTab(tab);
    if (tab === "settings") {
      expect(((await screen.findByDisplayValue("Scuola")) as HTMLInputElement).value).toBe("Scuola");
      return;
    }
    expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
  });
});
