// The clock of a student tutorial, as pure functions of time so the same
// frame can be drawn live in the app and frame by frame for the video export.

/** Length of the horizontal morph that opens every slide. */
export const MORPH_S = 0.9;
/** When the narrator starts talking, from the start of the slide. */
export const VOICE_START_S = 0.6;
const TAIL_S = 0.9;
const FIRST_REVEAL_S = MORPH_S + 0.2;
const MIN_REVEAL_GAP_S = 0.5;
const MAX_REVEAL_GAP_S = 2.2;
/** Share of the narration over which the slide's items appear. */
const REVEAL_SPREAD = 0.75;
const HOLD_AFTER_LAST_REVEAL_S = 1.5;
/** Average speed of the Italian synthetic voice, used when the real length is unknown. */
const CHARS_PER_SECOND = 14;

export interface SlideTiming {
  /** Start of the slide on the whole tutorial's clock. */
  start: number;
  duration: number;
  /** Length of the narration. */
  voice: number;
  /** When each item of the slide appears, from the start of the slide. */
  reveals: number[];
}

export const estimateVoiceSeconds = (text: string) => text.length / CHARS_PER_SECOND + 0.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const buildTimeline = (voiceSeconds: number[], revealCounts: number[]): SlideTiming[] => {
  let start = 0;
  return voiceSeconds.map((voice, i) => {
    const n = revealCounts[i] ?? 0;
    const gap = n ? clamp((voice * REVEAL_SPREAD) / n, MIN_REVEAL_GAP_S, MAX_REVEAL_GAP_S) : 0;
    const reveals = Array.from({ length: n }, (_, k) => FIRST_REVEAL_S + k * gap);
    const lastReveal = reveals.length ? reveals[reveals.length - 1] : 0;
    const duration = Math.max(VOICE_START_S + voice + TAIL_S, lastReveal + HOLD_AFTER_LAST_REVEAL_S);
    const timing = { start, duration, voice, reveals };
    start += duration;
    return timing;
  });
};

export const totalSeconds = (timeline: SlideTiming[]) => {
  const last = timeline[timeline.length - 1];
  return last ? last.start + last.duration : 0;
};

/** Which slide is on screen at time t of the whole tutorial, and how far into it. */
export const locate = (timeline: SlideTiming[], t: number): { index: number; t: number } => {
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (t >= timeline[i].start) return { index: i, t: t - timeline[i].start };
  }
  return { index: 0, t: 0 };
};

/** 0 before the item appears, 1 once its short entrance is over. */
export const revealProgress = (timing: SlideTiming, item: number, t: number, entrance = 0.35) => {
  const at = timing.reveals[item];
  return at === undefined ? 1 : clamp((t - at) / entrance, 0, 1);
};

/** How far the narration is, from 0 to 1. */
export const voiceProgress = (timing: SlideTiming, t: number) => (timing.voice ? clamp((t - VOICE_START_S) / timing.voice, 0, 1) : 1);

export const isTalking = (timing: SlideTiming, t: number) => t >= VOICE_START_S && t < VOICE_START_S + timing.voice;

/** Smooth start and stop, used by the morph. */
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export const morphProgress = (t: number) => easeInOut(clamp(t / MORPH_S, 0, 1));

export type SfxKind = "whoosh" | "blip" | "jingle";

export interface SfxEvent {
  t: number;
  kind: SfxKind;
}

/** Sound effects of the whole tutorial: a whoosh on each morph, a blip per item, a jingle on the final START. */
export const sfxEvents = (timeline: SlideTiming[]): SfxEvent[] =>
  timeline.flatMap((s, i) => {
    const events: SfxEvent[] = i > 0 ? [{ t: s.start, kind: "whoosh" }] : [];
    s.reveals.forEach((r, k) => {
      const last = i === timeline.length - 1 && k === s.reveals.length - 1;
      events.push({ t: s.start + r, kind: last ? "jingle" : "blip" });
    });
    return events;
  });

/**
 * The sentence being spoken at a given point of the narration (0..1), so the
 * subtitles show one short sentence at a time. Sentences get time in
 * proportion to their length.
 */
export const subtitleAt = (text: string, progress: number): string => {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
  const total = sentences.reduce((n, s) => n + s.length, 0);
  let acc = 0;
  for (const s of sentences) {
    acc += s.length;
    if (progress * total < acc) return s;
  }
  return sentences[sentences.length - 1] ?? "";
};
