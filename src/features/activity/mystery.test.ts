import { describe, expect, it } from "vitest";
import { isCorrectGuess } from "./mystery";

describe("isCorrectGuess", () => {
  it("accepts full names, partial names and a shared surname, ignoring case and accents", () => {
    expect(isCorrectGuess("leonardo da vinci", "Leonardo da Vinci")).toBe(true);
    expect(isCorrectGuess("Napoleone", "Napoleone Bonaparte")).toBe(true);
    expect(isCorrectGuess("Bonaparte", "Napoleone Bonaparte")).toBe(true);
    expect(isCorrectGuess("Marie Curié", "Marie Curie")).toBe(true);
    expect(isCorrectGuess("Cleopatra VII", "Cleopatra (regina)")).toBe(true);
  });

  it("rejects empty and unrelated guesses", () => {
    expect(isCorrectGuess("", "Galileo Galilei")).toBe(false);
    expect(isCorrectGuess("Newton", "Galileo Galilei")).toBe(false);
    expect(isCorrectGuess("Da", "Leonardo da Vinci")).toBe(true); // short words still match by containment
  });
});
