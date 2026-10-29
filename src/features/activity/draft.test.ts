import { beforeEach, describe, expect, it } from "vitest";
import { DRAFT_TTL_MS, draftKey, loadDraft, pruneDrafts, saveDraft } from "./draft";

beforeEach(() => localStorage.clear());

describe("drafts", () => {
  it("keeps the unsent text per account and place, and drops it once sent", () => {
    const anna = draftKey(1, "convinci-tu:0");
    saveDraft(anna, "Napoleone, pensa a");
    expect(loadDraft(anna)).toBe("Napoleone, pensa a");
    expect(loadDraft(draftKey(2, "convinci-tu:0"))).toBe(""); // another student on the same PC
    saveDraft(anna, "");
    expect(localStorage.getItem(anna)).toBeNull();
  });

  it("forgets drafts older than a day", () => {
    const key = draftKey(1, "wiki-chatbot:3");
    saveDraft(key, "old", 0);
    expect(loadDraft(key, DRAFT_TTL_MS + 1)).toBe("");
    expect(localStorage.getItem(key)).toBeNull();
    saveDraft(key, "old", 0);
    pruneDrafts(DRAFT_TTL_MS + 1);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
