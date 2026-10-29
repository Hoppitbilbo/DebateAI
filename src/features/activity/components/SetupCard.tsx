import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Loader2, Lock, UserRound, X } from "lucide-react";
import { htmlToText } from "@/lib/text";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import WikiSearchSelect from "@/components/WikiSearchSelect";
import type { WikiRef } from "@/lib/api";

interface SetupCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onStart: () => void;
  canStart: boolean;
  starting?: boolean;
  startLabel?: string;
}

/** Same setup layout in every app: fields + one primary start button. */
export const SetupCard = ({ title, description, children, onStart, canStart, starting, startLabel }: SetupCardProps) => {
  const { t } = useTranslation();
  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
      <div>
        <h2 className="font-heading text-2xl font-bold">{title}</h2>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
      <Button className="w-full" size="lg" onClick={onStart} disabled={!canStart || starting}>
        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {startLabel || t("platform.activity.start")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </section>
  );
};

interface CharacterPickerProps {
  label: string;
  value: WikiRef | null;
  onChange: (v: WikiRef | null) => void;
  locked?: boolean;
  hint?: string;
  /** Hide the chosen name (Mystery Character). */
  conceal?: boolean;
}

export const CharacterPicker = ({ label, value, onChange, locked, hint, conceal }: CharacterPickerProps) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {label}
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" /> {t("platform.activity.setByTeacher")}
          </span>
        )}
      </Label>
      {value ? (
        <div className="flex items-start gap-3 rounded-md border border-border bg-background/50 p-3">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{conceal ? t("platform.activity.hiddenCharacter") : value.title}</p>
            {!conceal && value.snippet && <p className="line-clamp-2 text-sm text-muted-foreground">{htmlToText(value.snippet)}</p>}
          </div>
          {!locked && (
            <Button variant="ghost" size="icon" onClick={() => onChange(null)} aria-label={t("platform.activity.change")}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <WikiSearchSelect onSelect={(r) => onChange({ title: r.title, snippet: r.snippet })} />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};
