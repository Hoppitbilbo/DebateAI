import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { cn } from "@/lib/utils";
import { diffuseLine, settleTimes, toPlainBlocks } from "./diffusion";

/** How long the text takes to settle, and how often the noise changes. */
const DURATION_MS = 2400;
const FRAME_MS = 50;

/** A final line and the index of its first character in the whole text. */
interface Line {
  text: string;
  offset: number;
}

interface Laid {
  lineHeight: number;
  /** The final lines of each paragraph, as the browser will wrap them. */
  blocks: Line[][];
  times: Float32Array;
}

/**
 * Lays out the paragraphs with Pretext at the container's width and font:
 * the lines are known before anything is drawn, so the noise settles in
 * place without the text jumping between lines.
 */
const layOut = (blocks: string[], el: HTMLElement): Laid => {
  const style = getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize);
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.625;
  const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const width = el.clientWidth;
  let chars = 0;
  const laid = blocks.map((b) =>
    layoutWithLines(prepareWithSegments(b, font, { whiteSpace: "pre-wrap" }), width, lineHeight).lines.map((l) => {
      const line = { text: l.text, offset: chars };
      chars += Array.from(l.text).length;
      return line;
    }),
  );
  return { lineHeight, blocks: laid, times: settleTimes(chars) };
};

/**
 * The feedback written as noise that settles into the text, like a
 * diffusion model; `onDone` then hands over to the real Markdown. Screen
 * readers get the final text at once.
 */
const DiffusionText = ({ markdown, onDone }: { markdown: string; onDone: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => toPlainBlocks(markdown), [markdown]);
  const [laid, setLaid] = useState<Laid | null>(null);
  const [progress, setProgress] = useState(0);
  const done = useRef(onDone);
  done.current = onDone;

  // Lay out once the fonts are ready: Pretext measures with the real font.
  useLayoutEffect(() => {
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled && ref.current) setLaid(layOut(blocks, ref.current));
    });
    return () => {
      cancelled = true;
    };
  }, [blocks]);

  useEffect(() => {
    if (!laid) return;
    const start = performance.now();
    let last = 0;
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - start) / DURATION_MS);
      if (now - last >= FRAME_MS || p === 1) {
        last = now;
        setProgress(p);
      }
      if (p < 1) frame = requestAnimationFrame(tick);
      else done.current();
    });
    return () => cancelAnimationFrame(frame);
  }, [laid]);

  return (
    <div ref={ref} className="leading-relaxed">
      <div className="sr-only">{blocks.join("\n\n")}</div>
      <div aria-hidden="true">
        {laid?.blocks.map((lines, b) => (
          <p key={b} className="mb-3 last:mb-0">
            {lines.map((line, l) => (
              <span key={l} className="block overflow-hidden whitespace-pre" style={{ height: laid.lineHeight }}>
                {diffuseLine(line.text, laid.times, line.offset, progress).map((r, i) => (
                  <span key={i} className={cn(!r.settled && "text-primary/40")}>{r.text}</span>
                ))}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
};

export default DiffusionText;
