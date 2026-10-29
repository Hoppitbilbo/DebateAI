import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { ApiError } from "@/lib/api";
import JoinRoomPage from "./JoinRoomPage";

// The page where students enter a temporary room, on fake API answers.

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), setUser: vi.fn() }));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { get: mocks.get, post: mocks.post, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: null, config: { roomsEnabled: true }, loading: false, setUser: mocks.setUser }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));

beforeAll(() => i18n.changeLanguage("en"));
beforeEach(() => {
  mocks.get.mockReset();
  mocks.get.mockResolvedValue(room);
  mocks.post.mockReset();
  mocks.setUser.mockReset();
});
afterEach(cleanup);

const renderAt = (url: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/entra" element={<JoinRoomPage />} />
          <Route path="/aula" element={<p>inside the room</p>} />
          <Route path="/apps/wiki-chatbot" element={<p>inside the activity</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const room = { title: "Napoleon", appType: "wiki-chatbot", locked: false, full: false, expiresAt: "2099-01-01T00:00:00Z" };

describe("JoinRoomPage", () => {
  it("opens the room from the QR code link, joins with a nickname and an avatar, and goes straight to the activity", async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve(path === "/api/guest/room" ? { ...room, assignmentId: 7, nickname: "Marco R", avatar: "owl" } : room));
    mocks.post.mockResolvedValue({ id: 9, name: "Marco R", roomId: 3, role: "student" });
    renderAt("/entra?c=k7mpq2");

    expect(await screen.findByText("Napoleon")).toBeTruthy();
    expect(mocks.get).toHaveBeenCalledWith("/api/guest/rooms/K7MPQ2");
    fireEvent.change(screen.getByLabelText("Your name in the room"), { target: { value: "Marco R" } });
    fireEvent.click(screen.getByRole("radio", { name: "Owl" }));
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("inside the activity")).toBeTruthy();
    expect(mocks.get).toHaveBeenLastCalledWith("/api/guest/room");
    expect(mocks.post).toHaveBeenCalledWith("/api/guest/join", { code: "K7MPQ2", nickname: "Marco R", avatar: "owl", locale: "en" });
    expect(mocks.setUser).toHaveBeenCalled();
  });

  it("starts a path of several activities from its map", async () => {
    const path = [{ assignmentId: 7, appType: "wiki-chatbot", title: "A" }, { assignmentId: 8, appType: "convinci-tu", title: "B" }];
    mocks.get.mockImplementation((p: string) => Promise.resolve(p === "/api/guest/room" ? { ...room, assignmentId: 7, activities: path } : room));
    mocks.post.mockResolvedValue({ id: 9, name: "Marco R", roomId: 3, role: "student" });
    renderAt("/entra?c=K7MPQ2");
    await screen.findByText("Napoleon");
    fireEvent.change(screen.getByLabelText("Your name in the room"), { target: { value: "Marco R" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("inside the room")).toBeTruthy();
  });

  it("explains a taken nickname and offers to come back with a PIN", async () => {
    mocks.get.mockResolvedValue(room);
    mocks.post.mockRejectedValueOnce(new ApiError(409, "nickname_taken", "taken"));
    renderAt("/entra?c=K7MPQ2");
    await screen.findByText("Napoleon");
    fireEvent.change(screen.getByLabelText("Your name in the room"), { target: { value: "Marco R" } });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));
    expect((await screen.findByRole("alert")).textContent).toContain("ask your teacher for a PIN");

    fireEvent.click(screen.getByText("I had already joined from another computer"));
    fireEvent.change(screen.getByLabelText("PIN from your teacher"), { target: { value: "12a34" } });
    mocks.post.mockResolvedValueOnce({ id: 9, name: "Marco R", roomId: 3, role: "student" });
    fireEvent.click(screen.getByRole("button", { name: "Join again" }));
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith("/api/guest/rejoin", { code: "K7MPQ2", nickname: "Marco R", pin: "1234" }));
  });

  it("tells when a code does not exist and when the room is locked", async () => {
    mocks.get.mockRejectedValueOnce(new ApiError(404, "not_found", "nope"));
    renderAt("/entra");
    fireEvent.change(screen.getByPlaceholderText("K7MPQ2"), { target: { value: "ab-c 12z" } });
    expect((screen.getByPlaceholderText("K7MPQ2") as HTMLInputElement).value).toBe("ABC12Z");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Code not found");

    mocks.get.mockResolvedValueOnce({ ...room, locked: true });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("closed the entrance"));
  });
});
