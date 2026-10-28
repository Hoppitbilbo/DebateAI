import { describe, expect, it } from "vitest";
import { suggestAll, suggestStudent } from "./matchNicknames";

const students = [
  { userId: 1, name: "Marco Rossi" },
  { userId: 2, name: "Marco Bianchi" },
  { userId: 3, name: "Giulia Verdi" },
  { userId: 4, name: "Nicolò Ferrà" },
];

describe("suggestStudent", () => {
  it("matches a first name and an initial", () => {
    expect(suggestStudent("Marco R", students)).toBe(1);
    expect(suggestStudent("marco b.", students)).toBe(2);
  });
  it("matches a unique first name, ignoring accents and case", () => {
    expect(suggestStudent("giulia", students)).toBe(3);
    expect(suggestStudent("NICOLO F", students)).toBe(4);
  });
  it("does not guess when more than one student fits", () => {
    expect(suggestStudent("Marco", students)).toBe(0);
  });
  it("does not guess for unrelated nicknames", () => {
    expect(suggestStudent("Volpe veloce", students)).toBe(0);
    expect(suggestStudent("  ", students)).toBe(0);
  });
});

describe("suggestAll", () => {
  it("never suggests the same student twice", () => {
    expect(suggestAll(["Giulia", "Giulia V"], students)).toEqual({ Giulia: 3, "Giulia V": 0 });
  });
});
