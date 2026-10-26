import type { TFunction } from "i18next";
import type { AppType } from "@/lib/api";
import type { SpriteId } from "./sprites";

// The student tutorials as data: the same six slides for every app, told by
// a different pixel-art guide. Texts are in the "studentTutorial" namespace.

export type SlideKind = "mission" | "task" | "path" | "progress" | "grading" | "tips";
export const SLIDE_KINDS: SlideKind[] = ["mission", "task", "path", "progress", "grading", "tips"];

export type SceneId = "camp" | "observatory" | "mystery" | "workshop" | "stage" | "library";

export interface StudentTutorial {
  /** Key of the app in the "studentTutorial" translations. */
  ns: string;
  scene: SceneId;
  /** The guides on screen, left to right; the first one narrates unless `narrators` says otherwise. */
  guides: SpriteId[];
  narrators?: Partial<Record<SlideKind, number>>;
  /** The first guide turns into this character on the last slide (the mystery is revealed). */
  finale?: SpriteId;
}

export const STUDENT_TUTORIALS: Record<AppType, StudentTutorial> = {
  "convinci-tu": { ns: "convinciTu", scene: "camp", guides: ["napoleon"] },
  "doppia-intervista": { ns: "doppiaIntervista", scene: "observatory", guides: ["galileo", "aristotle"], narrators: { tips: 1 } },
  "personaggio-misterioso": { ns: "personaggioMisterioso", scene: "mystery", guides: ["shadow"], finale: "cleopatra" },
  "impersona-tu": { ns: "impersonaTu", scene: "workshop", guides: ["leonardo"] },
  "you-moderate": { ns: "youModerate", scene: "stage", guides: ["curie", "student", "einstein"], narrators: { tips: 2 } },
  "wiki-chatbot": { ns: "wikiChatbot", scene: "library", guides: ["ada", "colosseum"], narrators: { task: 1 } },
};

/** How each guide sounds: pitch and rate for the browser voice, macOS voice for the video export. */
export const VOICES: Record<SpriteId, { pitch: number; rate: number; mac: string }> = {
  napoleon: { pitch: 0.8, rate: 1.05, mac: "Rocko" },
  galileo: { pitch: 0.9, rate: 1, mac: "Reed" },
  aristotle: { pitch: 0.7, rate: 0.95, mac: "Grandpa" },
  shadow: { pitch: 0.5, rate: 0.95, mac: "Eddy" },
  cleopatra: { pitch: 1.2, rate: 1, mac: "Shelley" },
  leonardo: { pitch: 0.7, rate: 0.95, mac: "Grandpa" },
  curie: { pitch: 1.1, rate: 1, mac: "Alice" },
  einstein: { pitch: 0.95, rate: 1, mac: "Reed" },
  ada: { pitch: 1.15, rate: 1, mac: "Alice" },
  colosseum: { pitch: 0.6, rate: 0.9, mac: "Rocko" },
  student: { pitch: 1.2, rate: 1.05, mac: "Sandy" },
};

export interface SlideContent {
  kind: SlideKind;
  title: string;
  voice: string;
  /** Who is talking (shown next to the subtitles). */
  speaker: SpriteId;
  /** The lines shown on the monitor (steps, tips, levels...). */
  lines: string[];
  /** App-specific details of the shared slides. */
  extra?: string;
  goal?: string;
  plus?: string[];
  reflection?: string;
}

const list = (ts: TFunction, key: string): string[] => {
  const v = ts(key, { returnObjects: true, defaultValue: [] });
  return Array.isArray(v) ? v.map(String) : [];
};

/** The six slides of an app; `ts` translates in the "studentTutorial" namespace. */
export const resolveSlides = (tutorial: StudentTutorial, ts: TFunction): SlideContent[] => {
  const { ns, guides, narrators = {}, finale } = tutorial;
  const speaker = (kind: SlideKind) => (kind === "tips" && finale ? finale : guides[narrators[kind] ?? 0]);
  const reflection = ts(`${ns}.grading.reflection`);
  return [
    { kind: "mission", title: ts(`${ns}.mission.title`), lines: list(ts, `${ns}.mission.lines`), voice: ts(`${ns}.mission.voice`), speaker: speaker("mission") },
    { kind: "task", title: ts("common.taskTitle"), lines: list(ts, `${ns}.task.lines`), voice: ts(`${ns}.task.voice`), speaker: speaker("task") },
    {
      kind: "path",
      title: ts("common.path.title"),
      lines: list(ts, "common.path.levels"),
      extra: ts(`${ns}.path.extra`),
      voice: `${ts("common.path.voice")} ${ts(`${ns}.path.extra`)}`,
      speaker: speaker("path"),
    },
    {
      kind: "progress",
      title: ts("common.progress.title"),
      lines: list(ts, "common.progress.lines"),
      goal: ts(`${ns}.progress.goal`),
      voice: ts("common.progress.voice"),
      speaker: speaker("progress"),
    },
    {
      kind: "grading",
      title: ts("common.grading.title"),
      lines: [],
      plus: list(ts, `${ns}.grading.plus`),
      reflection,
      voice: `${ts("common.grading.voice")} ${ts("common.grading.reflectionVoice")} ${reflection}`,
      speaker: speaker("grading"),
    },
    { kind: "tips", title: ts("common.tipsTitle"), lines: list(ts, `${ns}.tips.lines`), voice: ts(`${ns}.tips.voice`), speaker: speaker("tips") },
  ];
};

/** How many items appear one after the other on each slide (each gets a blip). */
export const revealCount = (slide: SlideContent): number => {
  switch (slide.kind) {
    case "path":
      return slide.lines.length + 1;
    case "progress":
      return 3;
    case "grading":
      return 2 + (slide.plus?.length ?? 0) + 1;
    case "tips":
      return slide.lines.length + 1;
    default:
      return slide.lines.length;
  }
};
