import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MarkdownViewer from "./MarkdownViewer";

afterEach(cleanup);

describe("MarkdownViewer", () => {
  it("renders headings, tables, inline code and links", () => {
    const content = "# Titolo\n\nUna **risposta** con `codice` e [fonte](https://example.com).\n\n| A | B |\n|---|---|\n| uno | due |";
    render(<MarkdownViewer content={content} />);
    expect(screen.getByRole("heading", { name: "Titolo" })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("codice").tagName).toBe("CODE");
    expect(screen.getByRole("link").getAttribute("href")).toBe("https://example.com");
  });

  it("keeps fenced code readable, including unknown languages", async () => {
    const { container } = render(<MarkdownViewer content={'```javascript\nconst answer = 42;\n```\n\n```unlisted-language\nplain code\n```'} />);
    expect(container.textContent).toContain("const answer = 42;");
    expect(container.textContent).toContain("plain code");
    expect(await screen.findByText("42")).toBeTruthy();
  });

  it("does not turn raw HTML or dangerous URLs into executable content", () => {
    const { container } = render(<MarkdownViewer content={'<img src=x onerror="alert(1)">\n\n[bad](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe("javascript:void(0)");
  });
});
