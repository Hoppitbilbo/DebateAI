// Word definitions from Wiktionary, for the chat's dictionary (P2). Free and
// with no AI cost: the page's plain-text extract is read and its first senses
// kept. Each Wiktionary lays its pages out its own way, so the parser knows
// the heading of the language section and the names of the parts of speech
// of the five interface languages and Portuguese; Latin words are read in the
// Latin section of the interface's Wiktionary.

/** Which Wiktionary to ask, and which language section of its pages to read. */
export interface DictionarySite {
  /** Subdomain of wiktionary.org, also the language of the headings. */
  host: string;
  /** Text found in the heading of the word's language section. */
  section: string;
}

interface HostLayout {
  /** The section of the host's own language, and of Latin. */
  self: string;
  latin: string;
  /** Headings of the parts of speech (prefixes). */
  pos: string[];
}

const LAYOUTS: Record<string, HostLayout> = {
  it: { self: "Italiano", latin: "Latino", pos: ["Sostantivo", "Aggettivo", "Verbo", "Voce verbale", "Avverbio", "Pronome", "Preposizione", "Congiunzione", "Interiezione", "Articolo", "Locuzione", "Nome proprio", "Participio"] },
  en: { self: "English", latin: "Latin", pos: ["Noun", "Verb", "Adjective", "Adverb", "Pronoun", "Preposition", "Conjunction", "Interjection", "Proper noun", "Phrase", "Determiner", "Article", "Participle", "Numeral"] },
  es: { self: "Español", latin: "Latín", pos: ["Sustantivo", "Adjetivo", "Verbo", "Forma", "Adverbio", "Pronombre", "Preposición", "Conjunción", "Interjección", "Locución", "Artículo"] },
  fr: { self: "Français", latin: "Latin", pos: ["Nom", "Adjectif", "Verbe", "Forme", "Adverbe", "Pronom", "Préposition", "Conjonction", "Interjection", "Locution", "Article", "Participe"] },
  de: { self: "(Deutsch)", latin: "(Latein)", pos: ["Substantiv", "Adjektiv", "Verb", "Adverb", "Pronomen", "Personalpronomen", "Präposition", "Konjunktion", "Interjektion", "Konjugierte Form", "Deklinierte Form", "Partizip", "Artikel", "Eigenname", "Redewendung"] },
  pt: { self: "Português", latin: "Latim", pos: ["Substantivo", "Adjetivo", "Verbo", "Forma verbal", "Advérbio", "Pronome", "Preposição", "Conjunção", "Interjeição", "Locução", "Artigo"] },
};

/**
 * The Wiktionary for words of the activity's language: its own, or for
 * languages without a usable one (Latin) the interface's, Italian by default.
 */
export const dictionarySite = (practiceCode: string, uiCode: string): DictionarySite => {
  if (LAYOUTS[practiceCode]) return { host: practiceCode, section: LAYOUTS[practiceCode].self };
  const host = LAYOUTS[uiCode] ? uiCode : "it";
  return { host, section: LAYOUTS[host].latin };
};

export interface Sense {
  /** The part of speech, as the page names it ("Sostantivo", "Noun"…). */
  pos: string;
  text: string;
}

/** Senses kept per part of speech, and in all. */
const SENSES_PER_POS = 3;
const MAX_SENSES = 5;

const HEADING = /^(=+)\s*(.+?)\s*\1$/;
/** "Sinónimos: …", "Synonyms: …": lists, not definitions. */
const LABEL = /^\p{Lu}[\p{L} ]{1,25}:/u;

/** German pages list their senses as "[1] …" under "Bedeutungen:". */
const germanSenses = (lines: string[]) => {
  const start = lines.findIndex((l) => l === "Bedeutungen:");
  if (start < 0) return [];
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("[")) break;
    out.push(line.replace(/^\[[^\]]*\]\s*/, ""));
  }
  return out;
};

/** The other layouts: the word's own line first, then one sense per line among examples and lists. */
const plainSenses = (lines: string[]) =>
  lines.slice(1).filter((l) =>
    !/^\d+$/.test(l) && // Spanish sense numbers
    !LABEL.test(l) &&
    !l.includes(" — (") && // French examples with their source
    !/^Exemple d’utilisation manquant/.test(l) &&
    !/https?:|www\./.test(l), // a source credit
  );

/** The first senses of a Wiktionary page's plain-text extract, in the site's language section. */
export const parseExtract = (extract: string, site: DictionarySite): Sense[] => {
  const layout = LAYOUTS[site.host];
  const lines = extract.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const heading = (i: number) => HEADING.exec(lines[i]);

  const start = lines.findIndex((_, i) => heading(i)?.[2].toLowerCase().includes(site.section.toLowerCase()));
  if (start < 0) return [];
  const level = heading(start)![1].length;
  let end = lines.findIndex((_, i) => i > start && (heading(i)?.[1].length ?? Infinity) <= level);
  if (end < 0) end = lines.length;

  const senses: Sense[] = [];
  for (let i = start + 1; i < end && senses.length < MAX_SENSES; i++) {
    const h = heading(i);
    if (!h || !layout.pos.some((p) => h[2].toLowerCase().startsWith(p.toLowerCase()))) continue;
    let stop = i + 1;
    while (stop < end && !heading(stop)) stop++;
    const block = lines.slice(i + 1, stop);
    const texts = site.host === "de" ? germanSenses(block) : plainSenses(block);
    for (const text of texts.slice(0, SENSES_PER_POS)) {
      if (senses.length < MAX_SENSES) senses.push({ pos: h[2], text });
    }
    i = stop - 1;
  }
  return senses;
};

export interface Definition {
  /** The page found (the word as tapped, or its lower-case form). */
  title: string;
  url: string;
  senses: Sense[];
}

/** The Wiktionary page of a word (also offered when nothing was found). */
export const wiktionaryUrl = (site: DictionarySite, title: string) => `https://${site.host}.wiktionary.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

const fetchExtract = async (site: DictionarySite, title: string): Promise<{ title: string; extract: string } | null> => {
  const url = `https://${site.host}.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiktionary ${res.status}`);
  const data = await res.json();
  const page = Object.values(data?.query?.pages ?? {})[0] as { title?: string; extract?: string; missing?: unknown } | undefined;
  if (!page || "missing" in page || !page.extract) return null;
  return { title: page.title ?? title, extract: page.extract };
};

/** The forms to try: as tapped, in lower case (start of a sentence), capitalised (German nouns). */
const candidates = (word: string) => [...new Set([word, word.toLowerCase(), word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()])];

const cache = new Map<string, Promise<Definition | null>>();

/**
 * The definition of a word on the site, or null when no page has senses in
 * its language section. Throws when Wiktionary cannot be reached.
 */
export const fetchDefinition = (word: string, site: DictionarySite): Promise<Definition | null> => {
  const key = `${site.host}|${site.section}|${word}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = (async () => {
      for (const form of candidates(word)) {
        const page = await fetchExtract(site, form);
        const senses = page ? parseExtract(page.extract, site) : [];
        if (page && senses.length) return { title: page.title, url: wiktionaryUrl(site, page.title), senses };
      }
      return null;
    })();
    // a failure is not remembered: the student can try again
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
};
