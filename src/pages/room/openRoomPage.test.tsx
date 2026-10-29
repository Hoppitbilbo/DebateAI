import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import OpenRoomPage from "./OpenRoomPage";

// The wizard that opens a room with a path of activities, on fake answers.

const mocks = vi.hoisted(() => ({ post: vi.fn(), suggest: vi.fn() }));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { get: vi.fn().mockResolvedValue([]), post: mocks.post, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: null, config: { roomsEnabled: true, anonymousRooms: true, roomMaxMinutes: 120 }, loading: false }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/features/room/suggestions", () => ({ suggestActivities: mocks.suggest }));
// Picks a character named after the picker label.
vi.mock("@/features/activity/components/SetupCard", async (orig) => ({
  ...(await orig<typeof import("@/features/activity/components/SetupCard")>()),
  CharacterPicker: ({ label, onChange }: { label: string; onChange: (v: { title: string }) => void }) => (
    <button onClick={() => onChange({ title: label === "Character" ? "Albert Einstein" : `Person ${label}` })}>pick {label}</button>
  ),
}));

beforeAll(() => i18n.changeLanguage("en"));
afterEach(cleanup);

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/aula/nuova"]}>
        <Routes>
          <Route path="/aula/nuova" element={<OpenRoomPage />} />
          <Route path="/aula/gestisci/:id" element={<p>host screen</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("OpenRoomPage", () => {
  it("builds a path from a theme and an idea, then opens the room in the chosen language", async () => {
    mocks.suggest.mockResolvedValue([
      { appType: "doppia-intervista", title: "Einstein and Bohr", why: "Two views of physics", config: { characters: [{ title: "Albert Einstein" }, { title: "Niels Bohr" }] } },
    ]);
    mocks.post.mockResolvedValue({ room: { id: 4 }, hostKey: "k" });
    renderPage();

    const next = () => screen.getByRole("button", { name: /^Next/ });
    expect((next() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Convince them/ }));
    fireEvent.click(screen.getByText("pick Character"));
    fireEvent.click(next());

    expect(await screen.findByText("Einstein and Bohr")).toBeTruthy();
    expect(mocks.suggest).toHaveBeenCalledWith(expect.anything(), { appType: "convinci-tu", pages: ["Albert Einstein"] });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Add$/ })).toBeNull());

    fireEvent.click(next());
    fireEvent.click(screen.getByRole("button", { name: "Deutsch" }));
    fireEvent.click(screen.getByRole("button", { name: /Open the room/ }));

    expect(await screen.findByText("host screen")).toBeTruthy();
    const body = mocks.post.mock.calls[0][1];
    expect(body.assignments.map((a: { appType: string }) => a.appType)).toEqual(["convinci-tu", "doppia-intervista"]);
    expect(body.assignments.every((a: { config: { language: string } }) => a.config.language === "de")).toBe(true);
    expect(body.assignments[1].title).toBe("Einstein and Bohr");
  });
});
