import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface ModelInfo { id: string; name?: string; inputPerM?: number; outputPerM?: number; free: boolean; supportLive?: boolean }

const price = (m: ModelInfo) =>
  m.inputPerM === undefined || m.outputPerM === undefined ? "" : `$${m.inputPerM.toFixed(2)} / $${m.outputPerM.toFixed(2)}`;

/**
 * Searchable model selector fed by the provider's model list (OpenRouter,
 * OpenCode, Gemini, Ollama…). Free models first, optional "free only" filter,
 * and any custom id can still be typed.
 */
const ModelPicker = ({ models, value, onChange, className, liveOnly }: {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /** Show only models that support the Live API (Gemini). */
  liveOnly?: boolean;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);

  const list = useMemo(() => {
    let l = liveOnly && models.some((m) => m.supportLive) ? models.filter((m) => m.supportLive) : models;
    if (freeOnly) l = l.filter((m) => m.free);
    return [...l].sort((a, b) => Number(b.free) - Number(a.free) || a.id.localeCompare(b.id));
  }, [models, freeOnly, liveOnly]);

  const freeCount = models.filter((m) => m.free).length;
  const current = models.find((m) => m.id === value);
  const q = query.trim();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className={cn("h-9 justify-between font-mono text-xs font-normal", className)}>
          <span className="truncate">
            {value || t("platform.admin.ai.pickModel")}
            {current?.free && <span className="ml-2 text-primary">· {t("platform.admin.ai.free")}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,460px)] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={t("platform.admin.ai.searchModels", { count: models.length })} value={query} onValueChange={setQuery} />
          <label className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 text-xs">
            <span>{t("platform.admin.ai.onlyFree", { count: freeCount })}</span>
            <Switch checked={freeOnly} onCheckedChange={setFreeOnly} />
          </label>
          <CommandList className="max-h-72">
            <CommandEmpty>{t("platform.admin.ai.noModelsMatch")}</CommandEmpty>
            {q && !models.some((m) => m.id === q) && (
              <CommandGroup>
                <CommandItem value={`__custom__ ${q}`} onSelect={() => { onChange(q); setOpen(false); }}>
                  {t("platform.admin.ai.useCustom", { id: q })}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {list.map((m) => (
                <CommandItem key={m.id} value={`${m.id} ${m.name ?? ""}`} onSelect={() => { onChange(m.id); setOpen(false); setQuery(""); }}>
                  <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === m.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs">{m.id}</div>
                    {m.name && m.name !== m.id && <div className="truncate text-[11px] text-muted-foreground">{m.name}</div>}
                  </div>
                  <span className={cn("ml-2 shrink-0 text-[11px]", m.free ? "font-semibold text-primary" : "text-muted-foreground")}>
                    {m.free ? t("platform.admin.ai.free") : price(m)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ModelPicker;
