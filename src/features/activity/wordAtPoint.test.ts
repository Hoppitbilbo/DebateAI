import { describe, expect, it } from "vitest";
import { wordAround } from "./wordAtPoint";

const at = (text: string, offset: number, lang = "it") => {
  const b = wordAround(text, offset, lang);
  return b && text.slice(b.start, b.end);
};

describe("wordAround", () => {
  it("finds the word at any of its letters and at its edges", () => {
    const text = "Il mattino ha l'oro in bocca";
    expect(at(text, 3)).toBe("mattino");
    expect(at(text, 6)).toBe("mattino");
    expect(at(text, 10)).toBe("mattino");
  });

  it("keeps accents and splits the article off an apostrophe", () => {
    expect(at("perché l'intelletto", 4)).toBe("perché");
    expect(at("perché l'intelletto", 12)).toBe("intelletto");
    expect(at("perché l'intelletto", 7)).toBe("intelletto");
    expect(at("dell’anima", 2)).toBe("anima");
    expect(at("qu'il pense", 1, "fr")).toBe("il");
  });

  it("leaves apostrophes alone in other languages", () => {
    expect(at("don't", 1, "en")).toBe("don't");
  });

  it("finds nothing on punctuation or numbers", () => {
    expect(at("Sì — 1642!", 3)).toBeNull();
    expect(at("Sì — 1642!", 7)).toBeNull();
  });
});
