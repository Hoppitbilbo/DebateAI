import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { htmlToText } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { wikiLanguage } from "@/features/activity/wiki";
import { useTranslation } from "react-i18next";

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

interface WikiSearchApiResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
      pageid: number;
    }>;
  };
}

interface WikiSearchSelectProps {
  onSelect: (result: WikiSearchResult) => void;
}

/** Wait after the last keystroke before searching. */
const SEARCH_DEBOUNCE_MS = 500;

/** What the search list shows: nothing typed yet, a request, results (maybe none), or a failure. */
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; results: WikiSearchResult[] }
  | { status: "error" };

const searchWikipedia = async (term: string, lang: string, signal: AbortSignal): Promise<WikiSearchResult[]> => {
  const endpoint = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    term
  )}&format=json&origin=*&srlimit=10&srinfo=totalhits&srprop=snippet|titlesnippet`;
  const response = await fetch(endpoint, { signal });
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  const data: WikiSearchApiResponse = await response.json();
  return (data.query?.search ?? []).map((item) => ({
    title: item.title,
    snippet: htmlToText(item.snippet),
    pageid: item.pageid,
  }));
};

const WikiSearchSelect = ({ onSelect }: WikiSearchSelectProps) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0); // bumped by "Retry"
  const lang = wikiLanguage(i18n.language);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = inputValue.trim();
    pending.current?.abort(); // an older answer must never replace a newer one
    if (!term) {
      setState({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    const timer = setTimeout(() => {
      setState({ status: "loading" });
      searchWikipedia(term, lang, controller.signal).then(
        (results) => !controller.signal.aborted && setState({ status: "done", results }),
        (error) => {
          if (controller.signal.aborted) return;
          console.error("Wikipedia search failed:", error);
          setState({ status: "error" });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue, lang, attempt]);

  const message = (text: string) => <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-muted-foreground"
        >
          {t('common.searchHistoricalCharacter')}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        {/* The results come from Wikipedia already ranked: no local filtering on top. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('common.searchOnWikipedia')}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList aria-busy={state.status === "loading"}>
            {state.status === "idle" && message(t('common.typeToSearch'))}
            {state.status === "loading" && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label={t('common.loading')} />
              </div>
            )}
            {state.status === "error" && (
              <div role="alert" className="flex flex-col items-center gap-2 py-6 text-center text-sm">
                <p className="text-destructive">{t('common.searchFailed')}</p>
                <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>{t('common.retry')}</Button>
              </div>
            )}
            {state.status === "done" && state.results.length === 0 && message(t('common.noResultsFound'))}
            {state.status === "done" && state.results.length > 0 && (
              <CommandGroup>
                {state.results.map((result) => (
                  <CommandItem
                    key={result.pageid}
                    value={String(result.pageid)}
                    onSelect={() => {
                      onSelect(result);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {result.snippet + "..."}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WikiSearchSelect;
