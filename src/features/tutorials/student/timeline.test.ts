import { describe, expect, it } from "vitest";
import { buildTimeline, locate, MORPH_S, sfxEvents, subtitleAt, totalSeconds, VOICE_START_S } from "./timeline";

describe("tutorial timeline", () => {
  const timeline = buildTimeline([4, 10], [2, 3]);

  it("puts the slides one after the other and waits for the narration", () => {
    expect(timeline[0].start).toBe(0);
    expect(timeline[1].start).toBe(timeline[0].duration);
    expect(timeline[0].duration).toBeGreaterThanOrEqual(VOICE_START_S + 4);
    expect(totalSeconds(timeline)).toBe(timeline[1].start + timeline[1].duration);
  });

  it("reveals the items after the morph, in order", () => {
    for (const s of timeline) {
      expect(s.reveals[0]).toBeGreaterThan(MORPH_S);
      expect([...s.reveals].sort((a, b) => a - b)).toEqual(s.reveals);
    }
  });

  it("finds the slide on screen at any time", () => {
    expect(locate(timeline, 0)).toEqual({ index: 0, t: 0 });
    expect(locate(timeline, timeline[1].start + 1)).toEqual({ index: 1, t: 1 });
  });

  it("has a whoosh per morph, a blip per item and a final jingle", () => {
    const events = sfxEvents(timeline);
    expect(events.filter((e) => e.kind === "whoosh")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "blip")).toHaveLength(4);
    expect(events[events.length - 1].kind).toBe("jingle");
  });

  it("shows one sentence of the narration at a time", () => {
    const text = "Prima frase. Seconda frase più lunga!";
    expect(subtitleAt(text, 0)).toBe("Prima frase.");
    expect(subtitleAt(text, 0.9)).toBe("Seconda frase più lunga!");
  });
});
