import type { AppSlug } from "@/features/apps/catalog";

// Scenes drawn in-house as animated SVG (Icons8 has no courtroom or split screen in this style).
const SVG_SCENES: ReadonlySet<AppSlug> = new Set(["you-moderate", "doppia-intervista"]);

/** The hand-drawn scene that rises behind the app icon. */
export const appSceneSrc = (slug: AppSlug) =>
  `/illustrations/apps/${slug}.${SVG_SCENES.has(slug) ? "svg" : "webp"}`;

/** The Icons8 icon that tells what the app does. */
export const appIconSrc = (slug: AppSlug) => `/icons/apps/${slug}.webp`;
