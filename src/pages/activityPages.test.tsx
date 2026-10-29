import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render as renderPage, screen } from "@testing-library/react";
import type { AiClient } from "@/services/aiClient";
import AiClientProvider from "@/services/AiClientProvider";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import ConvinciTuPage from "./ConvinciTuPage";
import ImpersonaTuPage from "./ImpersonaTuPage";
import WikiChatbotPage from "./WikiChatbotPage";
import DoppiaIntervistaPage from "./DoppiaIntervistaPage";
import PersonaggioMisteriosoPage from "./PersonaggioMisteriosoPage";
import YouModeratePage from "./YouModeratePage";

// Renders the migrated activity pages on the real ActivityRunner and
// useActivityFlow (refactoring phase 5): setup → start → chat. Only the
// server, the AI, Wikipedia and the page frame are fakes.

// jsdom has no ResizeObserver; Radix (the slider) needs one.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({
  begin: vi.fn().mockResolvedValue(7),
  generateStream: vi.fn(),
  sync: vi.fn(),
  judged: false,
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
    sync: mocks.sync,
    markManualEnd: vi.fn(),
    judgedLastTurn: () => mocks.judged,
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
  useLiveAi: () => ({ liveMode: false, liveState: "off", liveAvailable: false, toggleLive: vi.fn(), stopLive: vi.fn(), finishLive: vi.fn(), sendLiveText: vi.fn() }),
}));

// The AI gateway is a fake AiClient given through the provider.
const fakeAi = {
  generateStream: (...args: Parameters<AiClient["generateStream"]>) => mocks.generateStream(...args),
  status: () => Promise.resolve({ text: true }),
  formatError: String,
} as unknown as AiClient;
const render = (page: ReactNode) => renderPage(<AiClientProvider client={fakeAi}>{page}</AiClientProvider>);

// The labels below are the English ones.
beforeAll(() => i18n.changeLanguage("en"));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generateStream.mockResolvedValue("risposta");
  mocks.sync.mockResolvedValue(null);
  mocks.judged = false;
});
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
    expect(mocks.begin).toHaveBeenCalledWith("Person Character: la guerra", { character: { title: "Person Character" }, topic: "la guerra", difficulty: "medium" });
    const [opening] = mocks.generateStream.mock.calls[0];
    expect(opening.system).toBeUndefined();
    expect(opening.recipe).toMatchObject({ app: "convinci-tu", kind: "opening", character: "Person Character", topic: "la guerra", difficulty: "medium" });
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
      difficulty: "medium",
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
    // the server writes the prompt and the opening cue from the recipe
    const [opening] = mocks.generateStream.mock.calls[0];
    expect(opening.system).toBeUndefined();
    expect(opening.recipe).toMatchObject({ app: "wiki-chatbot", kind: "opening", character: expect.stringMatching(/^Person /), uiLang: "en" });
  });
});

describe("DoppiaIntervistaPage", () => {
  it("greets with both characters", async () => {
    render(<DoppiaIntervistaPage />);
    pickAll();
    await start();
    expect(mocks.begin).toHaveBeenCalledWith("Person Character 1 & Person Character 2", {
      characters: [{ title: "Person Character 1" }, { title: "Person Character 2" }],
    });
    expect(screen.getAllByText(/Person Character 2/).length).toBeGreaterThan(0);
  });
});

describe("YouModeratePage", () => {
  it("opens the debate with the first character speaking", async () => {
    render(<YouModeratePage />);
    pickAll();
    typeTopic("il potere");
    await start();
    expect(mocks.begin).toHaveBeenCalledWith("Person Character 1 vs Person Character 2: il potere", expect.anything());
    expect(mocks.generateStream).toHaveBeenCalledTimes(1); // the opening statement
    expect(screen.getByText("risposta")).toBeTruthy();
  });
});

describe("PersonaggioMisteriosoPage", () => {
  it("starts the game without revealing the character", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    expect(mocks.begin).toHaveBeenCalledWith(expect.any(String), { character: expect.stringMatching(/^Person /), questions: 7 });
    // the hidden character opens the game in its own voice, prompted by a stage direction
    // the server writes the stage direction, announcing the questions of the recipe
    const [opening] = mocks.generateStream.mock.calls[0];
    expect(opening.system).toBeUndefined();
    expect(opening.recipe).toMatchObject({ app: "personaggio-misterioso", kind: "opening", questions: 7, character: expect.stringMatching(/^Person /) });
    expect(screen.getByText("risposta")).toBeTruthy();
    expect(screen.getByText("???")).toBeTruthy();
  });

  it("falls back to the written intro when no model answers the opening", async () => {
    mocks.generateStream.mockRejectedValueOnce(new Error("down"));
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    expect(screen.getByText(/7 questions/)).toBeTruthy();
  });
});

describe("PersonaggioMisteriosoPage end of game", () => {
  it("ends the game with a message when JEV judges the goal reached", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    mocks.sync.mockResolvedValue("goal_reached");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sei Napoleone?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    // the chat stays on screen so the last answer can be read; the guess comes when the student is ready
    expect(screen.getByText(/JEV decided you reached the goal: no more questions/)).toBeTruthy();
    expect(screen.getAllByText("risposta")).toHaveLength(2); // opening + answer to the last question
    expect(screen.queryByLabelText("Your answer")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Make your guess/ }));
    expect(screen.getByLabelText("Your answer")).toBeTruthy();
  });

  it("waits for the answer to the last question before ending the game", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    let answer!: (text: string) => void;
    mocks.generateStream.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    mocks.sync.mockResolvedValue("turn_limit");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sei Napoleone?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    // the AI is still answering: nothing ends and the student cannot jump to the guess
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(screen.queryByText(/No questions left!/)).toBeNull();
    expect((screen.getByRole("button", { name: /Make your guess/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => answer("Non sono Napoleone"));
    expect(screen.getByText("Non sono Napoleone")).toBeTruthy();
    expect(screen.getByText(/No questions left!/)).toBeTruthy();
    expect(screen.queryByLabelText("Your answer")).toBeNull();
  });

  it("keeps the last answer readable when the turn limit ends the questions", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    mocks.sync.mockResolvedValue("turn_limit");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Sei Napoleone?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(screen.getByText(/No questions left!/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText("Your answer")).toBeNull();
  });
});

describe("PersonaggioMisteriosoPage found in the chat", () => {
  // The picked character is "Person Secret character" (see the CharacterPicker mock).
  const askName = async () => {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Are you Person Secret character?" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
  };

  it("without a judge, naming the character wins after its answer and goes on to the reflection", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    mocks.generateStream.mockResolvedValueOnce("Yes, it's me! Congratulations!");
    await askName();
    expect(mocks.sync).toHaveBeenLastCalledWith(expect.any(Array), expect.anything(), { judge: true });
    expect(screen.getByText("Yes, it's me! Congratulations!")).toBeTruthy();
    expect(screen.getByText(/You got it: it's Person Secret character!/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next: reflection/ }));
    expect(screen.queryByLabelText("Your answer")).toBeNull(); // no separate guess
  });

  it("with a judge, the judge decides: identified wins, otherwise the game goes on", async () => {
    render(<PersonaggioMisteriosoPage />);
    pickAll();
    await start();
    mocks.judged = true;
    await askName(); // the judge did not confirm it
    expect(screen.queryByText(/You got it/)).toBeNull();
    expect(screen.getByRole("textbox")).toBeTruthy();

    mocks.sync.mockResolvedValue("identified");
    await askName();
    expect(screen.getByText(/You got it: it's Person Secret character!/)).toBeTruthy();
  });
});
