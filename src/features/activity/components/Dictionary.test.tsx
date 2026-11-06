import { createRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import Dictionary, { type DictionaryHandle } from "./Dictionary";

const mocks = vi.hoisted(() => ({ fetchDefinition: vi.fn() }));
vi.mock("../wiktionary", async (orig) => ({ ...(await orig<typeof import("../wiktionary")>()), fetchDefinition: mocks.fetchDefinition }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const site = { host: "it", section: "Italiano" };
const fecondo = { title: "fecondo", url: "https://it.wiktionary.org/wiki/fecondo", senses: [{ pos: "Aggettivo", text: "(biologia) idoneo alla riproduzione" }] };

describe("Dictionary", () => {
  it("opens a search from its button and shows the senses found", async () => {
    mocks.fetchDefinition.mockResolvedValue(fecondo);
    render(<Dictionary site={site} />);
    fireEvent.click(screen.getByRole("button", { name: /Dizionario/ }));
    expect(screen.getByText(/Tocca una parola del personaggio/)).toBeTruthy();
    const box = screen.getByLabelText("Cerca una parola");
    expect(document.activeElement).toBe(box);
    fireEvent.change(box, { target: { value: " fecondo " } });
    fireEvent.submit(box.closest("form")!);
    expect(await screen.findByText("(biologia) idoneo alla riproduzione")).toBeTruthy();
    expect(mocks.fetchDefinition).toHaveBeenCalledWith("fecondo", site);
    expect(screen.getByRole("link", { name: /Wikizionario/ }).getAttribute("href")).toBe(fecondo.url);
  });

  it("looks a tapped word up at once, without focusing the search box", async () => {
    mocks.fetchDefinition.mockResolvedValue(null);
    const ref = createRef<DictionaryHandle>();
    render(<Dictionary ref={ref} site={site} />);
    act(() => ref.current!.lookUp("zzyzx", new DOMRect(10, 10, 40, 16)));
    expect(await screen.findByText("Nessuna definizione trovata per «zzyzx».")).toBeTruthy();
    expect(document.activeElement).not.toBe(screen.getByLabelText("Cerca una parola"));
    expect(screen.getByRole("link", { name: /Wikizionario/ }).getAttribute("href")).toBe("https://it.wiktionary.org/wiki/zzyzx");
  });

  it("says when the dictionary does not answer", async () => {
    mocks.fetchDefinition.mockRejectedValue(new Error("Wiktionary 503"));
    const ref = createRef<DictionaryHandle>();
    render(<Dictionary ref={ref} site={site} />);
    act(() => ref.current!.lookUp("esprit", new DOMRect()));
    expect(await screen.findByText(/Il dizionario non risponde/)).toBeTruthy();
  });
});
