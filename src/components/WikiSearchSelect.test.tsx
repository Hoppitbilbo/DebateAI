import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WikiSearchSelect from "./WikiSearchSelect";

const lang = vi.hoisted(() => ({ value: "en-US" }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: lang.value } }) }));
vi.mock("@/i18n", () => ({ default: { language: "en-US" } }));

// jsdom lacks what cmdk and Radix use.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const answer = (titles: string[]) =>
  new Response(JSON.stringify({ query: { search: titles.map((title, i) => ({ title, snippet: "s", pageid: i + 1 })) } }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const openAndType = async (text: string) => {
  if (!screen.queryByPlaceholderText("common.searchOnWikipedia")) fireEvent.click(screen.getByRole("combobox"));
  const input = await screen.findByPlaceholderText("common.searchOnWikipedia");
  fireEvent.change(input, { target: { value: text } });
  return input;
};

describe("WikiSearchSelect", () => {
  it("asks for a name first, then searches the Wikipedia of the interface language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(answer(["Ada Lovelace"]));
    vi.stubGlobal("fetch", fetchMock);
    render(<WikiSearchSelect onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("common.typeToSearch")).toBeTruthy();
    expect(screen.queryByText("common.noResultsFound")).toBeNull();
    await openAndType("Ada");
    expect(await screen.findByText("Ada Lovelace", {}, { timeout: 2000 })).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toContain("https://en.wikipedia.org/"); // en-US → en
  });

  it("never lets an older answer replace a newer one", async () => {
    let slow!: (r: Response) => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => (slow = resolve)))
      .mockResolvedValueOnce(answer(["Marie Curie"]));
    vi.stubGlobal("fetch", fetchMock);
    render(<WikiSearchSelect onSelect={vi.fn()} />);
    const input = await openAndType("Mar");
    await act(() => new Promise((r) => setTimeout(r, 600))); // first search sent
    fireEvent.change(input, { target: { value: "Marie" } });
    expect(await screen.findByText("Marie Curie", {}, { timeout: 2000 })).toBeTruthy();
    await act(async () => slow(answer(["Mario Rossi"]))); // the late answer to "Mar"
    expect(screen.queryByText("Mario Rossi")).toBeNull();
  });

  it("tells a failed search from no results, and retries", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(answer([]));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<WikiSearchSelect onSelect={vi.fn()} />);
    await openAndType("Zzz");
    expect(await screen.findByText("common.searchFailed", {}, { timeout: 2000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));
    expect(await screen.findByText("common.noResultsFound", {}, { timeout: 2000 })).toBeTruthy();
  });
});
