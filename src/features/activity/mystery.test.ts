import { describe, expect, it } from "vitest";
import { isCorrectGuess, nextTeacherHint, winningQuestion } from "./mystery";

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

describe("winningQuestion", () => {
  const chat = [
    { role: "assistant", content: "Chi sono? Di certo non Marie Curie…" },
    { role: "user", content: "Sei una donna?" },
    { role: "assistant", content: "Sì." },
  ];

  it("is null while no question of the student names the character", () => {
    expect(winningQuestion(chat, "Marie Curie")).toBeNull();
  });

  it("is the student's first question that names the character", () => {
    const won = [...chat, { role: "user", content: "Sei Marie Curie!" }, { role: "assistant", content: "Esatto." }, { role: "user", content: "Curie, lo sapevo" }];
    expect(winningQuestion(won, "Marie Curie")).toBe("Sei Marie Curie!");
  });
});

describe("nextTeacherHint", () => {
  it("gives the teacher's hints in order, then leaves it to the character", () => {
    const hints = ["Visse in Europa", "  ", "Fu un imperatore"];
    expect(nextTeacherHint(hints, 0)).toBe("Visse in Europa");
    expect(nextTeacherHint(hints, 1)).toBe("Fu un imperatore");
    expect(nextTeacherHint(hints, 2)).toBeNull();
    expect(nextTeacherHint(undefined, 0)).toBeNull();
  });
});
