import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Expand, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppType } from "@/lib/api";
import { APPS } from "@/features/activity/types";
import { COLOURS, PIXEL_FONT } from "./theme";
import { STUDENT_TUTORIALS, resolveSlides } from "./studentTutorials";
import { STAGE_H, STAGE_W, TutorialStage } from "./TutorialStage";
import { useTutorialPlayer } from "./useTutorialPlayer";
import { useStudentTutorialLang } from "./useStudentTutorialLang";

/** Keeps the 640x360 stage sharp at any size by scaling it to the width (or the whole box with `fit`). */
export const ScaledStage = ({ children, fit = false, className }: { children: ReactNode; fit?: boolean; className?: string }) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setScale(fit ? Math.min(width / STAGE_W, height / STAGE_H) : width / STAGE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  return (
    <div ref={box} className={cn("relative flex items-center justify-center overflow-hidden", className)} style={fit ? undefined : { aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
      <div style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
        <div style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}>{children}</div>
      </div>
    </div>
  );
};

interface StudentTutorialPlayerProps {
  app: AppType;
  /** "page" sits inside a page; "presentation" fills the screen for projecting in class. */
  variant?: "page" | "presentation";
}

export const StudentTutorialPlayer = ({ app, variant = "page" }: StudentTutorialPlayerProps) => {
  const { t } = useTranslation();
  const { t: ts, lang } = useStudentTutorialLang();
  const tutorial = STUDENT_TUTORIALS[app];
  const slides = useMemo(() => resolveSlides(tutorial, ts), [tutorial, ts]);
  const player = useTutorialPlayer(slides, lang);
  const root = useRef<HTMLDivElement>(null);
  const presentation = variant === "presentation";

  // Before START the first slide is shown complete, as a cover.
  const frame = player.started ? player.frame : { ...player.frame, t: player.timeline[0].duration, talking: false };

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.();
  };

  return (
    <div ref={root} className={cn("flex flex-col gap-3", presentation && "h-full bg-[#141221] p-2")}>
      <div className={cn("relative", presentation && "min-h-0 flex-1")}>
        <ScaledStage fit={presentation} className={cn(presentation ? "h-full" : "w-full rounded-md border-4 border-[#141221]")}>
          <TutorialStage tutorial={tutorial} slides={slides} timeline={player.timeline} frame={frame} />
        </ScaledStage>
        {(!player.started || player.ended) && (
          <button
            type="button"
            onClick={player.start}
            className="absolute inset-0 flex items-center justify-center bg-black/40"
            aria-label={player.ended ? t("platform.tutorialPlayer.replay") : t("platform.tutorialPlayer.start")}
          >
            <span className="animate-pulse px-6 py-4 text-sm sm:text-lg" style={{ fontFamily: PIXEL_FONT, background: COLOURS.accent, color: "#141221", border: "4px solid #141221", boxShadow: "6px 6px 0 #141221" }}>
              {player.ended ? t("platform.tutorialPlayer.replay") : `▶ ${t("platform.tutorialPlayer.start")}`}
            </span>
          </button>
        )}
      </div>

      <div className={cn("flex flex-wrap items-center justify-between gap-2", presentation && "text-[#f4f4f4]")}>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => player.goTo(frame.index - 1)} disabled={frame.index === 0} aria-label={t("common.back")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {player.playing ? (
            <Button variant="outline" size="icon" onClick={player.pause} aria-label={t("platform.tutorialPlayer.pause")}>
              <Pause className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="outline" size="icon" onClick={player.start} aria-label={t("platform.tutorialPlayer.play")}>
              {player.ended ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => player.goTo(frame.index + 1)} disabled={frame.index === slides.length - 1} aria-label={t("common.next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={player.toggleMute} aria-label={player.muted ? t("platform.tutorialPlayer.unmute") : t("platform.tutorialPlayer.mute")}>
            {player.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>

        <ol className="flex gap-2" aria-label={t("platform.tutorialPlayer.slides")}>
          {slides.map((s, i) => (
            <li key={s.kind}>
              <button
                type="button"
                onClick={() => player.goTo(i)}
                aria-label={`${i + 1} / ${slides.length}: ${s.title}`}
                aria-current={i === frame.index ? "step" : undefined}
                className={cn("h-3 w-3 border-2 border-[#141221]", i === frame.index ? "bg-[#ffcd75]" : "bg-muted-foreground/40 hover:bg-muted-foreground/70")}
              />
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fullscreen}>
            <Expand className="mr-2 h-4 w-4" />
            {t("platform.tutorialPlayer.fullscreen")}
          </Button>
          {!presentation && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/tutorial-player/${app}`}>{t("platform.tutorialPlayer.presentation")}</Link>
            </Button>
          )}
          <Button size="sm" asChild>
            <Link to={APPS[app].path}>{t("platform.tutorialPlayer.openApp")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudentTutorialPlayer;
