import { afterEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/features/activity/wikiImage");
const { fetchWikiImage } = await import("./wikiImage");

const reply = (pages: object) => Promise.resolve(new Response(JSON.stringify({ query: { pages } })));

describe("fetchWikiImage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the page thumbnail and asks Wikipedia once per title", async () => {
    const fetchMock = vi.fn(() => reply({ 1: { thumbnail: { source: "https://upload.example/galileo.jpg" } } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchWikiImage("Galileo Galilei")).toBe("https://upload.example/galileo.jpg");
    expect(await fetchWikiImage("Galileo Galilei")).toBe("https://upload.example/galileo.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for a page without an image or a failed request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => reply({ 2: { title: "Rinascimento" } })));
    expect(await fetchWikiImage("Rinascimento")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await fetchWikiImage("Offline page")).toBeNull();
  });
});
