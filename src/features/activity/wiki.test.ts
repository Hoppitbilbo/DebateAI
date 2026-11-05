import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWikiSummary } from "./wiki";

/** A Wikipedia query answer with one page. */
const answer = (page: Record<string, unknown>) => ({ ok: true, json: async () => ({ query: { pages: { "1": page } } }) });

/** Fakes the Wikipedia APIs: `links` are the language links, `extracts` the intros by "lang:title". */
const fakeWikipedia = (links: Record<string, string>, extracts: Record<string, string>) =>
  vi.fn(async (input: string) => {
    const url = new URL(input);
    const lang = url.hostname.split(".")[0];
    const title = url.searchParams.get("titles") ?? "";
    if (url.searchParams.get("prop") === "langlinks") {
      const to = url.searchParams.get("lllang");
      const link = links[`${lang}:${title}>${to}`];
      return answer(link ? { title, langlinks: [{ lang: to, "*": link }] } : { title });
    }
    return answer({ title, extract: extracts[`${lang}:${title}`] ?? "" });
  });

describe("fetchWikiSummary", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the page in the activity's language through the language links", async () => {
    const fetch = fakeWikipedia({ "it:Cristoforo Colombo>es": "Cristóbal Colón" }, { "es:Cristóbal Colón": "Navegante genovés." });
    vi.stubGlobal("fetch", fetch);
    expect(await fetchWikiSummary("Cristoforo Colombo", 4000, { from: "it", to: "es" })).toBe("Navegante genovés.");
    expect(fetch.mock.calls[0][0]).toContain("it.wikipedia.org");
    expect(fetch.mock.calls[0][0]).toContain("lllang=es");
  });

  it("falls back to the original page when the other Wikipedia has none", async () => {
    vi.stubGlobal("fetch", fakeWikipedia({}, { "it:Pinco Pallino": "Personaggio inventato." }));
    expect(await fetchWikiSummary("Pinco Pallino", 4000, { from: "it", to: "de" })).toBe("Personaggio inventato.");
  });

  it("falls back to the original page when the lookup fails", async () => {
    const extracts = { "it:Dante Alighieri": "Poeta." };
    vi.stubGlobal("fetch", vi.fn(async (input: string) =>
      input.includes("langlinks") ? { ok: false, status: 503, json: async () => ({}) } : fakeWikipedia({}, extracts)(input)));
    expect(await fetchWikiSummary("Dante Alighieri", 4000, { from: "it", to: "fr" })).toBe("Poeta.");
  });

  it("asks for no language links when both Wikipedias are the same", async () => {
    const fetch = fakeWikipedia({}, { "en:Ada Lovelace": "Mathematician." });
    vi.stubGlobal("fetch", fetch);
    expect(await fetchWikiSummary("Ada Lovelace", 5, { from: "en", to: "en" })).toBe("Mathe");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).not.toContain("langlinks");
  });
});
