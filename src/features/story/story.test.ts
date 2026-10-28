import { describe, expect, it } from "vitest";
import { SCRIPT, storyState } from "./script";
import { scrollProgress } from "./useScrollScript";

const box = (top: number, height: number) => ({ getBoundingClientRect: () => ({ top, height }) }) as HTMLElement;

describe("scrollProgress", () => {
  it("runs from the section top to its end at the viewport bottom", () => {
    const h = window.innerHeight;
    expect(scrollProgress(box(100, 3 * h))).toBe(0);
    expect(scrollProgress(box(-h, 3 * h))).toBe(0.5);
    expect(scrollProgress(box(-5 * h, 3 * h))).toBe(1);
  });

  it("counts a section no taller than the viewport as fully read", () => {
    expect(scrollProgress(box(0, window.innerHeight))).toBe(1);
  });
});

describe("storyState", () => {
  it("starts empty on step 1", () => {
    expect(storyState(0)).toEqual({ lines: [], typing: null, activeStep: 1, done: false });
  });

  it("shows the next speaker typing past the middle of a line's slot", () => {
    expect(storyState(2.3).typing).toBeNull();
    expect(storyState(2.5).typing).toBe(SCRIPT[2]);
  });

  it("follows the step of the last line shown", () => {
    const state = storyState(5);
    expect(state.lines.map((l) => l.key)).toEqual(["s1", "g1", "s2", "g2", "s3"]);
    expect(state.activeStep).toBe(3);
  });

  it("is done once every line is shown", () => {
    expect(storyState(SCRIPT.length)).toMatchObject({ typing: null, activeStep: 4, done: true });
  });
});
