import i18n from "@/i18n";
import type { AppType, AssignmentConfig, WikiRef } from "@/lib/api";
import type { AiClient } from "@/services/aiClient";
import { fetchWikiSummary } from "@/features/activity/wiki";
import { uiLanguage } from "@/features/activity/prompts";
import { APP_TYPES } from "@/features/activity/appCatalog";

// Related activities for a room's path. From the theme a teacher chose
// (e.g. "Albert Einstein" as mystery character) we read the Wikipedia page
// and the pages its introduction links to, and ask the model for a few
// activities built only on those pages, so every suggested character is a
// real, existing page the activities can load.

export interface Suggestion {
  appType: AppType;
  title: string;
  /** One line for the teacher: why it fits the theme. */
  why: string;
  config: AssignmentConfig;
}

/** What the model may answer with, before checking it. */
interface RawSuggestion {
  appType?: string;
  title?: string;
  why?: string;
  characters?: string[];
  topic?: string;
}

/** Links read from the lead of the page, and how many we pass to the model. */
const MAX_LINKS = 80;
/** Suggestions shown at once. */
export const MAX_SUGGESTIONS = 4;

const wikiLang = () => {
  const l = (i18n.language || "it").slice(0, 2);
  return ["it", "en", "es", "fr", "de"].includes(l) ? l : "it";
};

/** Dates, years and lists are no characters nor topics. */
const usefulLink = (title: string) => !/^\d/.test(title) && !/^(Lista|List|Liste|Anexo)/i.test(title);

/** The articles linked from the introduction of a Wikipedia page, the most related to it. */
export const fetchLeadLinks = async (title: string): Promise<string[]> => {
  const url = `https://${wikiLang()}.wikipedia.org/w/api.php?action=parse&prop=links&section=0&redirects=1&format=json&formatversion=2&origin=*&page=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data = await res.json();
  const links: { ns: number; title: string; exists?: boolean }[] = data?.parse?.links ?? [];
  const titles = links.filter((l) => l.ns === 0 && l.exists !== false && usefulLink(l.title)).map((l) => l.title);
  return [...new Set(titles)].slice(0, MAX_LINKS);
};

/** How many characters each app takes from a suggestion. */
const CHARACTERS: Record<AppType, { min: number; max: number }> = {
  "personaggio-misterioso": { min: 1, max: 3 },
  "doppia-intervista": { min: 2, max: 2 },
  "you-moderate": { min: 2, max: 2 },
  "convinci-tu": { min: 1, max: 1 },
  "impersona-tu": { min: 2, max: 2 },
  "wiki-chatbot": { min: 1, max: 1 },
};

const NEEDS_TOPIC: ReadonlySet<AppType> = new Set(["convinci-tu", "impersona-tu", "you-moderate"]);

/** The settings of an app built from a suggestion's characters and topic. */
const configFor = (app: AppType, refs: WikiRef[], topic?: string): AssignmentConfig => {
  switch (app) {
    case "personaggio-misterioso":
      return refs.length > 1 ? { characters: refs, shuffle: true } : { character: refs[0] };
    case "doppia-intervista":
      return { characters: refs };
    case "you-moderate":
      return { characters: refs, topic };
    case "impersona-tu":
      return { userCharacter: refs[0], aiCharacter: refs[1], topic };
    default:
      return { character: refs[0], topic };
  }
};

/**
 * Keeps the suggestions that can really be played: a known app, a title, the
 * right number of characters, all of them among the allowed pages (written
 * as the page title, whatever the case the model used), a topic when the app
 * needs one. Never the same app with the same characters twice.
 */
export const checkSuggestions = (raw: RawSuggestion[] | undefined, allowed: string[]): Suggestion[] => {
  const pages = new Map(allowed.map((t) => [t.toLowerCase(), t]));
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const r of raw ?? []) {
    const app = r.appType as AppType;
    if (!APP_TYPES.includes(app) || !r.title?.trim()) continue;
    const titles = (r.characters ?? []).map((c) => pages.get(String(c).trim().toLowerCase())).filter((t): t is string => !!t);
    const unique = [...new Set(titles)].slice(0, CHARACTERS[app].max);
    if (unique.length < CHARACTERS[app].min) continue;
    const topic = r.topic?.trim();
    if (NEEDS_TOPIC.has(app) && !topic) continue;
    const key = `${app}:${unique.join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ appType: app, title: r.title.trim(), why: r.why?.trim() ?? "", config: configFor(app, unique.map((title) => ({ title })), topic) });
  }
  return out.slice(0, MAX_SUGGESTIONS);
};

const APP_GUIDE = `Apps (appType: what the student does; characters it needs):
- "personaggio-misterioso": guesses a hidden character by asking questions; 1-3 characters (played in turn).
- "doppia-intervista": interviews two characters at once and compares their answers; exactly 2 characters.
- "convinci-tu": tries to convince one character of an idea (topic); 1 character + topic.
- "impersona-tu": plays characters[0] and talks with characters[1] about a topic; 2 characters + topic.
- "you-moderate": moderates a debate between two characters on a topic; 2 characters + topic.
- "wiki-chatbot": talks with a page of Wikipedia (a person, place, event or concept); 1 page.`;

/**
 * Asks the model for activities related to the theme. `seed` are the pages
 * the teacher already chose; they may appear in the suggestions too.
 */
export const suggestActivities = async (ai: AiClient, seed: { appType: AppType; pages: string[] }, exclude: AppType[] = []): Promise<Suggestion[]> => {
  const main = seed.pages[0];
  const [links, summary] = await Promise.all([fetchLeadLinks(main), fetchWikiSummary(main, 1500).catch(() => "")]);
  const allowed = [...new Set([...seed.pages, ...links])];
  const res = await ai.generateJSON<{ suggestions?: RawSuggestion[] }>({
    task: "utility",
    system: `You help a teacher build a short path of school activities with AI characters around a theme.
${APP_GUIDE}
Suggest ${MAX_SUGGESTIONS + 2} varied activities related to the theme, mostly with apps different from the one already chosen, each one engaging for students aged 11-18.
Use as characters ONLY titles copied exactly from the list of allowed pages; pick real people for every app except wiki-chatbot.
Write "title" (max 6 words), "why" (one sentence) and "topic" (a debatable idea or question, when needed) in ${uiLanguage()}.
Answer with JSON: {"suggestions":[{"appType":"...","title":"...","why":"...","characters":["..."],"topic":"..."}]}`,
    messages: [{
      role: "user",
      content: `Theme: ${seed.pages.join(", ")} (already chosen for "${seed.appType}"; avoid: ${exclude.join(", ") || "none"})
About it: ${summary.slice(0, 1200)}
Allowed pages: ${allowed.join(" | ")}`,
    }],
  });
  return checkSuggestions(res.suggestions, allowed);
};
