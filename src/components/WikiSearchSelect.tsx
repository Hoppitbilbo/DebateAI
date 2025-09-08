/**
 * @file Provides a component for searching and selecting a character from Wikipedia.
 * @remarks This component features a debounced search input that queries the Wikipedia API
 * and displays the results in a popover. It is used across various educational activities
 * to allow users to choose a historical figure to interact with.
 */

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

/**
 * @interface WikiSearchResult
 * @description Represents a single search result from the Wikipedia API.
 * @property {string} title - The title of the Wikipedia article.
 * @property {string} snippet - A short summary of the article.
 * @property {number} pageid - The unique ID of the Wikipedia page.
 */
interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

/**
 * @interface WikiSearchSelectProps
 * @description Defines the props for the WikiSearchSelect component.
 * @property {(result: WikiSearchResult) => void} onSelect - Callback function that is triggered when a user selects a character from the search results.
 */
interface WikiSearchSelectProps {
  onSelect: (result: WikiSearchResult) => void;
}

/**
 * @function WikiSearchSelect
 * @description A reusable component that allows users to search Wikipedia for a character
 * and select one from the results. It handles API calls, loading states, and debouncing.
 * @param {WikiSearchSelectProps} props - The props for the component.
 * @returns {JSX.Element} The rendered Wikipedia search and select component.
 */
const WikiSearchSelect = ({ onSelect }: WikiSearchSelectProps) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [searchResults, setSearchResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * @function getWikipediaLanguageCode
   * @description Determines the appropriate Wikipedia language code based on the current i18n language setting.
   * @returns {string} The two-letter language code for the Wikipedia API (e.g., 'it', 'en').
   */
  const getWikipediaLanguageCode = () => {
    const langMap: { [key: string]: string } = {
      'it': 'it',
      'en': 'en', 
      'es': 'es',
      'fr': 'fr',
      'de': 'de'
    };
    return langMap[i18n.language] || 'it';
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (inputValue) {
        handleSearch(inputValue);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [inputValue]);

  /**
   * @function handleSearch
   * @description Fetches search results from the Wikipedia API based on the user's search term.
   * @param {string} searchTerm - The term to search for.
   */
  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const wikiLang = getWikipediaLanguageCode();
      const endpoint = `https://${wikiLang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        searchTerm
      )}&format=json&origin=*&srlimit=10&srinfo=totalhits&srprop=snippet|titlesnippet`;
      
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Errore nella ricerca Wikipedia");
      
      const data = await response.json();
      
      const results: WikiSearchResult[] = data.query.search.map((item: any) => ({
        title: item.title,
        snippet: item.snippet.replace(/<\/?[^>]+(>|$)/g, ""),
        pageid: item.pageid,
      }));
      
      setSearchResults(results);
    } catch (error) {
      console.error("Errore nella ricerca:", error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value
            ? searchResults.find((result) => result.title === value)?.title
            : t('common.searchHistoricalCharacter')}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput
            placeholder={t('common.searchOnWikipedia')}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty className="text-education">{t('common.noResultsFound')}</CommandEmpty>
                <CommandGroup>
                  {searchResults.map((result) => (
                    <CommandItem
                      key={result.pageid}
                      value={result.title}
                      onSelect={() => {
                        setValue(result.title);
                        onSelect(result);
                        setOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{result.title}</span>
                        <span className="text-xs text-education">
                          {result.snippet + "..."}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default WikiSearchSelect;
