import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChatPanel from "./ChatPanel";
import type { ActivityMessage } from "../types";

const mocks = vi.hoisted(() => ({ markdown: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "it" } }),
}));
vi.mock("@/hooks/useSpeechDictation", () => ({
  useSpeechDictation: () => ({ supported: false, stop: vi.fn() }),
}));
vi.mock("@/components/shared/MarkdownViewer", () => ({
  default: ({ content }: { content: string }) => {
    mocks.markdown(content);
    return <div>{content}</div>;
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const history: ActivityMessage[] = [
  { id: "intro", role: "system", content: "Introduzione" },
  { id: "question", role: "user", content: "Una domanda", name: "Studente" },
  { id: "answer", role: "assistant", content: "Una risposta", name: "Dante" },
];

describe("ChatPanel", () => {
  it("does not reparse completed messages when typing or streaming another reply", () => {
    const messages = Array.from({ length: 200 }, (_, i): ActivityMessage => ({ id: String(i), role: "assistant", content: `Risposta ${i}` }));
    const props = { messages, onSend: vi.fn() };
    const { rerender } = render(<ChatPanel {...props} />);
    expect(mocks.markdown).toHaveBeenCalledTimes(200);
    mocks.markdown.mockClear();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nuova domanda" } });
    expect(mocks.markdown).not.toHaveBeenCalled();

    const latest = { ...messages[199], content: "Risposta che cresce", streaming: true };
    rerender(<ChatPanel {...props} messages={[...messages.slice(0, -1), latest]} canRetry={() => false} speakerStyles={{}} />);
    expect(mocks.markdown).toHaveBeenCalledOnce();
    expect(mocks.markdown).toHaveBeenCalledWith("Risposta che cresce");
  });

  it("preserves the transcript, trims submitted text and clears the input", () => {
    const onSend = vi.fn();
    render(<ChatPanel messages={history} onSend={onSend} />);
    for (const message of history) expect(screen.getByText(message.content)).toBeTruthy();
    expect(screen.getByText("Dante")).toBeTruthy();
    expect(screen.getByText("Studente")).toBeTruthy();
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "  Ciao  " } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Ciao");
    expect(input.value).toBe("");
  });

  it("keeps retry availability and disabled state up to date", () => {
    const messages: ActivityMessage[] = [{ id: "failed", role: "assistant", content: "Errore", error: true }];
    const onRetry = vi.fn();
    const props = { messages, onSend: vi.fn(), onRetry, canRetry: () => true };
    const { rerender } = render(<ChatPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "platform.activity.retry" }));
    expect(onRetry).toHaveBeenCalledWith("failed");
    rerender(<ChatPanel {...props} busy />);
    expect((screen.getByRole("button", { name: "platform.activity.retry" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    rerender(<ChatPanel {...props} canRetry={() => false} />);
    expect(screen.queryByRole("button", { name: "platform.activity.retry" })).toBeNull();
  });

  it("scrolls to the latest message when the transcript changes", () => {
    const { container, rerender } = render(<ChatPanel messages={history} onSend={vi.fn()} />);
    const viewport = container.querySelector('[aria-live="polite"]') as HTMLDivElement;
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1200 });
    rerender(<ChatPanel messages={[...history, { id: "next", role: "assistant", content: "Ancora" }]} onSend={vi.fn()} />);
    expect(viewport.scrollTop).toBe(1200);
  });

  it("follows late layout changes at the bottom, without moving a reader who scrolled up", () => {
    let onResize: ResizeObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { onResize = callback; }
      observe() {}
      disconnect = disconnect;
    });
    const { container, unmount } = render(<ChatPanel messages={history} onSend={vi.fn()} />);
    const viewport = container.querySelector('[aria-live="polite"]') as HTMLDivElement;
    Object.defineProperty(viewport, "clientHeight", { value: 400 });
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1200 });
    viewport.scrollTop = 800;
    fireEvent.scroll(viewport);

    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1600 });
    act(() => onResize([], {} as ResizeObserver));
    expect(viewport.scrollTop).toBe(1600);

    viewport.scrollTop = 200;
    fireEvent.scroll(viewport);
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 2000 });
    act(() => onResize([], {} as ResizeObserver));
    expect(viewport.scrollTop).toBe(200);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
