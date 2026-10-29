import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { lobbyDelay, REFRESH_MS, roomIsGone } from "./roomApi";

const mocks = vi.hoisted(() => ({ view: {} as Record<string, unknown> }));
vi.mock("./roomApi", async (orig) => ({
  ...(await orig<typeof import("./roomApi")>()),
  useRoomView: () => ({ view: mocks.view, refresh: vi.fn() }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: "it" } }) }));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("./useHostKey", () => ({ useHostKey: () => "key" }));

const { default: HostRoomPage } = await import("@/pages/room/HostRoomPage");

afterEach(cleanup);

describe("lobby refresh", () => {
  it("polls fast while the lobby changes, slower while it does not, and backs off after failures", () => {
    expect(lobbyDelay(0, 0)).toBe(REFRESH_MS.lobby);
    expect(lobbyDelay(2, 0)).toBe(REFRESH_MS.lobby);
    expect(lobbyDelay(3, 0)).toBe(2 * REFRESH_MS.lobby);
    expect(lobbyDelay(20, 0)).toBe(15000);
    expect(lobbyDelay(0, 1)).toBe(2 * REFRESH_MS.lobby);
    expect(lobbyDelay(0, 9)).toBe(30000);
  });

  it("treats only confirmed answers as a room that is gone", () => {
    expect(roomIsGone(new ApiError(404, "not_found", ""))).toBe(true);
    expect(roomIsGone(new ApiError(403, "forbidden", ""))).toBe(true);
    expect(roomIsGone(new ApiError(502, "error", ""))).toBe(false);
    expect(roomIsGone(new TypeError("Failed to fetch"))).toBe(false);
  });
});

const renderHost = () =>
  render(
    <MemoryRouter initialEntries={["/aula/3/gestisci"]}>
      <Routes><Route path="/aula/:id/gestisci" element={<HostRoomPage />} /></Routes>
    </MemoryRouter>,
  );

describe("HostRoomPage", () => {
  it("says the room is closed only when the server says so", () => {
    mocks.view = { isLoading: false, isError: true, error: new ApiError(404, "not_found", ""), data: undefined };
    renderHost();
    expect(screen.getByText(/room.host.closedText/)).toBeTruthy();
  });

  it("offers a retry, not 'closed', when the room could not be loaded", () => {
    mocks.view = { isLoading: false, isError: true, error: new TypeError("Failed to fetch"), data: undefined };
    renderHost();
    expect(screen.queryByText(/room.host.closedText/)).toBeNull();
    expect(screen.getByText(/room.host.loadFailed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "platform.activity.retry" })).toBeTruthy();
  });
});
