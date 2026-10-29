import { describe, expect, it } from "vitest";
import { characterOrder, mysteryCharacters } from "./characterOrder";

const names = ["Einstein", "Curie", "Bohr", "Fermi", "Planck", "Heisenberg"];

describe("characterOrder", () => {
  it("keeps the teacher's order without shuffle", () => {
    expect(characterOrder(names, false, "1:7")).toEqual(names);
  });

  it("gives each student the same order every time, and different students different orders", () => {
    const anna = characterOrder(names, true, "1:7");
    expect(characterOrder(names, true, "1:7")).toEqual(anna);
    expect([...anna].sort()).toEqual([...names].sort());
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => characterOrder(names, true, `1:${i}`)[0]));
    expect(firsts.size).toBeGreaterThan(2);
  });
});

describe("mysteryCharacters", () => {
  it("reads the list, or the single character of older assignments", () => {
    expect(mysteryCharacters({ characters: [{ title: "A" }, { title: "B" }] }).map((c) => c.title)).toEqual(["A", "B"]);
    expect(mysteryCharacters({ character: { title: "A" } }).map((c) => c.title)).toEqual(["A"]);
    expect(mysteryCharacters({})).toEqual([]);
  });
});
