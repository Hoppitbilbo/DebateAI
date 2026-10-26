import { describe, expect, it } from "vitest";
import { SPRITE_IDS, spriteOf } from "./sprites";

describe("guide sprites", () => {
  it.each(SPRITE_IDS)("%s is a rectangle whose every pixel has a colour", (id) => {
    const { grid, palette } = spriteOf(id, true);
    const width = grid[0].length;
    for (const row of grid) {
      expect(row).toHaveLength(width);
      for (const ch of row) if (ch !== ".") expect(palette[ch], `${id}: "${ch}"`).toBeTruthy();
    }
  });

  it("opens the mouth only while talking", () => {
    expect(spriteOf("napoleon", true).palette.M).not.toBe(spriteOf("napoleon", false).palette.M);
  });
});
