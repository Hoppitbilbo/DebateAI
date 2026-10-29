import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FeedbackStep from "./FeedbackStep";

// The diffusion easter egg of the final feedback: off by default, switched
// with three quick clicks on the title, kept in this browser.

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }) }));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/context/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/shared/MarkdownViewer", () => ({ default: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div> }));
// Pretext measures with a canvas, which jsdom has not: the effect is a stand-in here.
vi.mock("../diffusion/DiffusionText", () => ({
  default: ({ markdown, onDone }: { markdown: string; onDone: () => void }) => <button onClick={onDone}>diffusing: {markdown}</button>,
}));

const evaluation = { markdown: "Ottimo **lavoro**", scoreConversation: 8, scoreReflection: 7 };
const renderFeedback = (props: Partial<Parameters<typeof FeedbackStep>[0]> = {}) =>
  render(
    <MemoryRouter>
      <FeedbackStep title="Napoleone" evaluation={evaluation as never} partial="" loading={false} reflection="" messages={[]} onRestart={vi.fn()} {...props} />
    </MemoryRouter>,
  );
const title = () => screen.getByRole("button", { name: "platform.feedback.aiFeedback" });

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("FeedbackStep diffusion easter egg", () => {
  it("is off by default: the feedback is plain Markdown", () => {
    renderFeedback();
    expect(screen.getByTestId("markdown").textContent).toBe("Ottimo **lavoro**");
    fireEvent.click(title());
    fireEvent.click(title());
    expect(screen.queryByText(/diffusing/)).toBeNull();
  });

  it("three quick clicks on the title switch it on, play it once, and keep the choice", async () => {
    renderFeedback();
    fireEvent.click(title());
    fireEvent.click(title());
    fireEvent.click(title());
    expect(mocks.toast).toHaveBeenCalledWith("platform.feedback.diffusionOn");
    fireEvent.click(await screen.findByText(/diffusing: Ottimo/)); // the effect is loaded on demand
    expect(screen.getByTestId("markdown")).toBeTruthy();
    expect(localStorage.getItem("debateai:feedback-diffusion")).toBe("on");

    cleanup();
    renderFeedback({ loading: true, evaluation: null, partial: "Ott" });
    expect(screen.queryByTestId("markdown")).toBeNull(); // the streamed text stays hidden
    expect(screen.getByText("platform.feedback.generating")).toBeTruthy();
  });

  it("never plays for whoever asked for less motion", () => {
    localStorage.setItem("debateai:feedback-diffusion", "on");
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce") }));
    renderFeedback();
    expect(screen.getByTestId("markdown")).toBeTruthy();
    expect(screen.queryByText(/diffusing/)).toBeNull();
  });
});
