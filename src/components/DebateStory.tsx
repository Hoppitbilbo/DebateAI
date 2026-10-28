import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { SCRIPT, storyState } from "@/features/story/script";
import { useScrollScript } from "@/features/story/useScrollScript";
import StoryChat from "@/components/story/StoryChat";
import StorySteps from "@/components/story/StorySteps";

/** Home section: a chat between Galileo and a student that builds itself as the page scrolls. */
const DebateStory = () => {
  const { t } = useTranslation();
  const [still] = useState(prefersReducedMotion);
  const { ref, position } = useScrollScript(SCRIPT.length, still);
  const { lines, typing, activeStep, done } = storyState(position);

  return (
    <section ref={ref} className={cn("relative bg-secondary border-y border-border", !still && "h-[320vh]")} aria-labelledby="story-title">
      <div className={cn("mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14 lg:px-8", still ? "py-16" : "sticky top-16 h-[calc(100svh-4rem)] content-center py-6")}>
        <div>
          <p className="font-body text-sm font-semibold uppercase tracking-[0.14em] text-education">{t("hero.story.kicker")}</p>
          <h2 id="story-title" className="mt-2 text-3xl text-foreground sm:text-4xl lg:text-5xl">
            <span className="ink-underline">{t("hero.story.title")}</span>
          </h2>
          <StorySteps activeStep={activeStep} />
        </div>
        <StoryChat lines={lines} typing={typing} done={done} />
      </div>
    </section>
  );
};

export default DebateStory;
