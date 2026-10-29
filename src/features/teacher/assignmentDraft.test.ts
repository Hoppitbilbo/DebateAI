import { describe, expect, it } from "vitest";
import { draftBody, draftOf } from "./assignmentDraft";

const ref = (title: string) => ({ title, lang: "it" }) as never;

describe("assignment drafts", () => {
  it("starts with the defaults of a new assignment", () => {
    expect(draftOf()).toMatchObject({ appType: "wiki-chatbot", goals: [""], autoEnd: true, requireReflection: true, allowLive: true, minTurns: 0, maxTurns: 0 });
  });

  it("drops empty goals and keeps a pair of characters only when complete", () => {
    const d = { ...draftOf(), appType: "doppia-intervista" as const, goals: [" Chiede perché ", "", "  "], config: { characters: [ref("Dante")] } };
    const body = draftBody(d);
    expect(body.goals).toEqual(["Chiede perché"]);
    expect(body.config.characters).toBeUndefined();
    expect(draftBody({ ...d, config: { characters: [ref("Dante"), ref("Virgilio")] } }).config.characters).toHaveLength(2);
  });

  it("uses the questions of the mystery game as the turn limit", () => {
    const body = draftBody({ ...draftOf(), appType: "personaggio-misterioso", maxTurns: 50, config: { questions: 10 } });
    expect(body.maxTurns).toBe(10);
    expect(body.config.questions).toBe(10);
  });

  it("keeps the mystery game's hints without the empty ones, and none for other apps", () => {
    const mystery = { ...draftOf(), appType: "personaggio-misterioso" as const, config: { hints: [" Visse in Europa ", "", "Fu imperatore"] } };
    expect(draftBody(mystery).config.hints).toEqual(["Visse in Europa", "Fu imperatore"]);
    expect(draftBody({ ...mystery, config: { hints: ["", " "] } }).config.hints).toBeUndefined();
    expect(draftBody({ ...mystery, appType: "convinci-tu" }).config.hints).toBeUndefined();
  });
});
