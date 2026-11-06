import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, ExternalLink, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { fetchDefinition, wiktionaryUrl, type Definition, type DictionarySite } from "../wiktionary";

export interface DictionaryHandle {
  /** Opens the dictionary on a word tapped in the chat, next to it. */
  lookUp: (word: string, rect: DOMRect) => void;
}

type Lookup = { status: "idle" } | { status: "loading" } | { status: "done"; definition: Definition | null } | { status: "error" };

/** The definition of `word` on the site, looked up again when either changes. */
const useDefinition = (word: string, site: DictionarySite): Lookup => {
  const [state, setState] = useState<Lookup>({ status: "idle" });
  useEffect(() => {
    if (!word) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetchDefinition(word, site).then(
      (definition) => !cancelled && setState({ status: "done", definition }),
      () => !cancelled && setState({ status: "error" }),
    );
    return () => {
      cancelled = true;
    };
  }, [word, site]);
  return state;
};

/**
 * The chat's dictionary (P2): a button that opens a search, and the same
 * popover next to a word the student taps in a character's message.
 * Definitions come from Wiktionary (wiktionary.ts).
 */
const Dictionary = forwardRef<DictionaryHandle, { site: DictionarySite }>(function Dictionary({ site }, ref) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [query, setQuery] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // Where the popover points: the tapped word, or the button.
  const anchorRect = useRef<DOMRect | null>(null);
  const anchor = useRef({ getBoundingClientRect: () => anchorRect.current ?? button.current?.getBoundingClientRect() ?? new DOMRect() });
  const fromTap = useRef(false);
  const lookup = useDefinition(word, site);

  useImperativeHandle(ref, () => ({
    lookUp: (w, rect) => {
      anchorRect.current = rect;
      fromTap.current = true;
      setWord(w);
      setQuery(w);
      setOpen(true);
    },
  }), []);

  const openSearch = () => {
    anchorRect.current = null;
    fromTap.current = false;
    setOpen(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setWord(query.trim());
  };

  const sourceUrl = lookup.status === "done" && lookup.definition ? lookup.definition.url : word ? wiktionaryUrl(site, word) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor virtualRef={anchor} />
      <Button ref={button} type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={openSearch} title={t("platform.dictionary.tapHint")}>
        <BookOpen className="mr-1.5 h-3.5 w-3.5" />
        {t("platform.dictionary.open")}
      </Button>
      <PopoverContent
        className="w-80 max-w-[90vw]"
        aria-label={t("platform.dictionary.open")}
        // After a tap the phone keyboard must not pop up: focus the popover, not the search box.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (fromTap.current ? (e.currentTarget as HTMLElement) : input.current)?.focus();
        }}
        tabIndex={-1}
      >
        <form onSubmit={submit} className="flex gap-2" role="search">
          <Input ref={input} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("platform.dictionary.searchLabel")} placeholder={t("platform.dictionary.searchLabel")} className="h-8" />
          <Button type="submit" size="sm" className="h-8" disabled={!query.trim()} aria-label={t("platform.dictionary.search")}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-3 max-h-64 overflow-y-auto text-sm" aria-live="polite">
          {lookup.status === "idle" && <p className="text-muted-foreground">{t("platform.dictionary.tapHint")}</p>}
          {lookup.status === "loading" && (
            <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("platform.dictionary.loading")}</p>
          )}
          {lookup.status === "error" && <p className="text-destructive">{t("platform.dictionary.error")}</p>}
          {lookup.status === "done" && !lookup.definition && <p className="text-muted-foreground">{t("platform.dictionary.notFound", { word })}</p>}
          {lookup.status === "done" && lookup.definition && (
            <>
              <p className="font-semibold">{lookup.definition.title}</p>
              <ol className="mt-1 space-y-1.5">
                {lookup.definition.senses.map((s, i) => (
                  <li key={i}>
                    <span className="mr-1.5 text-xs uppercase tracking-wide text-muted-foreground">{s.pos}</span>
                    {s.text}
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
            {t("platform.dictionary.source")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
});

export default Dictionary;
