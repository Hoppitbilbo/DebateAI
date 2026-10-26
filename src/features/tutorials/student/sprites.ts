import { compose, type Grid, type Overlay, type Palette } from "./pixelGrid";

// Pixel-art guides of the student tutorials: every character is the same
// 24x36 body (with trousers or a long robe) plus overlays for hair, hats,
// beards and the object in hand, and its own palette.

export type SpriteId =
  | "napoleon" | "galileo" | "aristotle" | "shadow" | "cleopatra" | "leonardo"
  | "curie" | "einstein" | "ada" | "student" | "colosseum";

const BODY_TOP: Grid = [
  "........................",
  "........................",
  "........................",
  "........................",
  "........OOOOOOOO........",
  ".......OSSSSSSSSO.......",
  "......OSSSSSSSSSSO......",
  "......OSSSSSSSSSSO......",
  "......OSSESSSSESSO......",
  "......OSSESSSSESSO......",
  "......OSSSSSSSSSSO......",
  "......OSSSSSSSSSSO......",
  ".......OSSSSSSSSO.......",
  "........OOSSSSOO........",
  ".....OOOCCCTTCCCOOO.....",
  "....OCCCCCCTTCCCCCCO....",
  ...Array<string>(9).fill("...OCCOCCCCTTCCCCOCCO..."),
  "...OSSOCCCCCCCCCCOSSO...",
  "....OO.OCCCCCCCCO.OO....",
];

const LEGS: Grid = [
  ".......OPPPPPPPPO.......",
  ...Array<string>(5).fill(".......OPPPOOPPPO......."),
  ".......OBBBOOBBBO.......",
  "......OBBBBOOBBBBO......",
  "......OOOOOOOOOOOO......",
];

const ROBE: Grid = [
  "......OCCCCCCCCCCO......",
  ...Array<string>(5).fill(".....OCCCCCCCCCCCCO....."),
  ".....OTTTTTTTTTTTTO.....",
  ".......OBBO..OBBO.......",
  ".......OOOO..OOOO.......",
];

const MOUTH: Overlay = { grid: ["MM"], x: 11, y: 11 };

const BASE_PALETTE: Palette = { O: "#141221", E: "#141221", S: "#f2c79f", B: "#333c57" };
const MOUTH_OPEN = "#b13e53";

interface CharacterDef {
  robe?: boolean;
  palette: Palette;
  overlays: Overlay[];
  /** Mouth colour when closed; defaults to a darker skin tone. */
  mouthClosed?: string;
  mouthOpen?: string;
}

const top = (grid: Grid): Overlay => ({ grid, x: 0, y: 0 });
const sides = (row: string, from: number, count: number): Overlay => ({ grid: Array<string>(count).fill(row), x: 0, y: from });

const CHARACTERS: Record<Exclude<SpriteId, "colosseum">, CharacterDef> = {
  napoleon: {
    palette: { C: "#29366f", T: "#f4f4f4", P: "#f4f4f4", B: "#1a1c2c", H: "#5d3a1a", K: "#22223b", R: "#b13e53", W: "#f4f4f4", b: "#3b5dc9", Y: "#ffcd75" },
    overlays: [
      top([
        "........................",
        ".........KKKKKK.........",
        "....KKKKKKKKKKKKKKKK....",
        "..KKKKKKKKKRWbKKKKKKKK..",
        "...KKKKKKKKKKKKKKKKKK...",
        ".......KKKKKKKKKK.......",
        "......OHH......HHO......",
      ]),
      { grid: ["YYYY........YYYY", "YYYY........YYYY"], x: 4, y: 14 },
    ],
  },
  galileo: {
    robe: true,
    palette: { C: "#3b2e2a", T: "#5a4636", B: "#1a1c2c", K: "#1a1c2c", G: "#94b0c2", Y: "#ffcd75", N: "#8f563b", W: "#73eff7" },
    overlays: [
      top([
        "........................",
        "........................",
        "........................",
        "........KKKKKKKK........",
        ".......KKKKKKKKKK.......",
        "......OKKKKKKKKKKO......",
        "......OGG......GGO......",
        "......OGG......GGO......",
      ]),
      { grid: ["......OGGSSSSSSGGO......", "......OGGGGSSGGGGO......", ".......OGGGGGGGGO.......", "........OGGGGGGO........", ".........OGGGGO........."], x: 0, y: 10 },
      { grid: ["....YW", "...YY.", "...YY.", "..NN..", "..NN..", ".NN...", ".NN...", "NN....", "NN...."], x: 18, y: 17 },
    ],
  },
  aristotle: {
    robe: true,
    palette: { C: "#f4f4f4", T: "#3b5dc9", B: "#8f563b", L: "#38b764", W: "#e0e0e0", Y: "#ffcd75", Q: "#e8d8b0", G: "#94b0c2" },
    overlays: [
      top([
        "........................",
        "........................",
        "........................",
        "........................",
        ".......LLLLLLLLLL.......",
        "......LLWWWWWWWWLL......",
        "......OW........WO......",
        "......OW........WO......",
      ]),
      { grid: ["......OWWSSSSSSWWO......", "......OWWWWSSWWWWO......", ".......OWWWWWWWWO.......", "........OWWWWWWO........", ".........OWWWWO........."], x: 0, y: 10 },
      { grid: [".YY..", "YQQQ.", "YQGQ.", "YQGQ.", "YQQQ.", ".YY.."], x: 18, y: 22 },
    ],
  },
  shadow: {
    palette: { O: "#0d0b16", S: "#2a2440", C: "#2a2440", T: "#3a3258", P: "#2a2440", B: "#1d1a2e", E: "#ffcd75" },
    mouthClosed: "#2a2440",
    mouthOpen: "#ffcd75",
    overlays: [],
  },
  cleopatra: {
    robe: true,
    palette: { S: "#c68b59", C: "#f4f4f4", T: "#ffcd75", B: "#8f563b", H: "#1a1c2c", Y: "#ffcd75", E: "#29366f" },
    mouthClosed: "#a8693f",
    overlays: [
      top([
        "........................",
        "........................",
        "........................",
        "........HHHHHHHH........",
        ".......HHHHYYHHHH.......",
        "......HYYYYYYYYYYH......",
        "......HHSSSSSSSSHH......",
        ".....HHH........HHH.....",
        ".....HH..........HH.....",
        ".....HH..........HH.....",
        ".....HH..........HH.....",
        ".....HHH........HHH.....",
        ".....HHHH......HHHH.....",
      ]),
      { grid: [".....YYYYYYYYYYYYYY....."], x: 0, y: 14 },
    ],
  },
  leonardo: {
    robe: true,
    palette: { C: "#7a2e2e", T: "#5d3a1a", B: "#5d3a1a", R: "#b13e53", W: "#e0e0e0", Y: "#ffcd75", E: "#141221" },
    overlays: [
      top([
        "........................",
        "........RRRRRRRR........",
        "......RRRRRRRRRRRR......",
        ".....RRRRRRRRRRRRRR.....",
        "......RRRRRRRRRRRR......",
      ]),
      sides(".....WW..........WW.....", 5, 5),
      {
        grid: [
          ".....WWWSSSSSSSSWWW.....",
          ".....WWWWWSSSSWWWWW.....",
          ".....WWWWWWWWWWWWWW.....",
          "......WWWWWWWWWWWW......",
          ".......WWWWWWWWWW.......",
          "........WWWWWWWW........",
          ".........WWWWWW.........",
          "..........WWWW..........",
        ],
        x: 0,
        y: 10,
      },
      { grid: [".YYY.", "YEYEY", "YYYYY", ".YYY."], x: 0, y: 22 },
    ],
  },
  curie: {
    robe: true,
    palette: { C: "#2b2b3a", T: "#f4f4f4", B: "#1a1c2c", H: "#5d3a1a", W: "#c8e6ff", G: "#38b764" },
    overlays: [
      top([
        "........................",
        "........................",
        "..........HHHH..........",
        ".........HHHHHH.........",
        "........HHHHHHHH........",
        ".......OHHHHHHHHO.......",
        "......OHHSSSSSSHHO......",
        "......OHSSSSSSSSHO......",
      ]),
      { grid: ["..W..", "..W..", ".WGW.", "WGGGW", "WGGGW", ".WWW."], x: 19, y: 20 },
    ],
  },
  einstein: {
    palette: { C: "#7a5c3a", T: "#f4f4f4", P: "#566c86", B: "#1a1c2c", W: "#e8e8e8" },
    overlays: [
      top([
        "........................",
        "........................",
        "......W..W...W..W.......",
        ".....WWWWWWWWWWWWWW.....",
        "....WWWWWWWWWWWWWWWW....",
        "...WWWWOSSSSSSSSOWWWW...",
        "...WWWOSSSSSSSSSSOWWW...",
        "....WWOSSSSSSSSSSOWW....",
        ".....W............W.....",
      ]),
      { grid: ["......OSSWWWWWWSSO......"], x: 0, y: 10 },
    ],
  },
  ada: {
    robe: true,
    palette: { C: "#5d275d", T: "#f4f4f4", B: "#1a1c2c", H: "#3b2417", Q: "#e8d8b0" },
    overlays: [
      top([
        "........................",
        "........................",
        "........................",
        "........HHHHHHHH........",
        ".......HHHHHHHHHH.......",
        "......HHHHHHHHHHHH......",
        ".....HHHSSSSSSSSHHH.....",
        ".....HHH........HHH.....",
        ".....HH..........HH.....",
        ".....HH..........HH.....",
        "....HHH..........HHH....",
        "....HHH..........HHH....",
        "....HH............HH....",
      ]),
      { grid: ["QQQQ", "QOQO", "QQQQ", "QOQQ", "QQQQ"], x: 19, y: 21 },
    ],
  },
  student: {
    palette: { C: "#257179", T: "#f4f4f4", P: "#3b5dc9", B: "#f4f4f4", H: "#5d3a1a", G: "#94b0c2", K: "#333c57" },
    overlays: [
      top([
        "........................",
        "........................",
        "........................",
        "........HHHHHHHH........",
        ".......HHHHHHHHHH.......",
        "......OHHHHHHHHHHO......",
        "......OHHHSSSSSSSO......",
      ]),
      { grid: ["GGG", "GGG", ".K.", ".K.", ".K.", ".K."], x: 19, y: 20 },
    ],
  },
};

// The Colosseum: three tiers of arches, ruined on the right, with eyes and a mouth.
const COLOSSEUM_W = 44;
const COLOSSEUM_H = 30;
const ARCH_PERIOD = 6;

const colosseumGrid = (): Grid => {
  const cells: string[][] = Array.from({ length: COLOSSEUM_H }, () => Array<string>(COLOSSEUM_W).fill("."));
  const ruinTop = (x: number) => (x < 34 ? 0 : Math.min(10, (x - 33) * 2));
  for (let y = 0; y < COLOSSEUM_H; y++) {
    for (let x = 0; x < COLOSSEUM_W; x++) {
      if (y < ruinTop(x)) continue;
      const col = x % ARCH_PERIOD;
      const tier = [11, 19].find((t) => y >= t && y < t + 7);
      let ch = "A";
      if ([2, 10, 18, 26].includes(y) || y >= 27) ch = "D";
      else if (y >= 5 && y <= 6 && (col === 2 || col === 3)) ch = "L";
      else if (tier !== undefined && col >= 1 && col <= 4 && (y > tier || col === 2 || col === 3)) ch = "L";
      cells[y][x] = ch;
    }
  }
  // outline every cell that touches the outside
  const filled = (x: number, y: number) => cells[y]?.[x] !== undefined && cells[y][x] !== ".";
  const outlined = cells.map((row, y) =>
    row.map((ch, x) => (ch !== "." && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) ? "O" : ch)),
  );
  const grid = outlined.map((r) => r.join(""));
  return compose(grid, [
    { grid: ["WW", "WE", "WW"], x: 14, y: 13 },
    { grid: ["WW", "EW", "WW"], x: 26, y: 13 },
    { grid: ["MM", "MM"], x: 20, y: 22 },
  ]);
};

const COLOSSEUM_PALETTE: Palette = { O: "#141221", A: "#d9a066", D: "#a0623a", L: "#5a3a2a", W: "#f4f4f4", E: "#141221" };

const cache = new Map<SpriteId, Grid>();

const gridOf = (id: SpriteId): Grid => {
  let grid = cache.get(id);
  if (!grid) {
    if (id === "colosseum") grid = colosseumGrid();
    else {
      const def = CHARACTERS[id];
      grid = compose([...BODY_TOP, ...(def.robe ? ROBE : LEGS)], [...def.overlays, MOUTH]);
    }
    cache.set(id, grid);
  }
  return grid;
};

/** The sprite of a guide, with the mouth open while it talks. */
export const spriteOf = (id: SpriteId, talking: boolean): { grid: Grid; palette: Palette } => {
  if (id === "colosseum") {
    return { grid: gridOf(id), palette: { ...COLOSSEUM_PALETTE, M: talking ? MOUTH_OPEN : COLOSSEUM_PALETTE.L } };
  }
  const def = CHARACTERS[id];
  const palette = { ...BASE_PALETTE, ...def.palette };
  const closed = def.mouthClosed ?? "#d9a07a";
  return { grid: gridOf(id), palette: { ...palette, M: talking ? (def.mouthOpen ?? MOUTH_OPEN) : closed } };
};

export const SPRITE_IDS = [...Object.keys(CHARACTERS), "colosseum"] as SpriteId[];
