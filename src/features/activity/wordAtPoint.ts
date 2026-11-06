// The word under a tap or click, for the chat's dictionary: the browser finds
// the text position at the point, a Unicode pattern the word around it. The
// practice languages all use the Latin alphabet, so letters, accents and inner
// apostrophes are enough (and work in every browser, unlike Intl.Segmenter).

/** Letters and digits, with inner apostrophes ("don't", "l'intelletto"). */
const WORD = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

/** Italian and French elide articles and prepositions: "l'intelletto" is looked up as "intelletto". */
const ELIDING = new Set(["it", "fr"]);
const ELISION = /^\p{L}{1,5}['’](?=\p{L})/u;

/** The bounds of the word that contains `offset`, or null when it falls between words. */
export const wordAround = (text: string, offset: number, lang?: string): { start: number; end: number } | null => {
  for (const m of text.matchAll(WORD)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (start > offset) break;
    if (offset <= end && /\p{L}/u.test(m[0])) {
      const elided = lang && ELIDING.has(lang) ? ELISION.exec(m[0])?.[0].length ?? 0 : 0;
      return { start: start + elided, end };
    }
  }
  return null;
};

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

const caretAt = (x: number, y: number): { node: Node; offset: number } | null => {
  const doc = document as CaretDocument;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    return p && { node: p.offsetNode, offset: p.offset };
  }
  const r = doc.caretRangeFromPoint?.(x, y);
  return r ? { node: r.startContainer, offset: r.startOffset } : null;
};

/** The word at a point of the page with its box, or null outside text or between words. */
export const wordAtPoint = (x: number, y: number, lang?: string): { word: string; rect: DOMRect } | null => {
  const caret = caretAt(x, y);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return null;
  const text = caret.node.textContent ?? "";
  const bounds = wordAround(text, caret.offset, lang);
  if (!bounds) return null;
  const range = document.createRange();
  range.setStart(caret.node, bounds.start);
  range.setEnd(caret.node, bounds.end);
  const rect = range.getBoundingClientRect();
  // the caret snaps to the nearest text: a tap in the margin is not on the word
  if (x < rect.left - 2 || x > rect.right + 2 || y < rect.top - 2 || y > rect.bottom + 2) return null;
  return { word: text.slice(bounds.start, bounds.end), rect };
};
