import { describe, expect, it } from "vitest";
import { checkSuggestions } from "./suggestions";

const allowed = ["Albert Einstein", "Niels Bohr", "Bomba atomica", "Max Planck"];

describe("checkSuggestions", () => {
  it("builds the settings of each app from allowed pages, with their exact titles", () => {
    const out = checkSuggestions([
      { appType: "doppia-intervista", title: "Einstein contro Bohr", why: "Due visioni", characters: ["albert einstein", "Niels Bohr"] },
      { appType: "convinci-tu", title: "Fermare la bomba", characters: ["Albert Einstein"], topic: "Non firmare la lettera" },
      { appType: "personaggio-misterioso", title: "Chi è?", characters: ["Max Planck", "Niels Bohr"] },
    ], allowed);
    expect(out.map((s) => s.appType)).toEqual(["doppia-intervista", "convinci-tu", "personaggio-misterioso"]);
    expect(out[0].config.characters?.map((c) => c.title)).toEqual(["Albert Einstein", "Niels Bohr"]);
    expect(out[1].config).toEqual({ character: { title: "Albert Einstein" }, topic: "Non firmare la lettera" });
    expect(out[2].config).toEqual({ characters: [{ title: "Max Planck" }, { title: "Niels Bohr" }], shuffle: true });
  });

  it("drops invented pages, unknown apps, missing topics, wrong counts and repeats", () => {
    const out = checkSuggestions([
      { appType: "doppia-intervista", title: "Inventato", characters: ["Albert Einstein", "Topolino"] },
      { appType: "quiz", title: "No", characters: ["Niels Bohr"] },
      { appType: "convinci-tu", title: "Senza tema", characters: ["Niels Bohr"] },
      { appType: "wiki-chatbot", title: "La bomba", characters: ["Bomba atomica"] },
      { appType: "wiki-chatbot", title: "Ancora la bomba", characters: ["Bomba atomica"] },
    ], allowed);
    expect(out.map((s) => s.title)).toEqual(["La bomba"]);
  });
});
