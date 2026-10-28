import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { STEPS } from "@/features/story/script";

/** The four steps of an activity, the current one lifted: a list on desktop, a single pill on mobile. */
const StorySteps = ({ activeStep }: { activeStep: number }) => {
  const { t } = useTranslation();
  return (
    <>
      <ol className="mt-8 hidden space-y-3 lg:block">
        {STEPS.map((step) => (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-lg font-medium transition-all duration-300",
              step === activeStep ? "story-step-active border-foreground bg-card shadow-[4px_4px_0_0_hsl(var(--foreground))]" : step < activeStep ? "border-transparent text-foreground/70" : "border-transparent text-foreground/40",
            )}
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-sm font-bold", step <= activeStep ? "bg-sun" : "bg-card")}>{step}</span>
            {t(`hero.story.steps.${step}`)}
          </li>
        ))}
      </ol>

      <p key={activeStep} className="story-pop mt-4 inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 py-1 text-sm font-semibold lg:hidden">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-xs">{activeStep}</span>
        {t(`hero.story.steps.${activeStep}`)}
      </p>
    </>
  );
};

export default StorySteps;
