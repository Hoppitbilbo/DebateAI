import { preloadPath } from "@/lib/lazyPage";

// Pages are downloaded when the user shows the intent to open them (pointer
// over, focus or touch on a link), not all at once on every visit: a school
// network or a phone should not fetch six activities to show the home page.
// With Save-Data on, hovering is not enough.

/** The internal path an element leads to: a link's href or data-preload. */
export const intendedPath = (target: EventTarget | null): string | null => {
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>("a[href], [data-preload]");
  if (!el) return null;
  const path = el.dataset.preload ?? el.getAttribute("href") ?? "";
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
};

const saveData = () => (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/** Starts preloading on intent; returns the cleanup. */
export const preloadOnIntent = (root: Document = document) => {
  const onIntent = (e: Event) => {
    if (e.type === "pointerover" && ((e as PointerEvent).pointerType !== "mouse" || saveData())) return;
    const path = intendedPath(e.target);
    if (path) void preloadPath(path);
  };
  const events = ["pointerover", "focusin", "touchstart"] as const;
  for (const type of events) root.addEventListener(type, onIntent, { passive: true });
  return () => {
    for (const type of events) root.removeEventListener(type, onIntent);
  };
};
