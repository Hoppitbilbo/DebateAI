import { describe, expect, it } from "vitest";
import { isCorrectGuess } from "./mystery";

describe("isCorrectGuess (strict)", () => {
  it("accepts the full name or a significant word of it, ignoring case and accents", () => {
    expect(isCorrectGuess("leonardo da vinci", "Leonardo da Vinci")).toBe(true);
    expect(isCorrectGuess("Vinci", "Leonardo da Vinci")).toBe(true);
    expect(isCorrectGuess("Napoleone", "Napoleone Bonaparte")).toBe(true);
    expect(isCorrectGuess("è Bonaparte!", "Napoleone Bonaparte")).toBe(true);
    expect(isCorrectGuess("Marie Curié", "Marie Curie")).toBe(true);
    expect(isCorrectGuess("Cleopatra VII", "Cleopatra (regina)")).toBe(true);
  });

  it("rejects fragments, particles, misspellings and other people", () => {
    expect(isCorrectGuess("", "Galileo Galilei")).toBe(false);
    expect(isCorrectGuess("Da", "Leonardo da Vinci")).toBe(false);
    expect(isCorrectGuess("Leo", "Leonardo da Vinci")).toBe(false);
    expect(isCorrectGuess("van", "Vincent van Gogh")).toBe(false);
    expect(isCorrectGuess("Galilei Galileo?", "Galileo Galilei")).toBe(true);
    expect(isCorrectGuess("Galile", "Galileo Galilei")).toBe(false);
    expect(isCorrectGuess("Newton", "Galileo Galilei")).toBe(false);
  });
});
