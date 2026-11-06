import { describe, expect, it } from "vitest";
import { MAX_TARGET_WORD_CHARS, MAX_TARGET_WORDS, parseTargetWords, targetWordsOf, usedTargetWords } from "./vocabulary";

describe("parseTargetWords", () => {
  it("splits on commas and new lines, trims, drops duplicates and quotes", () => {
    expect(parseTargetWords(' ingegno, Fecondo ,\nfecondo;; "pensiero   critico" ,')).toEqual(["ingegno", "Fecondo", "pensiero critico"]);
  });

  it("keeps the server's limits", () => {
    const many = Array.from({ length: MAX_TARGET_WORDS + 3 }, (_, i) => `w${i}`).join(",");
    expect(parseTargetWords(many)).toHaveLength(MAX_TARGET_WORDS);
    expect(parseTargetWords("a".repeat(MAX_TARGET_WORD_CHARS + 5))[0]).toHaveLength(MAX_TARGET_WORD_CHARS);
  });

  it("reads an assignment's list", () => {
    expect(targetWordsOf({ targetWords: [" a ", "A", "b"] })).toEqual(["a", "b"]);
    expect(targetWordsOf(null)).toEqual([]);
  });
});

describe("usedTargetWords", () => {
  const used = (targets: string[], ...texts: string[]) => [...usedTargetWords(targets, texts)];

  it("finds whole words, ignoring case and accents", () => {
    expect(used(["perché", "eppure"], "Perche no? Lo dico io.")).toEqual(["perché"]);
  });

  it("accepts other forms of long words, not of short ones", () => {
    expect(used(["fecondo", "idea"], "Una mente feconda ha idee.")).toEqual(["fecondo"]);
  });

  it("does not count a short word inside a longer one", () => {
    expect(used(["sole"], "Il girasole")).toEqual([]);
  });

  it("finds expressions of several words in order", () => {
    expect(used(["pensiero critico", "senso comune"], "Serve il pensiero critico.", "Il comune senso")).toEqual(["pensiero critico"]);
  });
});
