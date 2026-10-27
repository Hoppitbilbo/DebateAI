import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CodeBlock from "./CodeBlock";

vi.mock("./HighlightedCode", () => { throw new Error("offline"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps code readable if the optional highlighting download fails", async () => {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  const { rerender } = render(<pre><CodeBlock language="javascript">const answer = 42;</CodeBlock></pre>);
  expect(screen.getByText("const answer = 42;")).toBeTruthy();
  await waitFor(() => expect(report).toHaveBeenCalled());
  rerender(<pre><CodeBlock language="javascript">const answer = 43;</CodeBlock></pre>);
  expect(screen.getByText("const answer = 43;")).toBeTruthy();
});
