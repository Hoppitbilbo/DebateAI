import { useTranslation } from "react-i18next";
import { Languages, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRACTICE_LANGUAGES } from "../language";

/**
 * The language the characters speak, as chips. With `optional`, a first
 * chip means "the student's own language" (value undefined).
 */
const LanguagePicker = ({ value, onChange, optional = false, locked = false, label }: {
  value: string | undefined;
  onChange?: (code: string | undefined) => void;
  optional?: boolean;
  locked?: boolean;
  label?: string;
}) => {
  const { t } = useTranslation();
  const options = [...(optional ? [{ code: "", label: t("platform.language.studentsOwn") }] : []), ...PRACTICE_LANGUAGES];
  const current = value ?? "";

  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span className="inline-flex items-center gap-2"><Languages className="h-4 w-4" aria-hidden="true" />{label ?? t("platform.language.label")}</span>
        {locked && <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground"><Lock className="h-3 w-3" />{t("platform.difficulty.locked")}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.code === current;
          return (
            <button
              key={o.code || "own"}
              type="button"
              aria-pressed={active}
              disabled={locked && !active}
              onClick={() => onChange?.(o.code || undefined)}
              className={cn("language-chip", active && "language-chip--active")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};

export default LanguagePicker;
