import { describe, expect, it } from "vitest";
import { diffuseLine, settleTimes, toPlainBlocks } from "./diffusion";

describe("toPlainBlocks", () => {
  it("reduces Markdown to its words, one block per paragraph", () => {
    const md = "## Punti di forza\n\nHai fatto **domande precise** e *pertinenti*.\n\n- Primo punto\n- Vedi [Dante](https://it.wikipedia.org/wiki/Dante)\n\n```js\ncode()\n```";
    expect(toPlainBlocks(md)).toEqual(["Punti di forza", "Hai fatto domande precise e pertinenti.", "• Primo punto\n• Vedi Dante"]);
  });

  it("keeps multiplication signs and snake_case words", () => {
    expect(toPlainBlocks("2 * 3 = 6, nome_variabile")).toEqual(["2 * 3 = 6, nome_variabile"]);
  });
});

describe("settleTimes", () => {
  it("gives every character a time between 0 and 1, earlier towards the top", () => {
    const times = settleTimes(1000, () => 0.5);
    expect(times[0]).toBeCloseTo(0.375);
    expect(times[999]).toBeCloseTo(0.625);
    expect(Array.from(settleTimes(50)).every((t) => t >= 0 && t <= 1)).toBe(true);
  });
});

describe("diffuseLine", () => {
  const times = [0.1, 0.9, 0.2, 0.5, 0.95];
  const noise = () => 0;

  it("shows settled characters and noise for the others, keeping spaces", () => {
    expect(diffuseLine("ab cd", times, 0, 0.3, noise)).toEqual([
      { text: "a", settled: true },
      { text: "a", settled: false },
      { text: " ", settled: true },
      { text: "aa", settled: false },
    ]);
  });

  it("is the final text once everything settled", () => {
    expect(diffuseLine("ab cd", times, 0, 1, noise)).toEqual([{ text: "ab cd", settled: true }]);
  });

  it("reads the times of its own characters through the offset", () => {
    expect(diffuseLine("x", [0.9, 0.1], 1, 0.5, noise)).toEqual([{ text: "x", settled: true }]);
  });
});
