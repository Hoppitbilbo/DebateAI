import { useEffect, useRef, useState } from "react";

/** Extra lines of scroll after the last one, so the full chat stays on screen before the section leaves. */
const END_SLACK = 0.8;

/** How far the reader has scrolled through `el`: 0 at its top, 1 when its end reaches the viewport bottom. */
export const scrollProgress = (el: HTMLElement) => {
  const rect = el.getBoundingClientRect();
  const travel = rect.height - window.innerHeight;
  if (travel <= 0) return 1;
  return Math.min(1, Math.max(0, -rect.top / travel));
};

/** Lines shown so far as the reader scrolls through the returned ref (all of them when `still`). */
export const useScrollScript = (length: number, still: boolean) => {
  const ref = useRef<HTMLElement>(null);
  const [position, setPosition] = useState(still ? length : 0);

  useEffect(() => {
    if (still) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = ref.current;
      if (el) setPosition(Math.min(length, scrollProgress(el) * (length + END_SLACK)));
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
