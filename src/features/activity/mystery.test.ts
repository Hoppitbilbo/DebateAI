import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isCorrectGuess, nextTeacherHint, winningQuestion } from "./mystery";

// Shared with the Go test (namesCharacter), so the two rules cannot drift apart.
const NAME_CASES: { message: string; answer: string; expected: boolean }[] = JSON.parse(
  readFileSync(join(process.cwd(), "server/internal/app/testdata/mystery_names.json"), "utf8"),
);

describe("isCorrectGuess (strict)", () => {
  it.each(NAME_CASES)("$message / $answer → $expected", ({ message, answer, expected }) => {
    expect(isCorrectGuess(message, answer)).toBe(expected);
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
