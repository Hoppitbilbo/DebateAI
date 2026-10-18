import { useEffect, useState } from "react";
import i18n from "@/i18n";
import type { WikiRef } from "@/lib/api";

const wikiLang = () => {
  const l = (i18n.language || "it").slice(0, 2);
  return ["it", "en", "es", "fr", "de"].includes(l) ? l : "it";
};

const cache = new Map<string, string>();

/** Fetches the intro extract of a Wikipedia page in the UI language. */
export const fetchWikiSummary = async (title: string, maxChars = 4000): Promise<string> => {
  const lang = wikiLang();
  const key = `${lang}:${title}`;
  if (cache.has(key)) return cache.get(key)!;
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  const first = pages[Object.keys(pages)[0]];
  const text: string = (first?.extract ?? "").slice(0, maxChars);
  cache.set(key, text);
  return text;
};

/** Loads summaries for the given characters; `ready` once all are loaded. */
export const useWikiSummaries = (refs: (WikiRef | null | undefined)[]) => {
  const titles = refs.map((r) => r?.title ?? "").join("|");
  const [state, setState] = useState<{ summaries: Record<string, string>; loading: boolean; error: boolean }>({ summaries: {}, loading: false, error: false });

  useEffect(() => {
    const list = titles.split("|").filter(Boolean);
    if (list.length === 0) {
      setState({ summaries: {}, loading: false, error: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: false }));
    Promise.all(list.map(async (t) => [t, await fetchWikiSummary(t).catch(() => "")] as const)).then((pairs) => {
      if (cancelled) return;
      const summaries = Object.fromEntries(pairs);
      setState({ summaries, loading: false, error: pairs.some(([, s]) => !s) });
    });
    return () => {
      cancelled = true;
    };
  }, [titles]);

  return state;
};

/** Biography used in prompts: Wikipedia summary, falling back to the search snippet. */
export const bioOf = (ref: WikiRef | null | undefined, summaries: Record<string, string>) =>
  (ref && (summaries[ref.title] || ref.snippet)) || "";
