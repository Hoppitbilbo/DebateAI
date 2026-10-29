import type { AppType, Assignment, AssignmentConfig } from "@/lib/api";
import { reconcileLimits } from "./assignmentLimits";

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

/** A draft from an existing assignment, or a new one with the defaults. */
export const draftOf = (a?: Assignment | null): AssignmentDraft => ({
  title: a?.title ?? "",
  appType: a?.appType ?? "wiki-chatbot",
  instructions: a?.instructions ?? "",
  goals: a?.goals.length ? a.goals : [""],
  config: a?.config ?? {},
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
 * The mystery game's hints without the empty ones. They describe the
 * character the teacher fixed, so without one (and for other apps) none.
 */
const cleanHints = (d: AssignmentDraft) => {
  const hints = d.appType === "personaggio-misterioso" && d.config.character ? d.config.hints?.map((h) => h.trim()).filter(Boolean) : undefined;
  return hints?.length ? hints : undefined;
};

/** What the server receives: empty goals dropped, a pair only when complete, consistent limits. */
export const draftBody = (d: AssignmentDraft) => {
  const limits = draftLimits(d);
  const pair = d.config.characters?.filter(Boolean);
  return {
    title: d.title,
    appType: d.appType,
    instructions: d.instructions,
    goals: d.goals.map((g) => g.trim()).filter(Boolean),
    config: { ...d.config, characters: pair && pair.length === 2 ? pair : undefined, questions: limits.questions, hints: cleanHints(d) },
    minTurns: limits.minTurns,
    maxTurns: limits.maxTurns,
    autoEnd: d.autoEnd,
    requireReflection: d.requireReflection,
    allowLive: d.allowLive,
  };
};
