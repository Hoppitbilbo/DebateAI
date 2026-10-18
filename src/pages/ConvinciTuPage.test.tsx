import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConvinciTuPage from "./ConvinciTuPage";

// Renders the migrated page on the real ActivityRunner and useActivityFlow
// (refactoring task 5.1); only the server, the AI and the page frame are fakes.

const mocks = vi.hoisted(() => ({
  begin: vi.fn().mockResolvedValue(7),
  generateStream: vi.fn(),
}));

vi.mock("@/features/activity/useActivitySession", () => ({
  useActivitySession: () => ({
    assignment: null,
    minTurns: 0,
    turns: 0,
    allowLive: false,
    requireReflection: true,
    endReason: null,
    sessionId: 7,
    getSessionId: () => 7,
    begin: mocks.begin,
    sync: vi.fn().mockResolvedValue(null),
    markManualEnd: vi.fn(),
  }),
}));
vi.mock("@/features/activity/components/ActivityShell", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/activity/components/SetupCard", async (orig) => ({
  ...(await orig<typeof import("@/features/activity/components/SetupCard")>()),
  CharacterPicker: ({ onChange }: { onChange: (v: { title: string }) => void }) => (
    <button onClick={() => onChange({ title: "Napoleone" })}>pick</button>
  ),
}));
vi.mock("@/features/activity/wiki", () => ({ useWikiSummaries: () => ({ summaries: {}, loading: false }), bioOf: () => "bio" }));
vi.mock("@/hooks/useLiveAi", () => ({
  useLiveAi: () => ({ liveMode: false, liveState: "off", liveAvailable: false, toggleLive: vi.fn(), stopLive: vi.fn(), sendLiveText: vi.fn() }),
}));
vi.mock("@/services/aiService", () => ({ generateStream: mocks.generateStream, formatAiError: String }));

beforeEach(() => vi.clearAllMocks());

describe("ConvinciTuPage", () => {
  it("starts the chat with the chosen character and topic", async () => {
    render(<ConvinciTuPage />);
    const start = screen.getByRole("button", { name: "Start" });
    expect((start as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByText("pick"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "la guerra" } });
    expect((start as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(start);
    });
    expect(mocks.begin).toHaveBeenCalledWith("Napoleone: la guerra", { character: { title: "Napoleone" }, topic: "la guerra" });
    expect(screen.getByText(/Napoleone/)).toBeTruthy(); // the intro message names the character
    expect(screen.getByRole("textbox")).toBeTruthy(); // the chat input
  });
});
