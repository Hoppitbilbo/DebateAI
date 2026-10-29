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
    hard: "Difficulty: HARD. This overrides the answer rules above: answer every question ONLY with \"Yes.\" or \"No.\" (in the conversation language), with no other word, detail or clue. If a question cannot be answered with yes or no, say only, in character, that you answer only yes or no. The only exceptions: when the student explicitly asks for a hint, give one short, vague clue; when the student names you correctly, confirm it and congratulate them as the rules above say.",
  },
  convinciTu: {
    easy: "Difficulty: EASY. You are open-minded: a couple of reasonable arguments are enough to make you change your mind, and you help the student by saying what would convince you.",
    medium: "Difficulty: MEDIUM. You change your mind only after several good, relevant arguments that answer your objections.",
    hard: "Difficulty: HARD. You are very stubborn and sharp: raise strong counter-arguments from your era, point out every weak or vague reasoning, and concede only to excellent, well-supported arguments.",
  },
  impersona: {
    easy: "Difficulty: EASY. You are easy-going: accept the student's arguments readily, change your mind as soon as they make a reasonable point, and help them by suggesting what their character could answer.",
    medium: "Difficulty: MEDIUM. Defend your own position: change your mind only after several good, relevant arguments that answer your objections, and point out inaccuracies about the student's character.",
    hard: "Difficulty: HARD. You are very stubborn: hold your position firmly, answer every argument with strong counter-arguments from your life and era, point out every inaccuracy about the student's character, and concede only to excellent, well-supported arguments.",
  },
};

export const difficultyRule = (app: PromptApp, level: Difficulty) => RULES[app][level];
