import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Speaker = "student" | "galileo";

// The demo conversation: who speaks, the copy key, and the step it explains.
const SCRIPT: { speaker: Speaker; key: string; step: number }[] = [
  { speaker: "student", key: "s1", step: 1 },
  { speaker: "galileo", key: "g1", step: 1 },
  { speaker: "student", key: "s2", step: 2 },
  { speaker: "galileo", key: "g2", step: 2 },
  { speaker: "student", key: "s3", step: 3 },
  { speaker: "galileo", key: "g3", step: 3 },
  { speaker: "student", key: "s4", step: 4 },
  { speaker: "galileo", key: "g4", step: 4 },
];
const STEPS = [1, 2, 3, 4];

// Share of a message's scroll slot after which the next speaker starts "typing".
const TYPING_FROM = 0.45;

const AVATARS: Record<Speaker, string> = {
  galileo: "/avatars/galileo.webp",
  student: "/avatars/student.webp",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** How far the reader has scrolled through `el`, 0 at its top and 1 when its end reaches the viewport bottom. */
const scrollProgress = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return 1;
  return Math.min(1, Math.max(0, -rect.top / travel));
};

/** Messages shown so far (fractional: the decimal part is the next one being typed). */
const useScrollScript = (length: number, still: boolean) => {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState(still ? length : 0);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      // A little slack at the end keeps the full chat on screen before the section leaves.
      if (el) setPosition(Math.min(length, scrollProgress(el) * (length + 0.8)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [length, still]);

  return { ref, position };
};

const Avatar = ({ speaker }: { speaker: Speaker }) => (
  <img
    src={AVATARS[speaker]}
    alt=""
    width={40}
    height={40}
    className={cn("h-10 w-10 shrink-0 rounded-full border-2 border-foreground object-cover", speaker === "student" ? "bg-sun-light p-0.5" : "object-top")}
  />
);

/** Home section: a chat between Galileo and a student that builds itself as the page scrolls. */
const DebateStory = () => {
  const { t } = useTranslation();
  const [still] = useState(prefersReducedMotion);
  const { ref, position } = useScrollScript(SCRIPT.length, still);

  const shown = Math.floor(position);
  const next = SCRIPT[shown];
  const typing = !!next && position - shown > TYPING_FROM;
  const activeStep = SCRIPT[Math.max(0, shown - 1)]?.step ?? 1;
  const done = shown >= SCRIPT.length;

  return (
    <section ref={ref} className={cn("relative bg-secondary border-y border-border", !still && "h-[320vh]")} aria-labelledby="story-title">
      <div className={cn("mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-14 lg:px-8", still ? "py-16" : "sticky top-16 h-[calc(100svh-4rem)] content-center py-6")}>
        <div>
          <p className="font-body text-sm font-semibold uppercase tracking-[0.14em] text-education">{t("hero.story.kicker")}</p>
          <h2 id="story-title" className="mt-2 text-3xl text-foreground sm:text-4xl lg:text-5xl">
            <span className="ink-underline">{t("hero.story.title")}</span>
          </h2>

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
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-3xl border-2 border-foreground bg-card shadow-[6px_6px_0_0_hsl(var(--foreground))] lg:h-[min(560px,calc(100svh-9rem))] h-[min(520px,calc(100svh-12rem))]">
          <div className="flex items-center gap-3 border-b-2 border-foreground bg-primary px-4 py-3 text-primary-foreground">
            <Avatar speaker="galileo" />
            <div className="leading-tight">
              <p className="font-heading text-lg font-semibold">{t("hero.story.galileo")}</p>
              <p className="text-xs opacity-80">{typing && next.speaker === "galileo" ? t("hero.story.typing") : t("hero.story.online")}</p>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-3 overflow-hidden p-4" aria-live="polite">
            {SCRIPT.slice(0, shown).map(({ speaker, key }) => (
              <div key={key} className={cn("flex items-end gap-2", speaker === "student" && "flex-row-reverse")}>
                <Avatar speaker={speaker} />
                <p
                  className={cn(
                    "story-bubble max-w-[78%] rounded-2xl border-2 border-foreground px-4 py-2.5 text-sm sm:text-base",
                    speaker === "student" ? "story-bubble--right rounded-br-sm bg-sun" : "rounded-bl-sm bg-card",
                  )}
                >
                  {t(`hero.story.messages.${key}`)}
                </p>
              </div>
            ))}
            {typing && (
              <div className={cn("flex items-end gap-2", next.speaker === "student" && "flex-row-reverse")}>
                <Avatar speaker={next.speaker} />
                <span className="story-bubble flex gap-1 rounded-2xl border-2 border-foreground bg-card px-4 py-3" aria-label={t("hero.story.typing")}>
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
            )}
          </div>

          <div className={cn("border-t-2 border-foreground px-4 py-3 transition-opacity duration-300", done ? "opacity-100" : "opacity-0")}>
            <Button asChild className="story-pop w-full" tabIndex={done ? 0 : -1}>
              <Link to="/apps">{t("hero.story.cta")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DebateStory;
