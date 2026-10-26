import { useCallback, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { preloadPath } from "@/lib/lazyPage";

// Page changes as a morph (View Transitions API): the new page is loaded
// first, then the browser animates from the old page to the new one. Elements
// with the same view-transition-name on both pages (an app card and the app's
// header) glide into each other; everything else slides sideways.

/** Longest wait for a page's code or render before navigating anyway. */
const MAX_WAIT_MS = 1500;

type DocumentWithTransitions = Document & { startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> } };

let settlePending: (() => void) | null = null;

/** Called once the new page is on screen (see MorphGate). */
export const settleMorph = () => {
  settlePending?.();
  settlePending = null;
};

/** The app a path belongs to ("/apps/convinci-tu" → "convinci-tu"). */
const appOf = (path: string) => path.match(/^\/apps\/([^/?#]+)/)?.[1] ?? null;

/**
 * Pairs the card and title of one app on the current page (marked with
 * appMorph) for the morph. Only the app being opened or left is paired, so
 * the other cards slide away with the page.
 */
const pairApp = (app: string | null, on: boolean) => {
  if (!app) return;
  document.querySelectorAll<HTMLElement>(`[data-morph-app="${app}"]`).forEach((el) => {
    const part = el.dataset.morph;
    el.style.setProperty("view-transition-name", on ? `app-${part}-${app}` : "");
  });
};

const canMorph = () =>
  typeof document !== "undefined" &&
  !!(document as DocumentWithTransitions).startViewTransition &&
  !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** navigate() with a morph, when the browser supports it. */
export const useMorphNavigate = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(
    async (to: string) => {
      if (to === pathname) return;
      await Promise.race([preloadPath(to), wait(MAX_WAIT_MS)]);
      if (!canMorph()) {
        navigate(to);
        return;
      }
      const app = appOf(to) ?? appOf(pathname);
      pairApp(app, true);
      const transition = (document as DocumentWithTransitions).startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            settlePending = () => {
              pairApp(app, true); // the same app on the new page
              resolve();
            };
            setTimeout(settleMorph, MAX_WAIT_MS);
            navigate(to);
          }),
      );
      void transition.finished.finally(() => pairApp(app, false));
    },
    [navigate, pathname],
  );
};

/** onClick for a Link or NavLink: same navigation, with the morph (new-tab clicks are left alone). */
export const useMorphClick = () => {
  const morphTo = useMorphNavigate();
  return useCallback(
    (to: string, then?: () => void) => (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      then?.();
      void morphTo(to);
    },
    [morphTo],
  );
};

/** Marks an app's card (or its title) so that it can morph into the app's page header. */
export const appMorph = (appPath: string, part: "card" | "title") => ({
  "data-morph-app": appOf(appPath) ?? undefined,
  "data-morph": part,
});
