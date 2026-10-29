import { describe, expect, it, vi } from "vitest";
import { recipeFor } from "./recipe";

const ui = vi.hoisted(() => ({ language: "en-GB" }));
vi.mock("@/i18n", () => ({ default: ui }));

describe("recipeFor", () => {
  it("fills the defaults and the interface language", () => {
    expect(recipeFor("wiki-chatbot", { character: "Colosseo", bio: "Anfiteatro" })).toEqual({
      app: "wiki-chatbot",
      kind: "reply",
      difficulty: "medium",
      character: "Colosseo",
      bio: "Anfiteatro",
      uiLang: "en",
    });
  });

  it("keeps what the page sets", () => {
    ui.language = "";
    const r = recipeFor("personaggio-misterioso", { character: "Cesare", kind: "opening", difficulty: "hard", questions: 7 });
    expect(r).toMatchObject({ kind: "opening", difficulty: "hard", questions: 7, uiLang: "it" });
  });
});
