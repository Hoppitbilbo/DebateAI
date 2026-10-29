import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCRIPT, STEPS } from "@/features/story/script";
import { APPS_PAGE_APPS, HOME_APPS, TUTORIAL_PAGE_APPS, UPCOMING_APP } from "./catalog";

// Keys built from the catalog (`features.items.${app.i18nKey}…`) are invisible
// to scripts/check-i18n.mjs, which reads literal keys only. This test checks them.

const LOCALES = ["it", "en", "es", "fr", "de"];
const dir = join(__dirname, "../../i18n/locales");

const load = (lang: string) =>
  Object.fromEntries(
    readdirSync(join(dir, lang))
      .filter((f) => f.endsWith(".json"))
      .map((f) => [f.replace(".json", ""), JSON.parse(readFileSync(join(dir, lang, f), "utf8"))]),
  );

const lookup = (dict: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

const builtKeys = [
  ...HOME_APPS.flatMap((a) => [`features.items.${a.i18nKey}.name`, `features.items.${a.i18nKey}.description`]),
  ...APPS_PAGE_APPS.flatMap((a) => [`appsPage.appCards.${a.i18nKey}.title`, `appsPage.appCards.${a.i18nKey}.description`]),
  ...APPS_PAGE_APPS.filter((a) => !a.upcoming).flatMap((a) => [`appsPage.appCards.${a.i18nKey}.skill`, `appsPage.appCards.${a.i18nKey}.duration`]),
  ...TUTORIAL_PAGE_APPS.flatMap((a) => [
    `tutorialsPage.sections.availableTutorials.tutorials.${a.i18nKey}.title`,
    `tutorialsPage.sections.availableTutorials.tutorials.${a.i18nKey}.description`,
  ]),
  `tutorialsPage.sections.comingSoon.${UPCOMING_APP.i18nKey}.title`,
  `tutorialsPage.sections.comingSoon.${UPCOMING_APP.i18nKey}.description`,
  ...["teacherGuide", "allApps"].flatMap((k) => ["title", "description", "button"].map((p) => `tutorialsPage.sections.additionalResources.${k}.${p}`)),
  ...["title", "description"].map((p) => `tutorialsPage.sections.additionalResources.reddit.${p}`),
  ...[1, 2, 3, 4].flatMap((n) => ["title", "description"].map((p) => `tutorialsPage.sections.howToStart.steps.step${n}.${p}`)),
  ...["forTeachers", "forStudents", "forEveryone"].flatMap((k) => ["title", "description"].map((p) => `tutorialsPage.sections.tips.${k}.${p}`)),
  ...SCRIPT.map((line) => `hero.story.messages.${line.key}`),
  ...STEPS.map((step) => `hero.story.steps.${step}`),
];

describe("texts of the public pages", () => {
  it("exist in every language", () => {
    const missing = LOCALES.flatMap((lang) => {
      const dict = load(lang);
      return builtKeys.filter((k) => typeof lookup(dict, k) !== "string").map((k) => `${lang}:${k}`);
    });
    expect(missing).toEqual([]);
  });
});
