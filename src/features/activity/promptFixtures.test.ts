import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AppType, Assignment, AssignmentConfig } from "@/lib/api";
import type { Difficulty } from "./difficulty";
import { openings, prompts } from "./prompts";

// Parity fixtures for the server prompts (docs/audits/2026-10-29/PLAN_SERVER_PROMPTS.md).
// Each case is a recipe, as the browser will send it, with the prompt and
// opening cue that prompts.ts writes for it today. The Go port
// (server/internal/app/prompts.go) must write the same text.
// Regenerate with: UPDATE_PROMPT_FIXTURES=1 npx vitest run src/features/activity/promptFixtures.test.ts

const ui = vi.hoisted(() => ({ language: "it" }));
vi.mock("@/i18n", () => ({ default: ui }));

const FIXTURE = join(__dirname, "../../../server/internal/app/testdata/prompts.json");

interface Recipe {
  app: AppType;
  kind: "reply" | "opening";
  character: string;
  bio: string;
  other: string;
  userCharacter: string;
  userBio: string;
  topic: string;
  difficulty: Difficulty;
  style: "" | "a" | "b";
  questions: number;
  uiLang: string;
}

type FixtureAssignment = Pick<Assignment, "title" | "instructions" | "config">;

interface Case {
  name: string;
  recipe: Recipe;
  assignment: FixtureAssignment | null;
  system: string;
  opening: string | null;
}

/** The English style words the server uses for the moderated debate. */
const STYLE = { a: "erudite and assertive", b: "reflective and questioning" } as const;

const recipe = (app: AppType, fields: Partial<Recipe>): Recipe => ({
  app,
  kind: "reply",
  character: "",
  bio: "",
  other: "",
  userCharacter: "",
  userBio: "",
  topic: "",
  difficulty: "medium",
  style: "",
  questions: 0,
  uiLang: "it",
  ...fields,
});

const assignment = (config: AssignmentConfig, instructions = "Prepare three questions before you start."): FixtureAssignment => ({
  title: "The French Revolution",
  instructions,
  config,
});

/** What prompts.ts writes for a recipe: the mapping each page does today. */
const expected = (r: Recipe, a: FixtureAssignment | null) => {
  ui.language = r.uiLang;
  const as = a as Assignment | null;
  switch (r.app) {
    case "convinci-tu":
      return { system: prompts.convinciTu(r.character, r.bio, r.topic, as, r.difficulty), opening: openings.convinciTu(r.topic) };
    case "wiki-chatbot":
      return { system: prompts.wikiChat(r.character, r.bio, as), opening: openings.wikiChat() };
    case "doppia-intervista":
      return { system: prompts.interview(r.character, r.bio, r.other, as), opening: openings.interview(r.other) };
    case "personaggio-misterioso":
      return { system: prompts.mystery(r.character, r.bio, as, r.difficulty), opening: openings.mystery(r.questions) };
    case "impersona-tu":
      return {
        system: prompts.impersona(r.character, r.bio, r.userCharacter, r.userBio, r.topic, as, r.difficulty),
        opening: openings.impersona(r.userCharacter, r.topic),
      };
    case "you-moderate":
      return {
        system: prompts.moderated(r.character, r.bio, r.other, r.topic, STYLE[r.style || "a"], as),
        opening: openings.moderated(r.topic, r.other),
      };
  }
};

const NAPOLEON = "Napoleone Bonaparte";
const NAPOLEON_BIO = "Napoleone Bonaparte (Ajaccio, 15 agosto 1769 – Longwood, 5 maggio 1821) è stato un politico e militare francese.\nFondatore del Primo Impero francese.";
const CAESAR = "Gaio Giulio Cesare";
const CAESAR_BIO = "Gaio Giulio Cesare è stato un militare, politico e scrittore romano, considerato uno dei personaggi più importanti della storia.";
const LONG_BIO = "Marie Curie was a Polish and naturalised-French physicist and chemist who conducted pioneering research on radioactivity. ".repeat(8);

const inputs: { name: string; recipe: Recipe; assignment: FixtureAssignment | null }[] = [
  // convinci-tu
  { name: "convinci-tu free", recipe: recipe("convinci-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, topic: "Democracy is the best form of government" }), assignment: null },
  { name: "convinci-tu easy", recipe: recipe("convinci-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, topic: "Peace", difficulty: "easy" }), assignment: null },
  { name: "convinci-tu hard, no bio", recipe: recipe("convinci-tu", { character: NAPOLEON, topic: "Peace", difficulty: "hard" }), assignment: null },
  {
    name: "convinci-tu assignment",
    recipe: recipe("convinci-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, topic: "Peace", difficulty: "hard" }),
    assignment: assignment({ character: { title: NAPOLEON }, topic: "Peace", difficulty: "hard" }),
  },
  // wiki-chatbot
  { name: "wiki-chatbot free", recipe: recipe("wiki-chatbot", { character: "Colosseo", bio: "Il Colosseo è un anfiteatro di Roma." }), assignment: null },
  { name: "wiki-chatbot English UI", recipe: recipe("wiki-chatbot", { character: "Colosseum", bio: "", uiLang: "en" }), assignment: null },
  {
    name: "wiki-chatbot assignment without instructions",
    recipe: recipe("wiki-chatbot", { character: "Colosseo", bio: "Il Colosseo è un anfiteatro di Roma." }),
    assignment: assignment({ character: { title: "Colosseo" } }, ""),
  },
  // doppia-intervista
  { name: "doppia-intervista free", recipe: recipe("doppia-intervista", { character: NAPOLEON, bio: NAPOLEON_BIO, other: CAESAR }), assignment: null },
  {
    name: "doppia-intervista assignment, second speaker",
    recipe: recipe("doppia-intervista", { character: CAESAR, bio: CAESAR_BIO, other: NAPOLEON }),
    assignment: assignment({ characters: [{ title: NAPOLEON }, { title: CAESAR }] }),
  },
  // personaggio-misterioso
  { name: "mystery free", recipe: recipe("personaggio-misterioso", { character: CAESAR, bio: CAESAR_BIO, questions: 10 }), assignment: null },
  { name: "mystery easy", recipe: recipe("personaggio-misterioso", { character: CAESAR, bio: CAESAR_BIO, questions: 10, difficulty: "easy" }), assignment: null },
  {
    name: "mystery hard assignment",
    recipe: recipe("personaggio-misterioso", { character: CAESAR, bio: CAESAR_BIO, questions: 7, difficulty: "hard" }),
    assignment: assignment({ characters: [{ title: NAPOLEON }, { title: CAESAR }], questions: 7, difficulty: "hard" }),
  },
  // impersona-tu
  {
    name: "impersona-tu free",
    recipe: recipe("impersona-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, userCharacter: CAESAR, userBio: CAESAR_BIO, topic: "Power" }),
    assignment: null,
  },
  {
    name: "impersona-tu long user bio, no AI bio, easy",
    recipe: recipe("impersona-tu", { character: NAPOLEON, userCharacter: "Marie Curie", userBio: LONG_BIO, topic: "Science", difficulty: "easy" }),
    assignment: null,
  },
  {
    name: "impersona-tu assignment, no user bio, hard",
    recipe: recipe("impersona-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, userCharacter: CAESAR, topic: "Power", difficulty: "hard" }),
    assignment: assignment({ aiCharacter: { title: NAPOLEON }, userCharacter: { title: CAESAR }, topic: "Power", difficulty: "hard" }),
  },
  // you-moderate
  {
    name: "you-moderate style a",
    recipe: recipe("you-moderate", { character: NAPOLEON, bio: NAPOLEON_BIO, other: CAESAR, topic: "War and glory", style: "a" }),
    assignment: null,
  },
  {
    name: "you-moderate style b, assignment",
    recipe: recipe("you-moderate", { character: CAESAR, bio: CAESAR_BIO, other: NAPOLEON, topic: "War and glory", style: "b" }),
    assignment: assignment({ characters: [{ title: NAPOLEON }, { title: CAESAR }], topic: "War and glory" }),
  },
  // language
  {
    name: "foreign language practice",
    recipe: recipe("convinci-tu", { character: NAPOLEON, bio: NAPOLEON_BIO, topic: "Peace" }),
    assignment: assignment({ character: { title: NAPOLEON }, language: "fr" }),
  },
  {
    name: "assignment language equal to the interface",
    recipe: recipe("wiki-chatbot", { character: "Colosseum", uiLang: "en" }),
    assignment: assignment({ language: "en" }),
  },
  {
    name: "Latin practice",
    recipe: recipe("personaggio-misterioso", { character: CAESAR, bio: CAESAR_BIO, questions: 10, uiLang: "de" }),
    assignment: assignment({ language: "la" }),
  },
  // openings
  {
    name: "mystery opening",
    recipe: recipe("personaggio-misterioso", { kind: "opening", character: CAESAR, bio: CAESAR_BIO, questions: 7 }),
    assignment: null,
  },
];

const OPENING_APPS: AppType[] = ["convinci-tu", "wiki-chatbot", "doppia-intervista", "impersona-tu", "you-moderate"];

const build = (): Case[] => {
  const cases = inputs.map(({ name, recipe: r, assignment: a }) => {
    const { system, opening } = expected(r, a);
    return { name, recipe: r, assignment: a, system, opening: r.kind === "opening" ? opening : null };
  });
  // One opening per app, from the first case of that app.
  for (const app of OPENING_APPS) {
    const first = cases.find((c) => c.recipe.app === app)!;
    const r = { ...first.recipe, kind: "opening" as const };
    const { system, opening } = expected(r, first.assignment);
    cases.push({ name: `${app} opening`, recipe: r, assignment: first.assignment, system, opening });
  }
  ui.language = "it";
  return cases;
};

describe("server prompt fixtures", () => {
  it("match what prompts.ts writes", () => {
    const cases = build();
    const json = JSON.stringify(cases, null, 2) + "\n";
    if (process.env.UPDATE_PROMPT_FIXTURES === "1") {
      if (!existsSync(dirname(FIXTURE))) mkdirSync(dirname(FIXTURE), { recursive: true });
      writeFileSync(FIXTURE, json);
    }
    expect(JSON.parse(readFileSync(FIXTURE, "utf8"))).toEqual(cases);
  });
});
