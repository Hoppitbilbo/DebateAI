export type Speaker = "student" | "galileo";

/** One line of the demo conversation: who speaks, its copy key (`hero.story.messages`) and the step it explains. */
export interface ScriptLine {
  speaker: Speaker;
  key: string;
  step: number;
}

export const SCRIPT: readonly ScriptLine[] = [
  { speaker: "student", key: "s1", step: 1 },
  { speaker: "galileo", key: "g1", step: 1 },
  { speaker: "student", key: "s2", step: 2 },
  { speaker: "galileo", key: "g2", step: 2 },
  { speaker: "student", key: "s3", step: 3 },
  { speaker: "galileo", key: "g3", step: 3 },
  { speaker: "student", key: "s4", step: 4 },
  { speaker: "galileo", key: "g4", step: 4 },
];

export const STEPS = [1, 2, 3, 4] as const;

/** Share of a line's scroll slot after which the next speaker starts "typing". */
const TYPING_FROM = 0.45;

/** What the chat shows at `position` lines (the decimal part is the next line being typed). */
export const storyState = (position: number, script: readonly ScriptLine[] = SCRIPT) => {
  const shown = Math.floor(position);
  const next = script[shown] as ScriptLine | undefined;
  return {
    lines: script.slice(0, shown),
    /** The line being typed, if any. */
    typing: next && position - shown > TYPING_FROM ? next : null,
    activeStep: script[Math.max(0, shown - 1)]?.step ?? 1,
    done: shown >= script.length,
  };
};
