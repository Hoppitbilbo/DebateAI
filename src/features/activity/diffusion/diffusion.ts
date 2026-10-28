// Text "diffusion": the feedback appears as noise that settles into the real
// text, character by character, in a mostly random order, like the output of
// a diffusion language model. Pure functions; DiffusionText draws them.

/** Characters that stand in for the ones not settled yet. */
const NOISE = "abcdefghijklmnopqrstuvwxyzàèéìòùABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&?*+=<>/";

/** Share of a character's settling time that follows its position (the rest is random). */
const TOP_FIRST = 0.25;

/**
 * The paragraphs of a Markdown text as plain text, for the animation only:
 * headings, list markers, emphasis, links and code fences are reduced to
 * their words (bullets become "• "). The real Markdown is shown afterwards.
 */
export const toPlainBlocks = (markdown: string): string[] =>
  markdown
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .map((line) =>
          line
            .replace(/^\s*#{1,6}\s+/, "")
            .replace(/^\s*[-*+]\s+/, "• ")
            .replace(/^\s*>\s?/, "")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/\*\*|__|`/g, "")
            .replace(/(^|[^*\w])\*(?=\S)([^*]+?)\*(?!\*)/g, "$1$2"),
        )
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

/**
 * When each of n characters settles, between 0 and 1: mostly random, a
 * little earlier towards the top, so the whole text clears up at once.
 */
export const settleTimes = (n: number, random: () => number = Math.random): Float32Array => {
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = TOP_FIRST * (n > 1 ? i / (n - 1) : 0) + (1 - TOP_FIRST) * random();
  return times;
};

/** A stretch of a line that is all settled or all noise. */
export interface DiffusionRun {
  text: string;
  settled: boolean;
}

/**
 * A line of the final text at `progress` (0..1): settled characters are
 * the real ones, the others are noise; spaces stay spaces, so the words keep
 * their shape. `offset` is the index of the line's first character in `times`.
 */
export const diffuseLine = (line: string, times: ArrayLike<number>, offset: number, progress: number, random: () => number = Math.random): DiffusionRun[] => {
  const runs: DiffusionRun[] = [];
  const chars = Array.from(line);
  chars.forEach((ch, i) => {
    const settled = /\s/.test(ch) || times[offset + i] <= progress;
    const shown = settled ? ch : NOISE[Math.floor(random() * NOISE.length)];
    const last = runs[runs.length - 1];
    if (last && last.settled === settled) last.text += shown;
    else runs.push({ text: shown, settled });
  });
  return runs;
};
