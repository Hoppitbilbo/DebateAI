import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MonitorScreen } from "./MonitorScreens";
import { COLOURS, PIXEL_FONT, TEXT_FONT } from "./theme";
import { PixelSprite } from "./pixelArt";
import { SceneBackdrop, SCENE_W } from "./scenes";
import { spriteOf, type SpriteId } from "./sprites";
import { SLIDE_KINDS, type SlideContent, type SlideKind, type StudentTutorial } from "./studentTutorials";
import { MORPH_S, morphProgress, voiceProgress, subtitleAt, type SlideTiming } from "./timeline";

// One frame of a student tutorial on a 640x360 stage. Between two slides the
// guides and the PC keep their identity and glide to their new place, while
// texts leave to the left and come in from the right (a horizontal morph).

export const STAGE_W = 640;
export const STAGE_H = 360;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LAYOUTS: Record<SlideKind, { guides: Box; monitor: Box }> = {
  mission: { guides: { x: 24, y: 96, w: 250, h: 196 }, monitor: { x: 300, y: 70, w: 316, h: 222 } },
  task: { guides: { x: 470, y: 96, w: 150, h: 196 }, monitor: { x: 24, y: 66, w: 430, h: 226 } },
  path: { guides: { x: 24, y: 228, w: 592, h: 66 }, monitor: { x: 24, y: 62, w: 592, h: 164 } },
  progress: { guides: { x: 484, y: 96, w: 140, h: 196 }, monitor: { x: 16, y: 62, w: 460, h: 234 } },
  grading: { guides: { x: 8, y: 96, w: 150, h: 196 }, monitor: { x: 164, y: 62, w: 460, h: 234 } },
  tips: { guides: { x: 16, y: 96, w: 260, h: 196 }, monitor: { x: 288, y: 62, w: 336, h: 234 } },
};

const ART_PX = 4;
const GUIDE_GAP = 8;
const KEYBOARD_H = 14;
const BEZEL = 8;
const SUBTITLE_Y = 300;
const PAN_PER_SLIDE = (SCENE_W - STAGE_W) / (SLIDE_KINDS.length - 1);
/** The mystery guide is unmasked shortly after the last slide arrives. */
const FINALE_FLASH_S = 0.35;

const lerp = (a: number, b: number, m: number) => a + (b - a) * m;
const lerpBox = (a: Box, b: Box, m: number): Box => ({ x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), w: lerp(a.w, b.w, m), h: lerp(a.h, b.h, m) });

export interface StageFrame {
  index: number;
  /** Seconds into the current slide. */
  t: number;
  /** Seconds since the tutorial started (for idle animations). */
  clock: number;
  /** Whether the narrator is speaking right now (moves the mouth). */
  talking: boolean;
}

interface TutorialStageProps {
  tutorial: StudentTutorial;
  slides: SlideContent[];
  timeline: SlideTiming[];
  frame: StageFrame;
}

const Guides = ({ ids, box, talker, clock, walk }: { ids: SpriteId[]; box: Box; talker: SpriteId | null; clock: number; walk?: number }) => {
  const sprites = ids.map((id) => ({ id, ...spriteOf(id, id === talker && Math.floor(clock * 7) % 2 === 0) }));
  const natW = sprites.reduce((n, s) => n + s.grid[0].length * ART_PX, 0) + GUIDE_GAP * (ids.length - 1);
  const natH = Math.max(...sprites.map((s) => s.grid.length * ART_PX));
  const scale = Math.min(1, box.w / natW, box.h / natH);
  const groupW = natW * scale;
  const x = walk === undefined ? box.x + (box.w - groupW) / 2 : box.x + walk * (box.w - groupW);
  return (
    <div className="absolute flex items-end" style={{ left: x, top: box.y + box.h - natH * scale, width: natW, height: natH, gap: GUIDE_GAP, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
      {sprites.map((s, i) => {
        const bob = Math.floor(clock * 2 + i) % 2 === 0 ? 0 : ART_PX;
        return (
          <div key={`${s.id}-${i}`} style={{ transform: `translateY(${bob}px)` }}>
            <PixelSprite grid={s.grid} palette={s.palette} px={ART_PX} />
          </div>
        );
      })}
    </div>
  );
};

/** Old content leaves to the left while the new one comes in from the right. */
const Sliding = ({ m, from, to }: { m: number; from: ReactNode | null; to: ReactNode }) => (
  <div className="relative h-full w-full overflow-hidden">
    {from && m < 1 && (
      <div className="absolute inset-0" style={{ transform: `translateX(${-m * 100}%)`, opacity: 1 - m }}>
        {from}
      </div>
    )}
    <div className="absolute inset-0" style={{ transform: `translateX(${(1 - m) * 100}%)` }}>
      {to}
    </div>
  </div>
);

const Monitor = ({ box, children }: { box: Box; children: ReactNode }) => (
  <div className="absolute" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}>
    <div
      className="absolute inset-x-0 top-0"
      style={{ bottom: KEYBOARD_H + 4, background: "#c2c3c7", border: "3px solid #141221", boxShadow: "inset -4px -4px 0 #94b0c2, inset 4px 4px 0 #f4f4f4", padding: BEZEL }}
    >
      <div
        className="relative h-full w-full overflow-hidden"
        style={{ background: "#1a1c2c", border: "3px solid #141221", color: COLOURS.text, padding: "6px 10px" }}
      >
        {children}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,0.14) 3px 4px)" }}
        />
      </div>
      <div className="absolute" style={{ right: 10, bottom: 2, width: 6, height: 4, background: COLOURS.good }} />
    </div>
    <div
      className="absolute"
      style={{
        left: "12%", right: "12%", bottom: 0, height: KEYBOARD_H, background: "#c2c3c7", border: "3px solid #141221",
        backgroundImage: "repeating-linear-gradient(to right, #94b0c2 0 6px, transparent 6px 9px)", backgroundSize: "100% 4px", backgroundRepeat: "no-repeat", backgroundPosition: "0 3px",
      }}
    />
  </div>
);

export const TutorialStage = ({ tutorial, slides, timeline, frame }: TutorialStageProps) => {
  const { t: tr } = useTranslation("studentTutorial");
  const { index, t, clock, talking } = frame;
  const slide = slides[index];
  const timing = timeline[index];
  const prevIndex = index > 0 ? index - 1 : null;
  const m = prevIndex === null ? 1 : morphProgress(t);
  const from = prevIndex === null ? LAYOUTS[slide.kind] : LAYOUTS[slides[prevIndex].kind];
  const to = LAYOUTS[slide.kind];

  const isFinale = !!tutorial.finale && slide.kind === "tips";
  const unmasked = isFinale && t >= MORPH_S + FINALE_FLASH_S;
  const flash = isFinale ? Math.max(0, 1 - Math.abs(t - (MORPH_S + FINALE_FLASH_S)) / 0.25) : 0;
  const guides = tutorial.guides.map((g, i) => (i === 0 && unmasked ? tutorial.finale! : g));

  const pan = lerp((prevIndex ?? index) * PAN_PER_SLIDE, index * PAN_PER_SLIDE, m);
  const walk = slide.kind === "path" ? voiceProgress(timing, t) : undefined;
  const subtitle = subtitleAt(slide.voice, voiceProgress(timing, t));

  const screen = (i: number, at: number) => <MonitorScreen slide={slides[i]} timing={timeline[i]} t={at} clock={clock} />;
  const title = (i: number) => (
    <div className="flex h-full items-center justify-center px-4 text-center" style={{ fontFamily: PIXEL_FONT, fontSize: slides[i].title.length > 26 ? 12 : 15, color: COLOURS.accent, lineHeight: 1.4 }}>
      {slides[i].title}
    </div>
  );

  return (
    <div className="relative overflow-hidden" style={{ width: STAGE_W, height: STAGE_H, background: "#141221", color: COLOURS.text }}>
      <div className="absolute top-0" style={{ left: -pan }}>
        <SceneBackdrop scene={tutorial.scene} />
      </div>

      <div className="absolute" style={{ left: 16, top: 10, width: STAGE_W - 32, height: 46, background: "rgba(20,18,33,0.85)", border: `3px solid ${COLOURS.accent}` }}>
        <Sliding m={m} from={prevIndex === null ? null : title(prevIndex)} to={title(index)} />
        <div className="absolute" style={{ right: 6, bottom: 3, fontFamily: PIXEL_FONT, fontSize: 7, color: COLOURS.dim }}>
          {index + 1}/{slides.length}
        </div>
      </div>

      <Monitor box={lerpBox(from.monitor, to.monitor, m)}>
        <Sliding m={m} from={prevIndex === null ? null : screen(prevIndex, timeline[prevIndex].duration)} to={screen(index, t)} />
      </Monitor>

      <Guides ids={guides} box={lerpBox(from.guides, to.guides, m)} talker={talking ? slide.speaker : null} clock={clock} walk={walk} />

      {flash > 0 && <div className="pointer-events-none absolute inset-0" style={{ background: "#f4f4f4", opacity: flash }} />}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 px-4" style={{ top: SUBTITLE_Y, background: "rgba(20,18,33,0.92)", borderTop: `3px solid ${COLOURS.accent}` }}>
        <span className="shrink-0 px-2 py-1" style={{ fontFamily: PIXEL_FONT, fontSize: 8, background: COLOURS.accent, color: "#141221" }}>
          {tr(`characters.${slide.speaker}`)}
        </span>
        <span style={{ fontFamily: TEXT_FONT, fontSize: 21, lineHeight: 1 }}>{subtitle}</span>
      </div>
    </div>
  );
};
