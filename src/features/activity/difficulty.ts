import type { AppType } from "@/lib/api";

// How hard the character makes it for the student. The teacher may fix it
// in an assignment; otherwise the student picks it before starting.

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DEFAULT_DIFFICULTY: Difficulty = "medium";

/** The apps with a difficulty setting. */
export const DIFFICULTY_APPS: ReadonlySet<AppType> = new Set(["personaggio-misterioso", "convinci-tu", "impersona-tu"]);

export const hasDifficulty = (app: AppType) => DIFFICULTY_APPS.has(app);

export const isDifficulty = (v: unknown): v is Difficulty => DIFFICULTIES.includes(v as Difficulty);

/** The difficulty in force: the teacher's, the student's choice, or the default. */
export const difficultyOf = (fixed: unknown, chosen?: Difficulty): Difficulty =>
  isDifficulty(fixed) ? fixed : chosen ?? DEFAULT_DIFFICULTY;

// What each level asks of the character is written by the server
// (server/internal/app/prompts.go, difficultyRules).
