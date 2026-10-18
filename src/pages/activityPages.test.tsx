import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConvinciTuPage from "./ConvinciTuPage";
import ImpersonaTuPage from "./ImpersonaTuPage";
import WikiChatbotPage from "./WikiChatbotPage";

// Renders the migrated activity pages on the real ActivityRunner and
// useActivityFlow (refactoring phase 5): setup → start → chat. Only the
// server, the AI, Wikipedia and the page frame are fakes.

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
  // Picks a character named after the picker label.
  CharacterPicker: ({ label, onChange }: { label: string; onChange: (v: { title: string }) => void }) => (
    <button onClick={() => onChange({ title: `Person ${label}` })}>pick {label}</button>
  ),
}));
vi.mock("@/features/activity/wiki", () => ({ useWikiSummaries: () => ({ summaries: {}, loading: false }), bioOf: () => "bio" }));
vi.mock("@/hooks/useLiveAi", () => ({
  useLiveAi: () => ({ liveMode: false, liveState: "off", liveAvailable: false, toggleLive: vi.fn(), stopLive: vi.fn(), sendLiveText: vi.fn() }),
}));
vi.mock("@/services/aiService", () => ({ generateStream: mocks.generateStream, formatAiError: String }));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const startButton = () => screen.getByRole("button", { name: "Start" }) as HTMLButtonElement;
const pickAll = () => screen.getAllByText(/^pick /).forEach((b) => fireEvent.click(b));
const typeTopic = (value: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value } });
const start = async () => {
  await act(async () => {
    fireEvent.click(startButton());
  });
};

describe("ConvinciTuPage", () => {
  it("starts the chat with the chosen character and topic", async () => {
    render(<ConvinciTuPage />);
    expect(startButton().disabled).toBe(true);
    pickAll();
    typeTopic("la guerra");
    expect(startButton().disabled).toBe(false);
    await start();
    expect(mocks.begin).toHaveBeenCalledWith("Person Character: la guerra", { character: { title: "Person Character" }, topic: "la guerra" });
    expect(screen.getByText(/Person Character/)).toBeTruthy(); // the intro names the character
    expect(screen.getByRole("textbox")).toBeTruthy(); // the chat input
  });
});

describe("ImpersonaTuPage", () => {
  it("needs two characters and a topic, then greets as the AI character", async () => {
    render(<ImpersonaTuPage />);
    pickAll();
    expect(startButton().disabled).toBe(true);
    typeTopic("la pace");
    await start();
    expect(mocks.begin).toHaveBeenCalledWith("Person Your character (you play them) ↔ Person AI character", {
      aiCharacter: { title: "Person AI character" },
      userCharacter: { title: "Person Your character (you play them)" },
      topic: "la pace",
    });
    expect(screen.getAllByText(/Person AI character/).length).toBeGreaterThan(0);
  });
});

describe("WikiChatbotPage", () => {
  it("starts on the chosen page", async () => {
    render(<WikiChatbotPage />);
    pickAll();
    await start();
    expect(mocks.begin).toHaveBeenCalledWith(expect.stringMatching(/^Person /), expect.objectContaining({ page: expect.anything() }));
  });
});
