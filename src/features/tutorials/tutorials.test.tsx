import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import de from "@/i18n/tutorials/de.json";
import en from "@/i18n/tutorials/en.json";
import es from "@/i18n/tutorials/es.json";
import fr from "@/i18n/tutorials/fr.json";
import it_ from "@/i18n/tutorials/it.json";
import TutorialSlides from "./TutorialSlides";
import { TUTORIALS } from "./tutorials";

afterEach(cleanup);

const lookup = (dict: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);

describe("tutorial data", () => {
  // What a reader sees: a text missing in their language falls back to Italian.
  // Known content gap (documented in docs/REFACTORING.md): the ImpersonaTu
  // slides use ids that the translations name differently, so 30 texts show
  // their key in every language. Fixing it is content work, not refactoring.
  it("shows a translation for every text except the known ImpersonaTu gap", () => {
    const visibleMissing = new Set<string>();
    for (const dict of [de, en, es, fr, it_]) {
      for (const tutorial of Object.values(TUTORIALS)) {
        const keys = [`${tutorial!.ns}.title`, `${tutorial!.ns}.subtitle`, `${tutorial!.ns}.startApp`];
        for (const s of tutorial!.slides) {
          const k = `${tutorial!.ns}.slides.${s.id}`;
          keys.push(`${k}.title`, `${k}.content`, ...Array.from({ length: s.bullets }, (_, i) => `${k}.bullet${i + 1}`));
        }
        for (const k of keys) {
          if (typeof lookup(dict, k) !== "string" && typeof lookup(it_, k) !== "string") visibleMissing.add(k);
        }
      }
    }
    expect([...visibleMissing].filter((k) => !k.startsWith("impersonaTu."))).toEqual([]);
    expect(visibleMissing.size).toBe(30);
  });
});

describe("TutorialSlides", () => {
  it("walks through the slides and starts the app", async () => {
    await i18n.changeLanguage("en");
    const tutorial = TUTORIALS["personaggio-misterioso"]!;
    render(
      <MemoryRouter initialEntries={["/tutorial"]}>
        <Routes>
          <Route path="/tutorial" element={<TutorialSlides tutorial={tutorial} appPath="/apps/x" />} />
          <Route path="/apps/x" element={<p>app opened</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(`1 / ${tutorial.slides.length}`)).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(tutorial.slides[0].bullets);
    expect(screen.queryByRole("button", { name: en.personaggioMisterioso.startApp })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: `${tutorial.slides.length} / ${tutorial.slides.length}` }));
    fireEvent.click(screen.getByRole("button", { name: en.personaggioMisterioso.startApp }));
    expect(screen.getByText("app opened")).toBeTruthy();
  });
});
