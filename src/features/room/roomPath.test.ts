import { describe, expect, it } from "vitest";
import { autoTitle, newStep, pagesOf, pathBody, sameActivity } from "./roomPath";

const einstein = { title: "Albert Einstein" };
const bohr = { title: "Niels Bohr" };

describe("room path", () => {
  it("reads the pages of every kind of step", () => {
    expect(pagesOf(newStep("personaggio-misterioso", { characters: [einstein, bohr] }).draft)).toEqual(["Albert Einstein", "Niels Bohr"]);
    expect(pagesOf(newStep("impersona-tu", { userCharacter: einstein, aiCharacter: bohr }).draft)).toEqual(["Niels Bohr", "Albert Einstein"]);
    expect(pagesOf(newStep("wiki-chatbot").draft)).toEqual([]);
  });

  it("names steps after their characters, never the mystery one", () => {
    expect(autoTitle(newStep("doppia-intervista", { characters: [einstein, bohr] }).draft, "Doppia intervista", "?")).toBe("Doppia intervista: Albert Einstein · Niels Bohr");
    expect(autoTitle(newStep("personaggio-misterioso", { characters: [einstein] }).draft, "Personaggio misterioso", "Chi sono?")).toBe("Chi sono?");
    expect(autoTitle(newStep("convinci-tu", {}, { title: " Mio " }).draft, "x", "y")).toBe("Mio");
  });

  it("sends every step in the room's language, without live voice", () => {
    const body = pathBody([newStep("convinci-tu", { character: einstein, topic: "Pace" }), newStep("wiki-chatbot")], "en", () => "T");
    expect(body.map((b) => b.config.language)).toEqual(["en", "en"]);
    expect(body.every((b) => b.allowLive === false && b.title === "T")).toBe(true);
  });

  it("recognises a suggestion already in the path", () => {
    const step = newStep("doppia-intervista", { characters: [einstein, bohr] });
    expect(sameActivity(step, { appType: "doppia-intervista", title: "x", why: "", config: { characters: [einstein, bohr] } })).toBe(true);
    expect(sameActivity(step, { appType: "you-moderate", title: "x", why: "", config: { characters: [einstein, bohr] } })).toBe(false);
  });
});
