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
    const napoleon = ref("Napoleone Bonaparte");
    const mystery = { ...draftOf(), appType: "personaggio-misterioso" as const, config: { character: napoleon, hints: [" Visse in Europa ", "", "Fu imperatore"] } };
    expect(draftBody(mystery).config.hints).toEqual(["Visse in Europa", "Fu imperatore"]);
    expect(draftBody({ ...mystery, config: { character: napoleon, hints: ["", " "] } }).config.hints).toBeUndefined();
    // the hints describe the teacher's character: without one they would mislead
    expect(draftBody({ ...mystery, config: { hints: ["Fu imperatore"] } }).config.hints).toBeUndefined();
    expect(draftBody({ ...mystery, appType: "convinci-tu" }).config.hints).toBeUndefined();
  });

  it("saves one mystery character as before, several as a list with shuffle and without hints", () => {
    const base = { ...draftOf(), appType: "personaggio-misterioso" as const };
    const one = draftBody({ ...base, config: { characters: [ref("Einstein")], shuffle: true, hints: ["Fisico"] } }).config;
    expect(one.character).toEqual(ref("Einstein"));
    expect(one.characters).toBeUndefined();
    expect(one.shuffle).toBeUndefined();
    expect(one.hints).toEqual(["Fisico"]);

    const many = draftBody({ ...base, config: { characters: [ref("Einstein"), ref("Curie")], shuffle: true, hints: ["Fisico"] } }).config;
    expect(many.characters).toHaveLength(2);
    expect(many.character).toBeUndefined();
    expect(many.shuffle).toBe(true);
    expect(many.hints).toBeUndefined();
  });

  it("edits a saved mystery character as a one-item list", () => {
    const a = { appType: "personaggio-misterioso", config: { character: ref("Einstein") }, goals: [] } as never;
    expect(draftOf(a).config).toMatchObject({ characters: [ref("Einstein")], character: undefined });
  });

  it("keeps the difficulty only for the apps that have one", () => {
    expect(draftBody({ ...draftOf(), appType: "convinci-tu", config: { difficulty: "hard" } }).config.difficulty).toBe("hard");
    expect(draftBody({ ...draftOf(), appType: "wiki-chatbot", config: { difficulty: "hard" } }).config.difficulty).toBeUndefined();
  });
});
