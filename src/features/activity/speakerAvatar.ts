import type { ActivityMessage } from "./types";

/** What an AI speaker without a Wikipedia picture looks like: a person or a page. */
export type AvatarFallback = "person" | "page";

/** Name of the hidden character in Personaggio misterioso: never looked up, so it is never revealed. */
export const MYSTERY_NAME = "???";
/** Name shown for an AI reply with no character. */
export const GENERIC_AI_NAME = "AI";

const FALLBACK_ICONS = {
  student: "/avatars/student-cap.webp",
  mystery: "/avatars/mystery.webp",
  person: "/avatars/unknown-person.webp",
  page: "/avatars/page.webp",
} as const;

/** The Wikipedia page whose portrait stands for the speaker, if the name is one. */
export const wikiTitleOf = (name?: string) => (name && name !== MYSTERY_NAME && name !== GENERIC_AI_NAME ? name : undefined);

/** The Icons8 picture used while there is no portrait (or when the page has none). */
export const fallbackIcon = (name: string | undefined, role: ActivityMessage["role"], fallback: AvatarFallback) => {
  if (name === MYSTERY_NAME) return FALLBACK_ICONS.mystery;
  if (role === "user" && !wikiTitleOf(name)) return FALLBACK_ICONS.student;
  return FALLBACK_ICONS[fallback];
};
