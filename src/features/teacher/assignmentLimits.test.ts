import { describe, expect, it } from "vitest";
import { reconcileLimits } from "./assignmentLimits";
import { availableQuestions } from "@/features/activity/mystery";

const mystery = "personaggio-misterioso" as const;

describe("reconcileLimits", () => {
  it("keeps consistent settings as they are", () => {
    expect(reconcileLimits({ appType: "convinci-tu", minTurns: 3, maxTurns: 10 })).toEqual({ minTurns: 3, maxTurns: 10, questions: undefined, notes: [] });
  });

  it("lowers the minimum to the maximum", () => {
    const r = reconcileLimits({ appType: "convinci-tu", minTurns: 12, maxTurns: 5 });
    expect(r).toMatchObject({ minTurns: 5, maxTurns: 5 });
    expect(r.notes.map((n) => n.key)).toEqual(["minTurnsLowered"]);
  });

  it("makes the mystery questions the turn limit", () => {
    expect(reconcileLimits({ appType: mystery, minTurns: 0, maxTurns: 0, questions: 7 })).toMatchObject({ maxTurns: 7, notes: [] });
    const r = reconcileLimits({ appType: mystery, minTurns: 10, maxTurns: 4, questions: 7 });
    expect(r).toMatchObject({ minTurns: 7, maxTurns: 7, questions: 7 });
    expect(r.notes.map((n) => n.key)).toEqual(["maxTurnsFromQuestions", "minTurnsLowered"]);
  });

  it("keeps the mystery questions within bounds", () => {
    expect(reconcileLimits({ appType: mystery, minTurns: 0, maxTurns: 0, questions: 50 })).toMatchObject({ questions: 20, maxTurns: 20 });
    expect(reconcileLimits({ appType: mystery, minTurns: 0, maxTurns: 0, questions: 1 })).toMatchObject({ questions: 3, maxTurns: 3 });
  });

  it("leaves the turn limit alone when the student picks the questions", () => {
    expect(reconcileLimits({ appType: mystery, minTurns: 0, maxTurns: 6 })).toMatchObject({ maxTurns: 6, questions: undefined, notes: [] });
  });

  it("ignores negative or empty numbers", () => {
    expect(reconcileLimits({ appType: "convinci-tu", minTurns: -4, maxTurns: NaN })).toMatchObject({ minTurns: 0, maxTurns: 0 });
  });
});

describe("availableQuestions", () => {
  it("uses the default and the bounds", () => {
    expect(availableQuestions(undefined)).toBe(7);
    expect(availableQuestions(1)).toBe(3);
    expect(availableQuestions(99)).toBe(20);
  });

  it("never exceeds the turn limit of older assignments", () => {
    expect(availableQuestions(10, 4)).toBe(4);
    expect(availableQuestions(5, 0)).toBe(5);
  });
});
