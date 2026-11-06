import type { AssignmentConfig } from "@/lib/api";

// The teacher's vocabulary choices (P2): the level the characters speak at
// and words the student should practise. The server puts both in the prompts
// (prompts.go vocabularyRules); the browser shows the words and ticks them off.

export type VocabularyLevel = "basic" | "standard" | "advanced";
export const VOCABULARY_LEVELS: readonly VocabularyLevel[] = ["basic", "standard", "advanced"];

/** As on the server (maxTargetWords, maxTargetWordChars). */
export const MAX_TARGET_WORDS = 15;
export const MAX_TARGET_WORD_CHARS = 40;

/** The teacher's list as typed (commas or new lines), cleaned like the server cleans it. */
export const parseTargetWords = (text: string): string[] => {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[,;\n]/)) {
    const word = raw.replace(/"/g, "").trim().replace(/\s+/g, " ").slice(0, MAX_TARGET_WORD_CHARS);
    if (!word || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    words.push(word);
    if (words.length === MAX_TARGET_WORDS) break;
  }
  return words;
};

/** The words of an assignment's list, already cleaned. */
export const targetWordsOf = (config?: AssignmentConfig | null): string[] => parseTargetWords((config?.targetWords ?? []).join("\n"));

/** Lower case, without accents: "Perché" and "perche" are the same word for a student typing fast. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const tokens = (s: string) => fold(s).match(/[\p{L}\p{N}]+/gu) ?? [];

/**
 * One student word counts for one target word when they are equal or, for
 * words of five letters or more, when they share the stem (the target without
 * its last two letters, at least four): "fecondo" is also used as "feconda".
 */
const sameWord = (target: string, word: string) => {
  if (target.length < 5) return word === target;
  const stem = target.slice(0, Math.max(4, target.length - 2));
  return word.startsWith(stem);
};

/** The target words (as written by the teacher) that appear in the student's texts. */
export const usedTargetWords = (targets: string[], texts: string[]): Set<string> => {
  const words = texts.flatMap(tokens);
  const used = new Set<string>();
  for (const target of targets) {
    const parts = tokens(target);
    if (parts.length === 0) continue;
    const found = words.some((_, i) => parts.every((p, j) => i + j < words.length && sameWord(p, words[i + j])));
    if (found) used.add(target);
  }
  return used;
};
