import { describe, expect, it } from "vitest";
import { fallbackIcon, wikiTitleOf } from "./speakerAvatar";

describe("speaker avatar", () => {
  it("looks up real names only", () => {
    expect(wikiTitleOf("Dante Alighieri")).toBe("Dante Alighieri");
    expect(wikiTitleOf("???")).toBeUndefined();
    expect(wikiTitleOf("AI")).toBeUndefined();
    expect(wikiTitleOf("")).toBeUndefined();
  });

  it("picks the picture for a speaker without a portrait", () => {
    expect(fallbackIcon("???", "assistant", "person")).toBe("/avatars/mystery.webp");
    expect(fallbackIcon(undefined, "user", "page")).toBe("/avatars/student-cap.webp");
    expect(fallbackIcon("Dante Alighieri", "user", "person")).toBe("/avatars/unknown-person.webp");
    expect(fallbackIcon("Roma", "assistant", "page")).toBe("/avatars/page.webp");
  });
});
