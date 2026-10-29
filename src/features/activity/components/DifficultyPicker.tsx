import { CSSProperties, KeyboardEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Lock, Mountain, Sprout, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DIFFICULTIES, Difficulty } from "../difficulty";

/** "free" is the teacher's choice to let each student pick. */
type Choice = Difficulty | "free";

const ICONS: Record<Choice, LucideIcon> = { easy: Sprout, medium: Flame, hard: Mountain, free: Users };

/**
 * Difficulty as a three-step track: a yellow pill slides under the chosen
 * level and its icon pops; the line below says what the level means for
 * this app. Teachers get a fourth option, "students choose". Keyboard:
 * arrows move between the levels, as in a radio group.
 */
const DifficultyPicker = ({ value, onChange, app, locked = false, allowFree = false, label }: {
  /** undefined means "students choose" (only with allowFree). */
  value: Difficulty | undefined;
  onChange?: (v: Difficulty | undefined) => void;
  /** i18n key of the app, for the description of each level. */
  app: "personaggioMisterioso" | "convinciTu" | "impersonaTu";
  locked?: boolean;
  allowFree?: boolean;
  label?: string;
}) => {
  const { t } = useTranslation();
  const choices: Choice[] = allowFree ? [...DIFFICULTIES, "free"] : [...DIFFICULTIES];
  const current: Choice = value ?? (allowFree ? "free" : "medium");
  const index = choices.indexOf(current);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const pick = (c: Choice) => onChange?.(c === "free" ? undefined : c);
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || locked) return;
    e.preventDefault();
    const next = (index + step + choices.length) % choices.length;
    pick(choices[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span id={`difficulty-${app}`} className="text-sm font-medium">{label ?? t("platform.difficulty.label")}</span>
        {locked && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" />{t("platform.difficulty.locked")}</span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`difficulty-${app}`}
        onKeyDown={onKey}
        className={cn("difficulty-track", locked && "opacity-80")}
        style={{ "--difficulty-count": choices.length, "--difficulty-index": index } as CSSProperties}
        data-level={current}
      >
        <span className="difficulty-pill" aria-hidden="true" />
        {choices.map((c, i) => {
          const Icon = ICONS[c];
          const active = c === current;
          return (
            <button
              key={c}
              ref={(el) => (buttons.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={locked && !active}
              onClick={() => !locked && pick(c)}
              className={cn("difficulty-option", active && "difficulty-option--active")}
            >
              <Icon key={active ? `${c}-on` : c} className={cn("h-5 w-5", active && "difficulty-icon-pop")} aria-hidden="true" />
              <span>{t(`platform.difficulty.levels.${c}`)}</span>
            </button>
          );
        })}
      </div>
      <p key={current} className="difficulty-note text-xs text-muted-foreground" aria-live="polite">
        {t(`platform.difficulty.notes.${app}.${current}`)}
      </p>
    </div>
  );
};

export default DifficultyPicker;
