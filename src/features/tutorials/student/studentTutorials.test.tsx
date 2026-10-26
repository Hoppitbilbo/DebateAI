import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { APP_TYPES } from "@/features/activity/appCatalog";
import { StudentTutorialPlayer } from "./StudentTutorialPlayer";
import { resolveSlides, revealCount, SLIDE_KINDS, STUDENT_TUTORIALS } from "./studentTutorials";

afterEach(cleanup);

const t = i18n.getFixedT("it", "studentTutorial");

describe("student tutorials", () => {
  it.each(APP_TYPES)("%s has six complete slides", (app) => {
    const slides = resolveSlides(STUDENT_TUTORIALS[app], t);
    expect(slides.map((s) => s.kind)).toEqual(SLIDE_KINDS);
    for (const s of slides) {
      expect(s.title, `${app}.${s.kind}.title`).not.toMatch(/\.title$/);
      expect(s.voice.length, `${app}.${s.kind}.voice`).toBeGreaterThan(20);
      expect(s.voice).not.toMatch(/\b(common|mission|task|path|grading|tips)\.\w+/);
      expect(revealCount(s)).toBeGreaterThan(0);
    }
  });

  it("never uses the 'non è solo..., ma' phrasing", () => {
    for (const app of APP_TYPES) {
      for (const s of resolveSlides(STUDENT_TUTORIALS[app], t)) {
        const text = [s.title, s.voice, ...s.lines, s.extra, s.goal, ...(s.plus ?? []), s.reflection].join(" ");
        expect(text).not.toMatch(/non (è|sono) solo/i);
      }
    }
  });

  it("starts with a cover and moves between slides", async () => {
    await i18n.changeLanguage("it");
    render(
      <MemoryRouter>
        <StudentTutorialPlayer app="convinci-tu" />
      </MemoryRouter>,
    );
    expect(screen.getByText("MISSIONE: CONVINCI L'IMPERATORE")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /3 \/ 6/ }));
    expect(screen.getByText("IL PERCORSO")).toBeTruthy();
    expect(screen.getByRole("link", { name: i18n.t("platform.tutorialPlayer.openApp") }).getAttribute("href")).toBe("/apps/convinci-tu");
  });
});
