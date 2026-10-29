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

type PromptApp = "mystery" | "convinciTu" | "impersona";

/** What each level asks of the character, appended to the app's system prompt. */
const RULES: Record<PromptApp, Record<Difficulty, string>> = {
  mystery: {
    easy: "Difficulty: EASY. Give generous clues: mention your era, country and field clearly, and describe your best-known achievements in recognisable terms (still never your name).",
    medium: "Difficulty: MEDIUM. Give fair clues: era and field may be guessed from your answers, but describe your achievements indirectly.",
    hard: "Difficulty: HARD. Be cryptic: answer truthfully but with the least revealing details, prefer lesser-known facts of your life, avoid naming places, dates or works that point straight to you.",
  },
  convinciTu: {
    easy: "Difficulty: EASY. You are open-minded: a couple of reasonable arguments are enough to make you change your mind, and you help the student by saying what would convince you.",
    medium: "Difficulty: MEDIUM. You change your mind only after several good, relevant arguments that answer your objections.",
    hard: "Difficulty: HARD. You are very stubborn and sharp: raise strong counter-arguments from your era, point out every weak or vague reasoning, and concede only to excellent, well-supported arguments.",
  },
  impersona: {
    easy: "Difficulty: EASY. Be friendly and patient: ask simple questions about the best-known facts of the student's character and gently suggest corrections.",
    medium: "Difficulty: MEDIUM. Ask questions about the life, ideas and context of the student's character and point out inaccuracies.",
    hard: "Difficulty: HARD. Be demanding: ask precise questions on lesser-known details, dates and ideas of the student's character, challenge every inaccuracy and contradiction.",
  },
};

export const difficultyRule = (app: PromptApp, level: Difficulty) => RULES[app][level];
