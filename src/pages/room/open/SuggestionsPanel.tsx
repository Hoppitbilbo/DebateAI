import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appIconSrc } from "@/lib/appArt";
import type { Suggestion } from "@/features/room/suggestions";

export type SuggestionsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; items: Suggestion[] }
  | { status: "error"; message: string };

/**
 * Ideas for the next stops, built from the theme's Wikipedia page and the
 * pages it links to. Cards shimmer while the model thinks, then land one
 * after the other; adding one moves it into the path.
 */
const SuggestionsPanel = ({ theme, state, onAdd, onRefresh, full }: {
  /** The panel's title, naming the theme; null when the first stop has no page yet. */
  theme: string | null;
  state: SuggestionsState;
  onAdd: (s: Suggestion) => void;
  onRefresh: () => void;
  /** The path has all the stops it can hold. */
  full: boolean;
}) => {
  const { t } = useTranslation();
  if (!theme) {
    return <p className="rounded-lg border-2 border-dashed border-border p-4 text-sm text-muted-foreground">{t("room.wizard.suggestionsNeedTheme")}</p>;
  }

  return (
    <section aria-labelledby="suggestions-title" aria-busy={state.status === "loading"} className="space-y-3 rounded-xl border-2 border-foreground bg-secondary p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="suggestions-title" className="flex items-center gap-2 font-heading text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> {theme}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} disabled={state.status === "loading"}>
          <RefreshCw className={state.status === "loading" ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} /> {t("room.wizard.suggestionsMore")}
        </Button>
      </div>
      {state.status === "loading" && (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label={t("room.wizard.suggestionsLoading")}>
          {[0, 1, 2, 3].map((i) => <li key={i} className="shimmer h-28 rounded-lg" />)}
        </ul>
      )}
      {state.status === "error" && <p className="text-sm text-muted-foreground">{state.message}</p>}
      {state.status === "ready" && (state.items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {state.items.map((s, i) => (
            <li key={`${s.appType}-${s.title}`} className="story-pop" style={{ animationDelay: `${i * 90}ms` }}>
              <div className="flex h-full flex-col gap-2 rounded-lg border-2 border-foreground bg-card p-3 transition-transform duration-200 hover:-translate-y-0.5">
                <div className="flex items-start gap-2">
                  <img src={appIconSrc(s.appType)} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t(`platform.appNames.${s.appType}`)}</p>
                    <p className="font-semibold leading-tight">{s.title}</p>
                  </div>
                </div>
                {s.why && <p className="flex-1 text-sm text-muted-foreground">{s.why}</p>}
                <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => onAdd(s)} disabled={full}>
                  <Plus className="mr-1 h-4 w-4" /> {t("room.wizard.addSuggestion")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{t("room.wizard.suggestionsEmpty")}</p>)}
    </section>
  );
};

export default SuggestionsPanel;
