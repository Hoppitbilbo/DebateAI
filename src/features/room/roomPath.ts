import type { AppType, AssignmentConfig } from "@/lib/api";
import { AssignmentDraft, draftBody, draftOf } from "@/features/teacher/assignmentDraft";
import { mysteryCharacters } from "@/features/activity/characterOrder";
import { newId } from "@/features/activity/types";
import type { Suggestion } from "./suggestions";

// The path of a room: the activities a teacher prepares in /aula/nuova, in
// the order the students meet them. Pure helpers, used by the wizard.

/** As on the server (domain.MaxRoomActivities). */
export const MAX_PATH_STEPS = 6;

export interface PathStep {
  key: string;
  draft: AssignmentDraft;
}

/** A new step of the path: guests never get the live voice. */
export const newStep = (appType: AppType, config: AssignmentConfig = {}, extra: Partial<AssignmentDraft> = {}): PathStep => ({
  key: newId(),
  draft: { ...draftOf(), appType, config, allowLive: false, ...extra },
});

/** A suggestion turned into a step; its reason becomes the students' instructions. */
export const stepFromSuggestion = (s: Suggestion): PathStep => newStep(s.appType, s.config, { title: s.title, instructions: s.why });

/** The Wikipedia pages a step is about, the main one first. */
export const pagesOf = ({ appType, config }: AssignmentDraft): string[] => {
  const refs = appType === "personaggio-misterioso"
    ? mysteryCharacters(config)
    : [config.character, config.aiCharacter, config.userCharacter, ...(config.characters ?? [])];
  return [...new Set(refs.filter(Boolean).map((r) => r!.title))];
};

/** A title made of the characters, when the teacher wrote none ("Einstein · Bohr"). */
export const autoTitle = (d: AssignmentDraft, appName: string, mysteryName: string) => {
  if (d.title.trim()) return d.title.trim();
  // A mystery title must never reveal the character.
  if (d.appType === "personaggio-misterioso") return mysteryName;
  const pages = pagesOf(d);
  return pages.length ? `${appName}: ${pages.slice(0, 2).join(" · ")}` : appName;
};

/** The room request for the whole path, every step in the room's language. */
export const pathBody = (steps: PathStep[], language: string, titleOf: (d: AssignmentDraft) => string) =>
  steps.slice(0, MAX_PATH_STEPS).map(({ draft }) => draftBody({ ...draft, title: titleOf(draft), config: { ...draft.config, language } }));

/** Steps the same as a suggestion are not suggested again. */
export const sameActivity = (step: PathStep, s: Suggestion) =>
  step.draft.appType === s.appType && pagesOf(step.draft).join("|") === pagesOf({ ...step.draft, appType: s.appType, config: s.config }).join("|");
