// Where the tour card goes: next to the highlighted element, never off screen.

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Space between the element and the spotlight border. */
export const SPOTLIGHT_PADDING = 8;
/** Space between the spotlight and the card, and the card and the screen edge. */
const GAP = 14;
const EDGE = 16;
const CARD_WIDTH = 360;
/** Below this width the card is docked to the top or bottom of the screen. */
const NARROW_SCREEN = 640;

export const cardWidth = (viewportWidth: number) => Math.min(CARD_WIDTH, viewportWidth - 2 * EDGE);

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Top-left corner of a card of the given height for a target box (null:
 * centred). Prefers below the target, then above, then the side with more room.
 */
export const placeCard = (target: Box | null, cardHeight: number, viewport: { width: number; height: number }) => {
  const width = cardWidth(viewport.width);
  const maxTop = viewport.height - cardHeight - EDGE;
  if (!target) return { left: (viewport.width - width) / 2, top: clamp((viewport.height - cardHeight) / 2, EDGE, maxTop) };

  const below = target.top + target.height + SPOTLIGHT_PADDING + GAP;
  const above = target.top - SPOTLIGHT_PADDING - GAP - cardHeight;
  if (viewport.width < NARROW_SCREEN) {
    const targetInLowerHalf = target.top + target.height / 2 > viewport.height / 2;
    return { left: EDGE, top: targetInLowerHalf ? EDGE : maxTop };
  }
  const left = clamp(target.left + target.width / 2 - width / 2, EDGE, viewport.width - width - EDGE);
  if (below + cardHeight <= viewport.height - EDGE) return { left, top: below };
  if (above >= EDGE) return { left, top: above };
  const roomBelow = viewport.height - (target.top + target.height);
  return { left, top: roomBelow > target.top ? maxTop : EDGE };
};
