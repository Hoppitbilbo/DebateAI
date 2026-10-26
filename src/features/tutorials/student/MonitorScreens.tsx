import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { PixelSprite, type Grid } from "./pixelArt";
import { COLOURS, PIXEL_FONT, TEXT_FONT } from "./theme";
import type { SlideContent } from "./studentTutorials";
import { revealProgress, voiceProgress, type SlideTiming } from "./timeline";

// What the retro PC shows on each kind of slide. Every screen is a pure
// function of the time into the slide.

const ICONS: Record<"check" | "warn" | "star" | "plus" | "box", Grid> = {
  check: ["......G", ".....GG", "G...GG.", "GG.GG..", ".GGG...", "..G...."],
  warn: ["...R...", "..RRR..", "..RWR..", ".RRWRR.", ".RRRRR.", "RRRWRRR", "RRRRRRR"],
  star: ["...Y...", "...Y...", "YYYYYYY", ".YYYYY.", "..YYY..", ".YY.YY.", "YY...YY"],
  plus: ["..G..", "..G..", "GGGGG", "..G..", "..G.."],
  box: ["DDDDDDD", "D.....D", "D.....D", "D.....D", "D.....D", "D.....D", "DDDDDDD"],
};
const ICON_PALETTE = { G: COLOURS.good, R: COLOURS.bad, W: "#1a1c2c", Y: COLOURS.accent, D: COLOURS.dim };

const Icon = ({ name, px = 3 }: { name: keyof typeof ICONS; px?: number }) => (
  <PixelSprite grid={ICONS[name]} palette={ICON_PALETTE} px={px} className="shrink-0" />
);

/** An item that slides in from the right as it appears. */
const enter = (r: number): CSSProperties => ({ opacity: r, transform: `translateX(${Math.round((1 - r) * 24)}px)` });

interface ScreenProps {
  slide: SlideContent;
  timing: SlideTiming;
  t: number;
  /** Whole-tutorial clock, for blinking. */
  clock: number;
}

/** Centred vertically, but if the content is too tall it overflows at the bottom, never at the top. */
const SAFE_CENTER: CSSProperties = { justifyContent: "safe center" };

const blinkOn = (clock: number, hz = 2) => Math.floor(clock * hz) % 2 === 0;

const Line = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div className="flex items-center gap-3" style={{ fontFamily: TEXT_FONT, fontSize: 21, lineHeight: 1.05, ...style }}>
    {children}
  </div>
);

const MissionScreen = ({ slide, timing, t, clock }: ScreenProps) => (
  <div style={SAFE_CENTER} className="flex h-full flex-col gap-4 px-2">
    <div style={{ fontFamily: PIXEL_FONT, fontSize: 9, color: COLOURS.good }}>
      {"> MISSION.EXE"}
      {blinkOn(clock) && "_"}
    </div>
    {slide.lines.map((line, i) => {
      const shown = Math.floor(line.length * revealProgress(timing, i, t, 0.03 * line.length));
      return (
        <div key={i} style={{ fontFamily: TEXT_FONT, fontSize: 26, lineHeight: 1.05, color: i === 0 ? COLOURS.text : COLOURS.accent, minHeight: 28 }}>
          {line.slice(0, shown)}
        </div>
      );
    })}
  </div>
);

const StepsScreen = ({ slide, timing, t }: ScreenProps) => (
  <div style={SAFE_CENTER} className="flex h-full flex-col gap-3 px-2">
    {slide.lines.map((line, i) => {
      const [, num, rest] = line.match(/^(\d+\.)\s*(.*)$/) ?? [null, "", line];
      return (
        <Line key={i} style={enter(revealProgress(timing, i, t))}>
          <span style={{ fontFamily: PIXEL_FONT, fontSize: 12, color: COLOURS.accent, minWidth: 28 }}>{num}</span>
          <span>{rest}</span>
        </Line>
      );
    })}
  </div>
);

const PathScreen = ({ slide, timing, t }: ScreenProps) => {
  const active = Math.min(slide.lines.length - 1, Math.floor(voiceProgress(timing, t) * slide.lines.length));
  return (
    <div style={SAFE_CENTER} className="flex h-full flex-col gap-3 px-1">
      <div className="flex items-stretch gap-3">
        {slide.lines.map((level, i) => {
          const on = i === active && revealProgress(timing, i, t) === 1;
          return (
            <div
              key={level}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
              style={{
                ...enter(revealProgress(timing, i, t)),
                border: `3px solid ${on ? COLOURS.accent : COLOURS.dim}`,
                background: on ? "#3b5dc9" : COLOURS.panel,
                boxShadow: on ? `0 0 0 3px #1a1c2c, 0 0 0 6px ${COLOURS.accent}` : undefined,
              }}
            >
              <span style={{ fontFamily: PIXEL_FONT, fontSize: 14, color: COLOURS.accent }}>{i + 1}</span>
              <span style={{ fontFamily: TEXT_FONT, fontSize: 17 }}>{level}</span>
            </div>
          );
        })}
      </div>
      <Line style={{ ...enter(revealProgress(timing, slide.lines.length, t)), color: COLOURS.accent, justifyContent: "center" }}>{slide.extra}</Line>
    </div>
  );
};

const SEGMENTS = 10;

const Bar = ({ value, colour, size = 14 }: { value: number; colour: string; size?: number }) => (
  <div className="flex gap-[3px]">
    {Array.from({ length: SEGMENTS }, (_, i) => (
      <div key={i} style={{ width: size, height: size, background: i < value ? colour : "#333c57", border: "2px solid #141221" }} />
    ))}
  </div>
);

const ProgressScreen = ({ slide, timing, t, clock }: ScreenProps) => {
  const { t: tr } = useTranslation("studentTutorial");
  const p = voiceProgress(timing, t);
  const ticked = p > 0.4;
  const fill = Math.round(Math.min(1, Math.max(0, (p - 0.25) / 0.3)) * SEGMENTS);
  const caption = (i: number) => <div style={{ fontFamily: TEXT_FONT, fontSize: 15, lineHeight: 1.1, color: COLOURS.dim }}>{slide.lines[i]}</div>;
  return (
    <div style={SAFE_CENTER} className="flex h-full flex-col gap-2 px-2">
      <div style={enter(revealProgress(timing, 0, t))}>
        <Line>
          <span className="relative">
            <Icon name="box" />
            {ticked && <span className="absolute -top-1 left-0.5"><Icon name="check" /></span>}
          </span>
          <span style={{ color: ticked ? COLOURS.good : COLOURS.text }}>{slide.goal}</span>
        </Line>
        {caption(0)}
      </div>
      <div style={enter(revealProgress(timing, 1, t))}>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: PIXEL_FONT, fontSize: 9, color: COLOURS.accent }}>{tr("common.progress.barLabel")}</span>
          <Bar value={fill} colour={COLOURS.good} />
          <span style={{ fontFamily: PIXEL_FONT, fontSize: 9 }}>{fill * 10}%</span>
        </div>
        {caption(1)}
      </div>
      <div style={{ ...enter(revealProgress(timing, 2, t)), opacity: revealProgress(timing, 2, t) * (blinkOn(clock, 1.5) ? 1 : 0.55) }}>
        <Line style={{ color: COLOURS.bad }}>
          <Icon name="warn" />
          <span>{tr("common.progress.warning")}</span>
        </Line>
        {caption(2)}
      </div>
    </div>
  );
};

const SAMPLE_SCORES = [8, 7];

const GradingScreen = ({ slide, timing, t }: ScreenProps) => {
  const { t: tr } = useTranslation("studentTutorial");
  const plus = slide.plus ?? [];
  const scoreRow = (label: string, score: number, item: number) => {
    const r = revealProgress(timing, item, t, 0.8);
    return (
      <div className="flex items-center gap-2" style={enter(Math.min(1, r * 3))}>
        <span style={{ fontFamily: PIXEL_FONT, fontSize: 8, color: COLOURS.accent, width: 108, flexShrink: 0, whiteSpace: "nowrap" }}>{label}</span>
        <Bar value={Math.round(score * r)} colour={item === 0 ? COLOURS.good : "#41a6f6"} size={11} />
        <span style={{ fontFamily: PIXEL_FONT, fontSize: 9 }}>{Math.round(score * r)}/10</span>
        {item === 0 && <span style={{ fontFamily: TEXT_FONT, fontSize: 15, color: COLOURS.dim }}>({tr("common.grading.sample")})</span>}
      </div>
    );
  };
  return (
    <div style={SAFE_CENTER} className="flex h-full flex-col gap-1.5 px-1">
      {scoreRow(tr("common.grading.conversation"), SAMPLE_SCORES[0], 0)}
      {scoreRow(tr("common.grading.reflection"), SAMPLE_SCORES[1], 1)}
      {plus.map((line, i) => (
        <Line key={i} style={{ ...enter(revealProgress(timing, 2 + i, t)), fontSize: 18 }}>
          <Icon name="plus" />
          <span>{line}</span>
        </Line>
      ))}
      <div style={{ ...enter(revealProgress(timing, 2 + plus.length, t)), borderLeft: `4px solid ${COLOURS.accent}`, paddingLeft: 8, marginTop: 4 }}>
        <div style={{ fontFamily: PIXEL_FONT, fontSize: 7, color: COLOURS.accent, marginBottom: 2 }}>{tr("common.grading.reflectionTitle")}</div>
        <div style={{ fontFamily: TEXT_FONT, fontSize: 16, lineHeight: 1, color: COLOURS.text }}>{slide.reflection}</div>
      </div>
    </div>
  );
};

const TipsScreen = ({ slide, timing, t, clock }: ScreenProps) => {
  const { t: tr } = useTranslation("studentTutorial");
  const start = revealProgress(timing, slide.lines.length, t);
  return (
    <div style={SAFE_CENTER} className="flex h-full flex-col gap-2.5 px-1">
      {slide.lines.map((line, i) => (
        <Line key={i} style={{ ...enter(revealProgress(timing, i, t)), fontSize: 20, lineHeight: 0.95 }}>
          <Icon name="star" />
          <span>{line}</span>
        </Line>
      ))}
      <div className="text-center" style={{ fontFamily: PIXEL_FONT, fontSize: 14, color: COLOURS.accent, opacity: start && blinkOn(clock, 2.5) ? 1 : 0, marginTop: 2 }}>
        {tr("common.pressStart")}
      </div>
    </div>
  );
};

const SCREENS: Record<SlideContent["kind"], (p: ScreenProps) => JSX.Element> = {
  mission: MissionScreen,
  task: StepsScreen,
  path: PathScreen,
  progress: ProgressScreen,
  grading: GradingScreen,
  tips: TipsScreen,
};

export const MonitorScreen = (props: ScreenProps) => {
  const Screen = SCREENS[props.slide.kind];
  return <Screen {...props} />;
};
