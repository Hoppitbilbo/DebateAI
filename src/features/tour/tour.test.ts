import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { placeCard } from "./placement";
import { closeTour, DEFAULT_TOUR_PREFS, loadTourPrefs, saveTourPrefs, shouldAutoStart } from "./tourPrefs";
import { stepKeys, TOUR_IDS, TOURS } from "./tours";

describe("tour prefs", () => {
  afterEach(() => localStorage.clear());

  it("starts each tour once, and never after the user turns tours off", () => {
    let prefs = DEFAULT_TOUR_PREFS;
    expect(shouldAutoStart(prefs, "teacher")).toBe(true);
    prefs = closeTour(prefs, "teacher", false);
    expect(shouldAutoStart(prefs, "teacher")).toBe(false);
    expect(shouldAutoStart(prefs, "classPage")).toBe(true);
    prefs = closeTour(prefs, "classPage", true);
    expect(shouldAutoStart(prefs, "student")).toBe(false);
  });

  it("is kept per account", () => {
    saveTourPrefs(1, { disabled: true, seen: ["teacher"] });
    expect(loadTourPrefs(1)).toEqual({ disabled: true, seen: ["teacher"] });
    expect(loadTourPrefs(2)).toEqual(DEFAULT_TOUR_PREFS);
  });

  it("treats corrupted storage as a first visit", () => {
    localStorage.setItem("debateai.tour.3", "{nope");
    expect(loadTourPrefs(3)).toEqual(DEFAULT_TOUR_PREFS);
  });
});

describe("placeCard", () => {
  const desktop = { width: 1280, height: 800 };

  it("centres the card without a target", () => {
    expect(placeCard(null, 200, desktop)).toEqual({ left: 460, top: 300 });
  });

  it("goes below the target, or above when there is no room", () => {
    expect(placeCard({ left: 100, top: 100, width: 200, height: 40 }, 200, desktop).top).toBeGreaterThan(140);
    expect(placeCard({ left: 100, top: 700, width: 200, height: 40 }, 200, desktop).top).toBeLessThan(700);
  });

  it("stays on screen", () => {
    const { left } = placeCard({ left: 1250, top: 100, width: 20, height: 20 }, 200, desktop);
    expect(left + 360).toBeLessThanOrEqual(1280 - 16);
  });
});

// The step texts are built from the tour definitions, so check:i18n cannot see them.
describe("tour texts", () => {
  const dir = join(__dirname, "../../i18n/locales");
  const keys = [
    ...TOUR_IDS.flatMap((tour) => TOURS[tour].flatMap((step) => Object.values(stepKeys(tour, step)))),
    ...["questionsClamped", "maxTurnsFromQuestions", "minTurnsLowered"].map((k) => `platform.teacher.form.limitNotes.${k}`),
  ];

  it.each(["it", "en", "es", "fr", "de"])("exist in %s", (lang) => {
    const platform = { platform: JSON.parse(readFileSync(join(dir, lang, "platform.json"), "utf8")) };
    const missing = keys.filter((k) => typeof k.split(".").reduce<unknown>((n, p) => (n as Record<string, unknown> | undefined)?.[p], platform) !== "string");
    expect(missing).toEqual([]);
  });
});
