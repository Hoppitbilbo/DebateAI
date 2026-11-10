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
  pt: { self: "Português", latin: "Latim", pos: ["Substantivo", "Adjetivo", "Verbo", "Forma", "Numeral", "Advérbio", "Pronome", "Preposição", "Conjunção", "Interjeição", "Locução", "Artigo"] },
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

/**
 * German pages list their senses as "[1] …" under "Bedeutungen:". An
 * inflected form ("seinen", "gewidmet") has none: its grammar note
 * ("Grammatische Merkmale:") says which form of which word it is.
 */
const germanSenses = (lines: string[]) => {
  const start = lines.findIndex((l) => l === "Bedeutungen:");
  if (start < 0) {
    const note = lines.findIndex((l) => l === "Grammatische Merkmale:");
    if (note < 0) return [];
    const rest = lines.slice(note + 1);
    const stop = rest.findIndex((l) => l.endsWith(":"));
    return stop < 0 ? rest : rest.slice(0, stop);
  }
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("[")) break;
    out.push(line.replace(/^\[[^\]]*\]\s*/, ""));
  }
  return out;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The other layouts: the word's own line first, then one sense per line among
 * examples and lists. An example uses the word ("Ha fatto un'affermazione…"),
 * a definition hardly ever does: lines with the word itself are skipped,
 * unless there is no other (a number is defined by its name: "o número quatro").
 */
const plainSenses = (lines: string[], headword: string) => {
  const uses = headword ? new RegExp(`(?<![\\p{L}])${escapeRegExp(headword)}(?![\\p{L}])`, "iu") : null;
  const candidates = lines.slice(1).filter((l) =>
    !/^\d+$/.test(l) && // Spanish sense numbers
    !LABEL.test(l) &&
    !l.includes(" — (") && // French examples with their source
    !/^Exemple d’utilisation manquant/.test(l) &&
    !l.startsWith("→") && // notes of the page's templates ("→ Etimologia mancante")
    !/https?:|www\./.test(l), // a source credit
  );
  const senses = candidates.filter((l) => !uses?.test(l));
  return senses.length ? senses : candidates;
};

/** The first senses of a Wiktionary page's plain-text extract (of `headword`), in the site's language section. */
export const parseExtract = (extract: string, site: DictionarySite, headword = ""): Sense[] => {
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
    // Nothing under the heading but a deeper one (Italian verbs: "Verbo" then
    // "Transitivo"): the senses are in that sub-section.
    let from = i + 1;
    if (from < end && (heading(from)?.[1].length ?? 0) > h[1].length) from++;
    let stop = from;
    while (stop < end && !heading(stop)) stop++;
    const block = lines.slice(from, stop);
    const texts = site.host === "de" ? germanSenses(block) : plainSenses(block, headword);
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

/**
 * The forms to try: lower case first (a capital at the start of a sentence is
 * not a name: "Verissimo" is the adjective, not the first name), then as
 * tapped (names), then capitalised (German nouns typed in lower case). In
 * German the capital is the noun's: "Himmel" as tapped comes first, or the
 * student would read a form of the verb "himmeln".
 */
const candidates = (word: string, host: string) => {
  const lower = word.toLowerCase();
  const capitalised = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return [...new Set(host === "de" ? [word, lower, capitalised] : [lower, word, capitalised])];
};

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
      for (const form of candidates(word, site.host)) {
        const page = await fetchExtract(site, form);
        const senses = page ? parseExtract(page.extract, site, page.title) : [];
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
