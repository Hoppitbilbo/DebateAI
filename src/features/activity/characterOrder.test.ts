import { describe, expect, it } from "vitest";
import { characterOrder, mysteryCharacters, playedRounds } from "./characterOrder";
import type { SessionSummary } from "@/lib/api";

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

describe("playedRounds", () => {
  const order = [{ title: "A" }, { title: "B" }, { title: "C" }];
  const attempt = (character: string, status: SessionSummary["status"], assignmentId = 4) =>
    ({ id: 1, assignmentId, appType: "personaggio-misterioso", title: "", status, turns: 1, progress: 0, costUsd: 0, startedAt: "", updatedAt: "", character }) as SessionSummary;

  it("starts after the furthest character the student finished on this assignment, on any computer", () => {
    expect(playedRounds(order, [], 4)).toBe(0);
    expect(playedRounds(order, [attempt("B", "completed"), attempt("A", "goal_reached")], 4)).toBe(2);
    expect(playedRounds(order, [attempt("C", "turn_limit")], 4)).toBe(3);
  });

  it("ignores unfinished attempts, other assignments and characters not in the list", () => {
    expect(playedRounds(order, [attempt("C", "active"), attempt("C", "abandoned"), attempt("C", "completed", 5), attempt("Z", "completed")], 4)).toBe(0);
  });
});
