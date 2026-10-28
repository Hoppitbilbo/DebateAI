import type { TourId } from "./tours";

/** What a user decided about the guided tours, kept per account in this browser. */
export interface TourPrefs {
  /** The user turned the automatic tours off. */
  disabled: boolean;
  /** Tours already finished or skipped: they do not start by themselves again. */
  seen: TourId[];
}

export const DEFAULT_TOUR_PREFS: TourPrefs = { disabled: false, seen: [] };

const keyFor = (userId: number) => `debateai.tour.${userId}`;

export const loadTourPrefs = (userId: number): TourPrefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(keyFor(userId)) ?? "null") as Partial<TourPrefs> | null;
    if (!raw) return DEFAULT_TOUR_PREFS;
    return { disabled: raw.disabled === true, seen: Array.isArray(raw.seen) ? raw.seen : [] };
  } catch {
    return DEFAULT_TOUR_PREFS; // storage blocked or corrupted: behave as a first visit
  }
};

export const saveTourPrefs = (userId: number, prefs: TourPrefs) => {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(prefs));
  } catch {
    // storage blocked (private window): the tour may simply show again next time
  }
};

export const shouldAutoStart = (prefs: TourPrefs, tour: TourId) => !prefs.disabled && !prefs.seen.includes(tour);

/** Prefs after the user closed `tour`, optionally asking never to see tours again. */
export const closeTour = (prefs: TourPrefs, tour: TourId, dontShowAgain: boolean): TourPrefs => ({
  disabled: prefs.disabled || dontShowAgain,
  seen: prefs.seen.includes(tour) ? prefs.seen : [...prefs.seen, tour],
});
