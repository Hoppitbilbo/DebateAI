/** A sprite as rows of characters: each character is a palette key, "." is transparent. */
export type Grid = string[];
export type Palette = Record<string, string>;

export interface Overlay {
  grid: Grid;
  x: number;
  y: number;
}

/** Paints the overlays over a copy of the base grid ("." in an overlay keeps what is below). */
export const compose = (base: Grid, overlays: Overlay[]): Grid => {
  const rows = base.map((row) => row.split(""));
  for (const { grid, x, y } of overlays) {
    grid.forEach((line, dy) => {
      [...line].forEach((ch, dx) => {
        const row = rows[y + dy];
        if (ch !== "." && row && x + dx >= 0 && x + dx < row.length) row[x + dx] = ch;
      });
    });
  }
  return rows.map((r) => r.join(""));
};

/** One SVG path per colour, with horizontal runs merged, so a sprite is a handful of nodes. */
export const toPaths = (grid: Grid, palette: Palette): { fill: string; d: string }[] => {
  const byColour = new Map<string, string[]>();
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let run = 1;
      while (row[x + run] === ch) run++;
      const fill = palette[ch];
      if (ch !== "." && fill) {
        const parts = byColour.get(fill) ?? [];
        parts.push(`M${x} ${y}h${run}v1h-${run}z`);
        byColour.set(fill, parts);
      }
      x += run;
    }
  });
  return [...byColour].map(([fill, parts]) => ({ fill, d: parts.join("") }));
};
