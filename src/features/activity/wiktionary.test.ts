import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dictionarySite, fetchDefinition, parseExtract } from "./wiktionary";

/** Real extracts saved from Wiktionary on 2026-11-06. */
const fixture = (name: string) => readFileSync(join(process.cwd(), "src/features/activity/__fixtures__/wiktionary", `${name}.txt`), "utf8");
const parse = (name: string, practice: string, ui = "it") => parseExtract(fixture(name), dictionarySite(practice, ui));
const texts = (name: string, practice: string, ui?: string) => parse(name, practice, ui).map((s) => s.text);

describe("dictionarySite", () => {
  it("uses the language's own Wiktionary, and the interface's for Latin", () => {
    expect(dictionarySite("fr", "it")).toEqual({ host: "fr", section: "Français" });
    expect(dictionarySite("la", "de")).toEqual({ host: "de", section: "(Latein)" });
    expect(dictionarySite("la", "xx")).toEqual({ host: "it", section: "Latino" });
  });
});

describe("parseExtract", () => {
  it("reads the senses of each layout", () => {
    expect(parse("it-fecondo", "it")).toEqual([
      { pos: "Aggettivo", text: "(biologia) idoneo alla riproduzione" },
      { pos: "Voce verbale", text: "prima persona singolare dell'indicativo presente di fecondare" },
    ]);
    expect(texts("de-Verstand", "de")).toEqual([
      "Fähigkeit, zu verstehen, zu urteilen und logisch zu denken; die Gesamtheit der geistigen Kräfte",
      "gehoben: Art der Auffassung eines geistigen Inhaltes",
    ]);
    expect(texts("en-fruitful", "en")).toEqual([
      "Favourable to the growth of fruit or useful vegetation; not barren.",
      "Being productive in any sense; yielding benefits.",
    ]);
    // Portuguese pages put the language one heading level higher
    expect(texts("pt-engenho", "pt")[2]).toBe("habilidade do inventar");
  });

  it("skips Spanish sense numbers and lists, and French examples", () => {
    expect(texts("es-ingenio", "es")[0]).toBe("Habilidad para componer, inventar o para hallar medios adecuados a un fin.");
    expect(texts("es-ingenio", "es").some((t) => /^\d+$|Sinónimo/.test(t))).toBe(false);
    expect(texts("fr-pense", "fr")).toEqual([
      "Première personne du singulier du présent de l’indicatif de penser.",
      "Troisième personne du singulier du présent de l’indicatif de penser.",
      "Première personne du singulier du présent du subjonctif de penser.",
    ]);
  });

  it("keeps a few senses, from the word's language only", () => {
    const esprit = parse("fr-esprit", "fr");
    expect(esprit.length).toBeLessThanOrEqual(5);
    expect(esprit.filter((s) => s.pos === "Nom commun")).toHaveLength(3);
    // "pensa" is also a French and a Latin form on it.wiktionary: only the Italian senses
    expect(texts("it-pensa", "it")).toEqual([
      "terza persona singolare dell'indicativo presente di pensare",
      "seconda persona singolare dell'imperativo di pensare",
    ]);
  });

  it("reads Latin words in the Latin section, without the source credit", () => {
    expect(parse("it-virtus", "la", "it")).toEqual([{ pos: "Sostantivo", text: "virtù" }]);
  });

  it("finds nothing outside the language section", () => {
    expect(parse("it-virtus", "it")).toEqual([]);
  });
});

describe("fetchDefinition", () => {
  afterEach(() => vi.unstubAllGlobals());

  const page = (title: string, extract?: string) => ({ ok: true, json: async () => ({ query: { pages: { "1": extract ? { title, extract } : { title, missing: "" } } } }) });

  it("tries the lower-case form when the tapped one has no page", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(page("Fecondo"))
      .mockResolvedValueOnce(page("fecondo", fixture("it-fecondo")));
    vi.stubGlobal("fetch", fetchMock);
    const def = await fetchDefinition("Fecondo", dictionarySite("it", "it"));
    expect(def?.title).toBe("fecondo");
    expect(def?.url).toBe("https://it.wiktionary.org/wiki/fecondo");
    expect(def?.senses[0].pos).toBe("Aggettivo");
    expect(fetchMock.mock.calls[1][0]).toContain("titles=fecondo");
  });

  it("answers null when no form has senses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("x")));
    expect(await fetchDefinition("Zzyzx", dictionarySite("en", "it"))).toBeNull();
  });

  it("fails when Wiktionary cannot be reached, and tries again next time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchDefinition("esprit", dictionarySite("fr", "it"))).rejects.toThrow("503");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("esprit", fixture("fr-esprit"))));
    expect((await fetchDefinition("esprit", dictionarySite("fr", "it")))?.senses.length).toBeGreaterThan(0);
  });
});
