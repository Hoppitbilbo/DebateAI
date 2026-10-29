import type { AppType, Assignment, AssignmentConfig } from "@/lib/api";
import { hasDifficulty } from "@/features/activity/difficulty";
import { mysteryCharacters } from "@/features/activity/characterOrder";
import { reconcileLimits } from "./assignmentLimits";

/** Mystery characters a teacher can list in one assignment. */
export const MAX_MYSTERY_CHARACTERS = 8;

const MYSTERY: AppType = "personaggio-misterioso";
const PAIR_APPS: ReadonlySet<AppType> = new Set(["doppia-intervista", "you-moderate"]);

// What a teacher fills in to set an activity: shared by the assignments of a
// class and by the assignment a temporary room creates for itself.

export interface AssignmentDraft {
  title: string;
  appType: AppType;
  instructions: string;
  goals: string[];
  /** Choices fixed for the students (characters, topic, questions). */
  config: AssignmentConfig;
  minTurns: number;
  maxTurns: number;
  autoEnd: boolean;
  requireReflection: boolean;
  allowLive: boolean;
}

/**
 * While editing, the mystery game keeps its characters as a list, also when
 * the assignment was saved with a single `character`.
 */
const editableConfig = (a?: Assignment | null): AssignmentConfig => {
  const config = a?.config ?? {};
  if (a?.appType !== MYSTERY) return config;
  const list = mysteryCharacters(config);
  return { ...config, character: undefined, characters: list.length ? list : undefined };
};

/** A draft from an existing assignment, or a new one with the defaults. */
export const draftOf = (a?: Assignment | null): AssignmentDraft => ({
  title: a?.title ?? "",
  appType: a?.appType ?? "wiki-chatbot",
  instructions: a?.instructions ?? "",
  goals: a?.goals.length ? a.goals : [""],
  config: editableConfig(a),
  minTurns: a?.minTurns ?? 0,
  maxTurns: a?.maxTurns ?? 0,
  autoEnd: a?.autoEnd ?? true,
  requireReflection: a?.requireReflection ?? true,
  allowLive: a?.allowLive ?? true,
});

/** The limits as they will be saved, with the notes on what was adapted. */
export const draftLimits = (d: AssignmentDraft) =>
  reconcileLimits({ appType: d.appType, minTurns: d.minTurns, maxTurns: d.maxTurns, questions: d.appType === "personaggio-misterioso" ? d.config.questions : undefined });

/**
 * The mystery game's hints without the empty ones. They describe the one
 * character the teacher fixed, so with none, several (and for other apps) none.
 */
const cleanHints = (d: AssignmentDraft, mysteryList: number) => {
  const hints = d.appType === MYSTERY && mysteryList === 1 ? d.config.hints?.map((h) => h.trim()).filter(Boolean) : undefined;
  return hints?.length ? hints : undefined;
};

/**
 * The characters as saved: a pair only when complete; for the mystery game
 * one `character`, or a list of them with the shuffle option.
 */
const savedCharacters = (d: AssignmentDraft): Pick<AssignmentConfig, "character" | "characters" | "shuffle"> => {
  const list = d.config.characters?.filter(Boolean) ?? [];
  if (d.appType === MYSTERY) {
    if (list.length > 1) return { character: undefined, characters: list.slice(0, MAX_MYSTERY_CHARACTERS), shuffle: d.config.shuffle !== false };
    return { character: list[0] ?? d.config.character, characters: undefined, shuffle: undefined };
  }
  return { characters: PAIR_APPS.has(d.appType) && list.length === 2 ? list : undefined, shuffle: undefined };
};

/** What the server receives: empty goals dropped, a pair only when complete, consistent limits. */
export const draftBody = (d: AssignmentDraft) => {
  const limits = draftLimits(d);
  const characters = savedCharacters(d);
  const mysteryList = characters.characters?.length ?? (characters.character ? 1 : 0);
  return {
    title: d.title,
    appType: d.appType,
    instructions: d.instructions,
    goals: d.goals.map((g) => g.trim()).filter(Boolean),
    config: {
      ...d.config,
      ...characters,
      questions: limits.questions,
      hints: cleanHints(d, mysteryList),
      difficulty: hasDifficulty(d.appType) ? d.config.difficulty : undefined,
    },
    minTurns: limits.minTurns,
    maxTurns: limits.maxTurns,
    autoEnd: d.autoEnd,
    requireReflection: d.requireReflection,
    allowLive: d.allowLive,
  };
};
