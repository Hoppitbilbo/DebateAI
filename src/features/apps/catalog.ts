import { APPS, type AppMeta } from "@/features/activity/types";
import type { AppType } from "@/lib/api";

// Which apps each public page lists, and in which order. Paths and i18n keys
// come from APPS, so a new app is added there and named here.

/** Announced on the apps page, not open yet. */
export const UPCOMING_APP = { slug: "prompt-engineer", path: "/apps/prompt-engineer", i18nKey: "promptEngineer" } as const;

export type AppSlug = AppType | typeof UPCOMING_APP.slug;

/** A listed app: its catalog entry, or the upcoming one. */
export type ListedApp = Pick<AppMeta, "path" | "i18nKey"> & { slug: AppSlug; upcoming?: boolean };

/** An open app as listed on a page. */
export type OpenApp = AppMeta & { slug: AppType };

const listed = (type: AppType): OpenApp => ({ ...APPS[type], slug: type });
const upcoming: ListedApp = { ...UPCOMING_APP, upcoming: true };

/** Home page cards; the hero also picks one of these at random. */
export const HOME_APPS = (["you-moderate", "personaggio-misterioso", "doppia-intervista", "convinci-tu", "impersona-tu"] as const).map(listed);

/** Apps page cards. */
export const APPS_PAGE_APPS: ListedApp[] = [
  ...(["you-moderate", "doppia-intervista", "wiki-chatbot", "personaggio-misterioso"] as const).map(listed),
  upcoming,
  ...(["convinci-tu", "impersona-tu"] as const).map(listed),
];

/** Tutorials page cards. */
export const TUTORIAL_PAGE_APPS = (["you-moderate", "doppia-intervista", "convinci-tu", "personaggio-misterioso", "impersona-tu", "wiki-chatbot"] as const).map(listed);

