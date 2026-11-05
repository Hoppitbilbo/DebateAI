import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { htmlToText } from "@/lib/text";
import i18n from "@/i18n";
import type { WikiRef } from "@/lib/api";

/** The Wikipedia of an interface language ("en-US" → "en"); Italian for the others. */
export const wikiLanguage = (lng: string = i18n.language) => {
  const l = (lng || "it").slice(0, 2).toLowerCase();
  return ["it", "en", "es", "fr", "de"].includes(l) ? l : "it";
};

const wikiApi = (lang: string, query: string) =>
  `https://${lang}.wikipedia.org/w/api.php?action=query&redirects=1&format=json&origin=*&${query}`;

/** The first page of a Wikipedia query answer. */
const firstPage = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  return pages[Object.keys(pages)[0]];
};

/** The title of the same page on the `to` Wikipedia (language links), or null when it has none. */
const titleIn = async (title: string, from: string, to: string): Promise<string | null> => {
  const page = await firstPage(wikiApi(from, `prop=langlinks&lllang=${to}&titles=${encodeURIComponent(title)}`));
  const link: unknown = page?.langlinks?.[0]?.["*"];
  return typeof link === "string" && link ? link : null;
};

const extractOf = async (title: string, lang: string): Promise<string> =>
  (await firstPage(wikiApi(lang, `prop=extracts&exintro&explaintext&titles=${encodeURIComponent(title)}`)))?.extract ?? "";

/**
 * The intro of a page read on the `to` Wikipedia. A page with no counterpart
 * there, or a failed lookup, is read on the Wikipedia it came from.
 */
const loadExtract = async (title: string, from: string, to: string): Promise<string> => {
  if (from !== to) {
    const translated = await titleIn(title, from, to).catch(() => null);
    const text = translated ? await extractOf(translated, to).catch(() => "") : "";
    if (text) return text;
  }
  return extractOf(title, from);
};

// Whole extracts, by language and title: callers asking for different
// lengths share one download and each gets its own cut.
const cache = new Map<string, string>();

/** Which Wikipedia a title was chosen on, and which one to read its extract on. */
export interface WikiLanguages {
  /** Default: the interface's Wikipedia. */
  from?: string;
  /** Default: `from`. */
  to?: string;
}

/** Fetches the intro extract of a Wikipedia page (see WikiLanguages). */
export const fetchWikiSummary = async (title: string, maxChars = 4000, { from = wikiLanguage(), to = from }: WikiLanguages = {}): Promise<string> => {
  const key = `${from}>${to}:${title}`;
  if (cache.has(key)) return cache.get(key)!.slice(0, maxChars);
  const text = await loadExtract(title, from, to);
  cache.set(key, text);
  return text.slice(0, maxChars);
};

/**
 * Loads the summaries of the given characters, read on the Wikipedia of `lang`
 * (the activity's language; the interface's by default). Each title is looked
 * up from the Wikipedia it was chosen on (WikiRef.lang). `ready` once all are loaded.
 */
export const useWikiSummaries = (refs: (WikiRef | null | undefined)[], lang?: string) => {
  const ui = wikiLanguage(useTranslation().i18n.language);
  const to = lang || ui;
  // One "from:title" entry per character (titles never contain "|").
  const wanted = refs.filter((r): r is WikiRef => !!r?.title).map((r) => `${r.lang || ui}:${r.title}`).join("|");
  const [state, setState] = useState<{ summaries: Record<string, string>; loading: boolean; error: boolean }>({ summaries: {}, loading: false, error: false });

  useEffect(() => {
    const list = wanted ? wanted.split("|").map((entry) => [entry.slice(0, entry.indexOf(":")), entry.slice(entry.indexOf(":") + 1)]) : [];
    if (list.length === 0) {
      setState({ summaries: {}, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    Promise.all(list.map(async ([from, t]) => [t, await fetchWikiSummary(t, undefined, { from, to }).catch(() => "")] as const)).then((pairs) => {
      if (cancelled) return;
      const summaries = Object.fromEntries(pairs);
      setState({ summaries, loading: false, error: pairs.some(([, s]) => !s) });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, to]);

  return state;
};

/** Biography used in prompts: Wikipedia summary, falling back to the search snippet. */
export const bioOf = (ref: WikiRef | null | undefined, summaries: Record<string, string>) =>
  (ref && (summaries[ref.title] || htmlToText(ref.snippet ?? ""))) || "";
