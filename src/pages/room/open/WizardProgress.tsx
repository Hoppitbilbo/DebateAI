import { useTranslation } from "react-i18next";
import { Check, Lightbulb, Rocket, Route, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, WizardStep } from "./wizardSteps";

const ICONS: Record<WizardStep, LucideIcon> = { theme: Lightbulb, path: Route, launch: Rocket };

/** Three bubbles joined by a line that fills as the teacher moves on; past steps can be reopened. */
const WizardProgress = ({ step, onGo, canGo }: { step: WizardStep; onGo: (s: WizardStep) => void; canGo: (s: WizardStep) => boolean }) => {
  const { t } = useTranslation();
  const index = WIZARD_STEPS.indexOf(step);
  return (
    <nav aria-label={t("room.wizard.progress")} className="relative mx-auto w-full max-w-md">
      <div className="absolute left-[16%] right-[16%] top-5 h-1 rounded-full bg-border" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${(index / (WIZARD_STEPS.length - 1)) * 100}%` }} />
      </div>
      <ol className="relative grid grid-cols-3">
        {WIZARD_STEPS.map((s, i) => {
          const Icon = i < index ? Check : ICONS[s];
          const current = s === step;
          return (
            <li key={s} className="flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => onGo(s)}
                disabled={!canGo(s)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground transition-[background-color,transform,box-shadow] duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed",
                  current ? "story-pop bg-sun shadow-[2px_2px_0_0_hsl(var(--foreground))]" : i < index ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className={cn("text-xs font-medium sm:text-sm", current ? "text-foreground" : "text-muted-foreground")}>{t(`room.wizard.steps.${s}`)}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default WizardProgress;
