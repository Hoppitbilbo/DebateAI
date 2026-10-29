import type { AssignmentConfig, WikiRef } from "@/lib/api";

// Several mystery characters in one assignment: each student plays them in
// turn. With shuffle on, every student gets their own order, the same each
// time they come back, so neighbours in the lab never share the same
// character at the same moment.

/** The mystery characters fixed by the teacher, one or more. */
export const mysteryCharacters = (config: AssignmentConfig): WikiRef[] =>
  config.characters?.length ? config.characters : config.character ? [config.character] : [];

/** A small deterministic hash of a string (FNV-1a). */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/** A seeded pseudo-random generator (mulberry32). */
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The characters in the order this student plays them. */
export const characterOrder = <T>(list: readonly T[], shuffle: boolean, seed: string): T[] => {
  const out = [...list];
  if (!shuffle) return out;
  const next = random(hash(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** How many characters of an assignment this browser has already played. */
const roundKey = (assignmentId: number, userId: number) => `debateai-mystery-round:${assignmentId}:${userId}`;

export const mysteryRounds = {
  get(assignmentId: number, userId: number): number {
    try {
      return Number(localStorage.getItem(roundKey(assignmentId, userId))) || 0;
    } catch {
      return 0;
    }
  },
  set(assignmentId: number, userId: number, round: number) {
    try {
      localStorage.setItem(roundKey(assignmentId, userId), String(round));
    } catch {
      /* private mode: the student starts again from the first character */
    }
  },
};
