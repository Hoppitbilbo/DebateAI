import { memo, type ReactNode } from "react";
import type { SceneId } from "./studentTutorials";

// Pixel-art backdrops, wider than the stage so they can pan sideways during
// the morph. Everything is drawn with rectangles on a 4-pixel grid.

export const SCENE_W = 960;
export const SCENE_H = 360;
const FLOOR_Y = 280;

type Rect = [x: number, y: number, w: number, h: number, fill: string];

const rects = (list: Rect[]) => list.map(([x, y, w, h, fill], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />);

/** Deterministic pseudo-random numbers, so the stars are the same in every frame. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const snap = (v: number) => Math.round(v / 4) * 4;

const stars = (seed: number, count: number, maxY: number, colours = ["#f4f4f4", "#ffcd75", "#73eff7"]): Rect[] => {
  const rnd = seeded(seed);
  return Array.from({ length: count }, () => {
    const big = rnd() < 0.15;
    return [snap(rnd() * SCENE_W), snap(rnd() * maxY), big ? 8 : 4, 4, colours[Math.floor(rnd() * colours.length)]] as Rect;
  });
};

const bands = (colours: string[], height: number): Rect[] => {
  const h = height / colours.length;
  return colours.map((c, i) => [0, i * h, SCENE_W, h + 1, c] as Rect);
};

const moon = (x: number, y: number): Rect[] => [
  [x + 8, y, 32, 48, "#f4f4f4"], [x, y + 8, 48, 32, "#f4f4f4"],
  [x + 12, y + 12, 8, 8, "#94b0c2"], [x + 28, y + 28, 8, 4, "#94b0c2"], [x + 24, y + 8, 4, 4, "#94b0c2"],
];

const steppedTriangle = (cx: number, base: number, height: number, step: number, fill: string): Rect[] =>
  Array.from({ length: height / step }, (_, i) => {
    const half = (i + 1) * step * 0.9;
    return [snap(cx - half), base - height + i * step, snap(half * 2), step, fill] as Rect;
  });

const tent = (cx: number): Rect[] => [
  ...steppedTriangle(cx, FLOOR_Y, 96, 8, "#94b0c2"),
  ...steppedTriangle(cx, FLOOR_Y, 48, 8, "#1a1c2c"),
  [cx - 2, FLOOR_Y - 136, 4, 40, "#566c86"],
  [cx + 2, FLOOR_Y - 136, 12, 8, "#3b5dc9"], [cx + 14, FLOOR_Y - 136, 12, 8, "#f4f4f4"], [cx + 26, FLOOR_Y - 136, 12, 8, "#b13e53"],
];

const campfire = (x: number): Rect[] => [
  [x, FLOOR_Y + 4, 32, 8, "#5d3a1a"], [x + 8, FLOOR_Y - 12, 16, 16, "#ef7d57"], [x + 12, FLOOR_Y - 20, 8, 12, "#ffcd75"],
];

const brickWall = (fill: string, mortar: string, height: number): Rect[] => {
  const out: Rect[] = [[0, 0, SCENE_W, height, fill]];
  for (let y = 0; y < height; y += 24) {
    out.push([0, y, SCENE_W, 4, mortar]);
    for (let x = (y / 24) % 2 ? 24 : 0; x < SCENE_W; x += 48) out.push([x, y, 4, 24, mortar]);
  }
  return out;
};

const archWindow = (x: number, y: number): Rect[] => [
  [x, y + 16, 64, 80, "#5d3a1a"], [x + 8, y + 8, 48, 8, "#5d3a1a"],
  [x + 8, y + 20, 48, 72, "#41a6f6"], [x + 16, y + 12, 32, 8, "#41a6f6"], [x + 30, y + 12, 4, 80, "#5d3a1a"], [x + 8, y + 52, 48, 4, "#5d3a1a"],
  [x + 12, y + 24, 8, 8, "#73eff7"],
];

const easel = (x: number): Rect[] => [
  [x + 8, FLOOR_Y - 120, 4, 120, "#8f563b"], [x + 76, FLOOR_Y - 120, 4, 120, "#8f563b"], [x + 42, FLOOR_Y - 132, 4, 132, "#73402c"],
  [x, FLOOR_Y - 116, 88, 72, "#f4f4f4"], [x + 4, FLOOR_Y - 112, 80, 64, "#e8d8b0"],
  [x + 40, FLOOR_Y - 108, 8, 8, "#8f563b"], [x + 36, FLOOR_Y - 96, 16, 24, "#8f563b"], [x + 20, FLOOR_Y - 92, 48, 4, "#8f563b"], [x + 32, FLOOR_Y - 72, 4, 20, "#8f563b"], [x + 52, FLOOR_Y - 72, 4, 20, "#8f563b"],
  [x - 4, FLOOR_Y - 44, 96, 6, "#73402c"],
];

const bookshelf = (x: number, seed: number): Rect[] => {
  const rnd = seeded(seed);
  const books = ["#b13e53", "#3b5dc9", "#38b764", "#ffcd75", "#ef7d57", "#5d275d", "#73eff7"];
  const out: Rect[] = [[x, 40, 176, FLOOR_Y - 40, "#5d3a1a"]];
  for (let shelf = 0; shelf < 4; shelf++) {
    const base = 96 + shelf * 56;
    out.push([x, base, 176, 8, "#8f563b"]);
    for (let bx = x + 8; bx < x + 164; ) {
      const w = 8 + snap(rnd() * 8);
      const h = 28 + snap(rnd() * 16);
      out.push([bx, base - h, w, h, books[Math.floor(rnd() * books.length)]]);
      bx += w + 4;
    }
  }
  return out;
};

const curtain = (x: number, width: number): Rect[] =>
  Array.from({ length: width / 16 }, (_, i) => [x + i * 16, 0, 16, FLOOR_Y, i % 2 ? "#b13e53" : "#7a2034"] as Rect);

const lectern = (x: number): Rect[] => [
  [x, FLOOR_Y - 72, 64, 12, "#8f563b"], [x + 12, FLOOR_Y - 60, 40, 60, "#73402c"], [x + 20, FLOOR_Y - 48, 24, 8, "#ffcd75"],
];

const floor = (fill: string, line: string, step = 32): Rect[] => [
  [0, FLOOR_Y, SCENE_W, SCENE_H - FLOOR_Y, fill],
  [0, FLOOR_Y, SCENE_W, 4, line],
  ...Array.from({ length: SCENE_W / step }, (_, i) => [i * step, FLOOR_Y + 4, 4, SCENE_H - FLOOR_Y, line] as Rect),
];

const questionMarks = (seed: number): ReactNode[] => {
  const rnd = seeded(seed);
  return Array.from({ length: 9 }, (_, i) => (
    <text key={`q${i}`} x={snap(40 + i * 104 + rnd() * 30)} y={snap(60 + rnd() * 150)} fontFamily="'Press Start 2P', monospace" fontSize={16 + snap(rnd() * 16)} fill="#5d275d">
      ?
    </text>
  ));
};

const SCENES: Record<SceneId, () => ReactNode> = {
  camp: () => (
    <>
      {rects([...bands(["#1a1c2c", "#22264a", "#29366f"], FLOOR_Y), ...stars(1, 70, 180), ...moon(860, 40)])}
      {rects([[0, FLOOR_Y - 40, SCENE_W, 40, "#333c57"], ...floor("#3b4a3a", "#2d3a2d", 48)])}
      {rects([...tent(140), ...tent(470), ...tent(800), ...campfire(300), ...campfire(640)])}
    </>
  ),
  observatory: () => (
    <>
      {rects([...bands(["#141221", "#1a1c2c", "#29366f", "#5d275d"], FLOOR_Y), ...stars(2, 120, 220)])}
      {rects([...moon(120, 36), [64, 36, 4, 4, "#ffcd75"]])}
      {rects([
        [700, 104, 96, 176, "#566c86"], [692, 96, 112, 12, "#333c57"], [716, 64, 64, 32, "#94b0c2"], [728, 56, 40, 8, "#94b0c2"],
        [740, 140, 16, 28, "#ffcd75"], [740, 200, 16, 28, "#ffcd75"], [770, 52, 40, 8, "#ffcd75"],
      ])}
      {rects(floor("#333c57", "#1a1c2c", 64))}
    </>
  ),
  mystery: () => (
    <>
      {rects(brickWall("#1a1c2c", "#141221", FLOOR_Y))}
      {questionMarks(3)}
      {rects([
        ...Array.from({ length: 10 }, (_, i) => [480 - 40 - i * 12, i * 28, 80 + i * 24, 28, "rgba(255,205,117,0.07)"] as Rect),
        ...floor("#141221", "#0d0b16", 64),
        [380, FLOOR_Y + 8, 200, 16, "rgba(255,205,117,0.15)"],
      ])}
    </>
  ),
  workshop: () => (
    <>
      {rects(brickWall("#8f563b", "#73402c", FLOOR_Y))}
      {rects([...archWindow(80, 40), ...archWindow(560, 40), ...easel(320), ...easel(760)])}
      {rects([[600, 200, 120, 8, "#5d3a1a"], [608, 184, 24, 16, "#41a6f6"], [640, 176, 16, 24, "#38b764"], [664, 188, 32, 12, "#ffcd75"]])}
      {rects(floor("#5d3a1a", "#3b2417", 40))}
    </>
  ),
  stage: () => (
    <>
      {rects([[0, 0, SCENE_W, FLOOR_Y, "#5d275d"], ...curtain(0, 160), ...curtain(800, 160), [0, 0, SCENE_W, 32, "#7a2034"]])}
      {rects([...Array.from({ length: 4 }, (_, i) => [200 + i * 160, 32, 80, 24, "rgba(255,205,117,0.25)"] as Rect)])}
      {rects([...lectern(300), ...lectern(600)])}
      {rects(floor("#8f563b", "#73402c", 24))}
    </>
  ),
  library: () => (
    <>
      {rects([[0, 0, SCENE_W, FLOOR_Y, "#29366f"], [0, 0, SCENE_W, 24, "#22264a"]])}
      {rects([...bookshelf(24, 4), ...bookshelf(232, 5), ...archWindow(452, 60), ...bookshelf(576, 6), ...bookshelf(784, 7)])}
      {rects(floor("#333c57", "#22264a", 48))}
    </>
  ),
};

export const SceneBackdrop = memo(({ scene }: { scene: SceneId }) => (
  <svg width={SCENE_W} height={SCENE_H} viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} shapeRendering="crispEdges" aria-hidden>
    {SCENES[scene]()}
  </svg>
));
SceneBackdrop.displayName = "SceneBackdrop";
