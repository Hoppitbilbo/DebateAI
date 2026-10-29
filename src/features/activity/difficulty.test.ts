import { describe, expect, it } from "vitest";
import { difficultyOf, difficultyRule, hasDifficulty } from "./difficulty";

describe("difficulty", () => {
  it("uses the teacher's level first, then the student's, then medium", () => {
    expect(difficultyOf("hard", "easy")).toBe("hard");
    expect(difficultyOf(undefined, "easy")).toBe("easy");
    expect(difficultyOf("nonsense")).toBe("medium");
  });

  it("exists for the mystery game, Convinci tu and Impersona tu only", () => {
    expect(hasDifficulty("personaggio-misterioso")).toBe(true);
    expect(hasDifficulty("wiki-chatbot")).toBe(false);
    expect(difficultyRule("mystery", "hard")).toMatch(/ONLY with "Yes\." or "No\."/);
    expect(difficultyRule("impersona", "hard")).toMatch(/stubborn/);
    expect(difficultyRule("impersona", "easy")).toMatch(/change your mind as soon as/);
  });
});
