import type { AppType } from "@/lib/api";
import { QUESTIONS } from "@/features/activity/mystery";

/** Bounds of the student-message limits a teacher can set. */
export const TURN_BOUNDS = { minTurns: 100, maxTurns: 200 } as const;

export interface LimitSettings {
  appType: AppType;
  minTurns: number;
  maxTurns: number;
  /** Questions of the mystery game, when the teacher fixed them. */
  questions?: number;
}

/** A change made to keep the settings consistent, with its i18n key and values. */
export interface LimitNote {
  key: "questionsClamped" | "maxTurnsFromQuestions" | "minTurnsLowered";
  values: Record<string, number>;
}

const toCount = (v: number, max: number, min = 0) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v) ? v : 0)));

/**
 * Adapts the limits of an assignment so that they cannot contradict each
 * other and stop the activity before it should end:
 * - in the mystery game every question is a student message, so the number
 *   of questions is also the turn limit;
 * - the minimum of messages is never above the maximum.
 */
export const reconcileLimits = ({ appType, minTurns, maxTurns, questions }: LimitSettings) => {
  const notes: LimitNote[] = [];
  let min = toCount(minTurns, TURN_BOUNDS.minTurns);
  let max = toCount(maxTurns, TURN_BOUNDS.maxTurns);
  let q = questions;

  if (appType === "personaggio-misterioso" && questions !== undefined) {
    q = toCount(questions, QUESTIONS.max, QUESTIONS.min);
    if (q !== questions) notes.push({ key: "questionsClamped", values: { min: QUESTIONS.min, max: QUESTIONS.max, count: q } });
    if (max > 0 && max !== q) notes.push({ key: "maxTurnsFromQuestions", values: { from: max, count: q } });
    max = q;
  }
  if (max > 0 && min > max) {
    notes.push({ key: "minTurnsLowered", values: { from: min, count: max } });
    min = max;
  }
  return { minTurns: min, maxTurns: max, questions: q, notes };
};
