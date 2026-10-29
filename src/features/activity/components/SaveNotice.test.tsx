import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSaveNotice, SubmitNotice } from "./SaveNotice";

// The student must see when work is not reaching the server (audit 2026-10-29, item 1).

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(cleanup);

describe("ChatSaveNotice", () => {
  it("stays silent while saves go through", () => {
    const { container } = render(<ChatSaveNotice saveState="saved" startFailed={false} onRetry={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("offers a retry when a save failed", () => {
    const onRetry = vi.fn();
    render(<ChatSaveNotice saveState="failed" startFailed={false} onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("platform.activity.saveFailed");
    fireEvent.click(screen.getByRole("button", { name: "platform.activity.retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("says that practice without a server session is not saved", () => {
    render(<ChatSaveNotice saveState="idle" startFailed onRetry={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("platform.activity.notSaved");
  });
});

describe("SubmitNotice", () => {
  it("confirms a hand-in only for assignments", () => {
    render(<SubmitNotice state="submitted" assignment onRetry={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("platform.feedback.submitted");
    cleanup();
    render(<SubmitNotice state="submitted" assignment={false} onRetry={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toContain("platform.feedback.savedToHistory");
  });

  it("offers a retry when the hand-in failed", () => {
    const onRetry = vi.fn();
    render(<SubmitNotice state="failed" assignment onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "platform.activity.retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});
