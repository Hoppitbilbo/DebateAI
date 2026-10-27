import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import type { AppType } from "@/lib/api";
import { renderSfxWav } from "./chiptune";
import { ScaledStage } from "./StudentTutorialPlayer";
import { STUDENT_TUTORIALS, VOICES, resolveSlides, revealCount } from "./studentTutorials";
import { buildTimeline, estimateVoiceSeconds, isTalking, locate, sfxEvents, totalSeconds, VOICE_START_S } from "./timeline";
import { TutorialStage, type StageFrame } from "./TutorialStage";
import { useStudentTutorialLang } from "./useStudentTutorialLang";

/** What the video export script (scripts/render-tutorial-videos.mjs) drives in render mode. */
export interface TutorialRenderApi {
  ready: boolean;
  voices: { text: string; mac: string }[];
  /** Sets the real length of each narration; returns the video length and when each narration starts. */
  setVoiceSeconds: (seconds: number[]) => { total: number; voiceStarts: number[] };
  seek: (t: number) => void;
  /** All the sound effects as a base64 WAV. */
  renderSfx: (sampleRate: number) => Promise<string>;
}

declare global {
  interface Window {
    __tutorial?: TutorialRenderApi;
  }
}

const toBase64 = (buf: ArrayBuffer) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** Frame-by-frame mode for the video export: no controls, time set from outside. */
export const RenderStage = ({ app }: { app: AppType }) => {
  const { t } = useStudentTutorialLang();
  const tutorial = STUDENT_TUTORIALS[app];
  const slides = useMemo(() => resolveSlides(tutorial, t), [tutorial, t]);
  const [voiceSeconds, setVoiceSeconds] = useState(() => slides.map((s) => estimateVoiceSeconds(s.voice)));
  const timeline = useMemo(() => buildTimeline(voiceSeconds, slides.map(revealCount)), [voiceSeconds, slides]);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let current = timeline;
    const api: TutorialRenderApi = {
      ready: false,
      voices: slides.map((s) => ({ text: s.voice, mac: VOICES[s.speaker].mac })),
      setVoiceSeconds: (seconds) => {
        current = buildTimeline(seconds, slides.map(revealCount));
        flushSync(() => setVoiceSeconds(seconds));
        return { total: totalSeconds(current), voiceStarts: current.map((s) => s.start + VOICE_START_S) };
      },
      seek: (t) => flushSync(() => setTime(t)),
      renderSfx: async (rate) => toBase64(await renderSfxWav(sfxEvents(current), totalSeconds(current), rate)),
    };
    window.__tutorial = api;
    void document.fonts.ready.then(() => (api.ready = true));
    return () => {
      delete window.__tutorial;
    };
    // the API is created once; it rebuilds the timeline itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides]);

  const { index, t: at } = locate(timeline, time);
  const frame: StageFrame = { index, t: at, clock: time, talking: isTalking(timeline[index], at) };
  return (
    <ScaledStage fit className="h-screen w-screen bg-black">
      <TutorialStage tutorial={tutorial} slides={slides} timeline={timeline} frame={frame} />
    </ScaledStage>
  );
};
