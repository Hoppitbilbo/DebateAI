import { memo } from "react";
import { toPaths, type Grid, type Palette } from "./pixelGrid";

export type { Grid, Palette } from "./pixelGrid";

interface PixelSpriteProps {
  grid: Grid;
  palette: Palette;
  /** Size of one art pixel in stage pixels. */
  px: number;
  flip?: boolean;
  className?: string;
}

export const PixelSprite = memo(({ grid, palette, px, flip, className }: PixelSpriteProps) => {
  const w = grid[0]?.length ?? 0;
  const h = grid.length;
  return (
    <svg
      width={w * px}
      height={h * px}
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      {toPaths(grid, palette).map((p) => (
        <path key={p.fill} fill={p.fill} d={p.d} />
      ))}
    </svg>
  );
});
PixelSprite.displayName = "PixelSprite";
