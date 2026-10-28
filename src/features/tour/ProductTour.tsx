import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/lib/motion";
import { type Box, cardWidth, placeCard, SPOTLIGHT_PADDING } from "./placement";
import { stepKeys, type TourId, TOURS } from "./tours";

/** How long to wait for a step's element to appear (data still loading). */
const FIND_TIMEOUT_MS = 2000;
const FIND_INTERVAL_MS = 150;
/** Duration of the pointer moving to the next element. */
const POINTER_MS = 700;
/** On wide elements the pointer stays near the left, where the content starts. */
const POINTER_MAX_INSET = 120;
/** Height used for the first placement, before the card is measured. */
const CARD_HEIGHT_GUESS = 220;

interface Props {
  tour: TourId;
  /** The user finished or skipped the tour. */
  onClose: (dontShowAgain: boolean) => void;
}

const toBox = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });
const isVisible = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const isInViewport = (r: DOMRect) => r.top >= 0 && r.bottom <= window.innerHeight;

/** Finds the element of a step and keeps its box up to date while the page scrolls or resizes. */
const useTargetBox = (target: string | undefined, reduced: boolean) => {
  const [box, setBox] = useState<Box | null>(null);
  const [searching, setSearching] = useState(!!target);

  useEffect(() => {
    let el: Element | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const measure = () => el && setBox(toBox(el.getBoundingClientRect()));
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    if (!target) {
      setBox(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const started = Date.now();
    const find = () => {
      const found = document.querySelector(`[data-tour="${target}"]`);
      if (found && isVisible(found)) {
        el = found;
        if (!isInViewport(found.getBoundingClientRect())) found.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        measure();
        setSearching(false);
        return;
      }
      if (Date.now() - started < FIND_TIMEOUT_MS) timer = setTimeout(find, FIND_INTERVAL_MS);
      else {
        setBox(null); // not on this screen (e.g. hidden on mobile): show the step centred
        setSearching(false);
      }
    };
    find();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [target, reduced]);

  return { box, searching };
};

const useViewport = () => {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
};

/** The pointer that glides to each highlighted element and "clicks" it. */
const Pointer = ({ x, y, visible, clicking, reduced }: { x: number; y: number; visible: boolean; clicking: boolean; reduced: boolean }) => (
  <div
    aria-hidden
    className="pointer-events-none fixed left-0 top-0 z-[102]"
    style={{
      transform: `translate(${x}px, ${y}px)`,
      opacity: visible ? 1 : 0,
      transition: reduced ? "none" : `transform ${POINTER_MS}ms cubic-bezier(0.65, 0, 0.35, 1), opacity 200ms ease`,
    }}
  >
    {clicking && !reduced && <span className="absolute -left-3 -top-3 h-6 w-6 animate-ping rounded-full bg-primary/70" />}
    <svg width="28" height="28" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgb(0_0_0/0.5)]">
      <path d="M4 2.5 19.5 12 12.4 13.6 9 20.5Z" fill="white" stroke="black" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  </div>
);

/**
 * Guided tour overlay: dims the page, lights up one element at a time, moves
 * a pointer onto it and explains it in a card. Esc skips, arrows move.
 */
const ProductTour = ({ tour, onClose }: Props) => {
  const { t } = useTranslation();
  const steps = TOURS[tour];
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [cardHeight, setCardHeight] = useState(CARD_HEIGHT_GUESS);
  const [arrived, setArrived] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const reduced = prefersReducedMotion();
  const viewport = useViewport();

  const step = steps[index];
  const keys = stepKeys(tour, step);
  const { box, searching } = useTargetBox(step.target, reduced);
  const isLast = index === steps.length - 1;

  const next = useCallback(() => (isLast ? onClose(dontShowAgain) : setIndex((i) => i + 1)), [isLast, onClose, dontShowAgain]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const skip = useCallback(() => onClose(dontShowAgain), [onClose, dontShowAgain]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, viewport.width]);

  useEffect(() => nextRef.current?.focus(), [index]);

  // The pointer "clicks" once it has reached the element; only a move restarts the click.
  const pointerSpot = box ? `${box.left},${box.top}` : null;
  useEffect(() => {
    setArrived(false);
    if (!pointerSpot) return;
    const timer = setTimeout(() => setArrived(true), reduced ? 0 : POINTER_MS);
    return () => clearTimeout(timer);
  }, [pointerSpot, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, skip]);

  const card = placeCard(box, cardHeight, viewport);
  const spot = box && {
    left: box.left - SPOTLIGHT_PADDING,
    top: box.top - SPOTLIGHT_PADDING,
    width: box.width + 2 * SPOTLIGHT_PADDING,
    height: box.height + 2 * SPOTLIGHT_PADDING,
  };
  const pointer = box
    ? { x: box.left + Math.min(box.width / 2, POINTER_MAX_INSET), y: box.top + box.height * 0.6 }
    : { x: viewport.width / 2, y: viewport.height / 2 };
  const moving = reduced ? "none" : "left 450ms ease, top 450ms ease, width 450ms ease, height 450ms ease";

  return createPortal(
    <div className="fixed inset-0 z-[100]" onClick={(e) => e.stopPropagation()}>
      {/* The dim layer, with a hole on the element (or plain when there is none). */}
      {spot ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-transparent"
          style={{ ...spot, boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.62)", transition: moving }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/60" />
      )}

      <Pointer x={pointer.x} y={pointer.y} visible={!!box && !searching} clicking={arrived} reduced={reduced} />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="fixed z-[101] rounded-xl border border-primary/50 bg-card p-5 text-card-foreground shadow-2xl"
        style={{ left: card.left, top: card.top, width: cardWidth(viewport.width), transition: reduced ? "none" : "left 300ms ease, top 300ms ease" }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-primary">
            {t("platform.tour.common.stepOf", { n: index + 1, total: steps.length })}
          </span>
          <button type="button" onClick={skip} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t("platform.tour.common.skip")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tour-title" className="font-heading text-lg font-semibold">{t(keys.title)}</h2>
        <p id="tour-body" className="mt-1 text-sm text-muted-foreground">{t(keys.body)}</p>

        <div className="mt-4 flex items-center gap-1.5" aria-hidden>
          {steps.map((s, i) => (
            <span key={s.id} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40")} />
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={dontShowAgain} onCheckedChange={(v) => setDontShowAgain(v === true)} />
          {t("platform.tour.common.dontShowAgain")}
        </label>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={skip}>{t("platform.tour.common.skip")}</Button>
          <div className="flex gap-2">
            {index > 0 && (
              <Button variant="outline" size="sm" onClick={back}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {t("platform.tour.common.back")}
              </Button>
            )}
            <Button ref={nextRef} size="sm" onClick={next}>
              {isLast ? <><Check className="mr-1 h-4 w-4" /> {t("platform.tour.common.finish")}</> : <>{t("platform.tour.common.next")} <ArrowRight className="ml-1 h-4 w-4" /></>}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ProductTour;
