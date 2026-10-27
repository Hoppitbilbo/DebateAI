/** Apps that have their own picture pair (Icons8): an icon and a hand-drawn scene. */
export type AppArtSlug =
  | "you-moderate"
  | "personaggio-misterioso"
  | "doppia-intervista"
  | "convinci-tu"
  | "impersona-tu"
  | "wiki-chatbot"
  | "prompt-engineer";

/** The slug of an app route such as `/apps/convinci-tu`. */
export const appArtSlug = (link: string) => link.split("/").pop() as AppArtSlug;

// Scenes drawn in-house as animated SVG (Icons8 has no courtroom or split screen in this style).
const SVG_SCENES: ReadonlySet<AppArtSlug> = new Set(["you-moderate", "doppia-intervista"]);

/** The hand-drawn scene that rises behind the app icon. */
export const appSceneSrc = (slug: AppArtSlug) =>
  `/illustrations/apps/${slug}.${SVG_SCENES.has(slug) ? "svg" : "webp"}`;
