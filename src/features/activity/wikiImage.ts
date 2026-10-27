import { useEffect, useState } from "react";
import i18n from "@/i18n";

const THUMB_SIZE = 96;

const wikiLang = () => {
  const l = (i18n.language || "it").slice(0, 2);
  return ["it", "en", "es", "fr", "de"].includes(l) ? l : "it";
};

// One request per page and language, shared by every bubble that shows it.
const cache = new Map<string, Promise<string | null>>();

/** The lead image of a Wikipedia page (its portrait for a person), or null when it has none. */
export const fetchWikiImage = (title: string): Promise<string | null> => {
  const lang = wikiLang();
  const key = `${lang}:${title}`;
  let pending = cache.get(key);
  if (!pending) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_SIZE}&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
    pending = fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const pages = data?.query?.pages ?? {};
        const first = pages[Object.keys(pages)[0]];
        return (first?.thumbnail?.source as string | undefined) ?? null;
      })
      .catch(() => null);
    cache.set(key, pending);
  }
  return pending;
};

/** `undefined` while loading, then the image URL or null. Skipped when `title` is empty. */
export const useWikiImage = (title: string | undefined) => {
  const [src, setSrc] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!title || typeof fetch === "undefined") {
      setSrc(null);
      return;
    }
    let cancelled = false;
    setSrc(undefined);
    void fetchWikiImage(title).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [title]);
  return src;
};
