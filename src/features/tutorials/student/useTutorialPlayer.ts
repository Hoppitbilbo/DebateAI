import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { playSfx } from "./chiptune";
import { revealCount, VOICES, type SlideContent } from "./studentTutorials";
import { buildTimeline, estimateVoiceSeconds, isTalking, sfxEvents, VOICE_START_S } from "./timeline";
import type { StageFrame } from "./TutorialStage";

/** Longest frame step, so a background tab does not skip whole slides. */
const MAX_STEP_S = 0.1;
/** The slide waits this close to the end of the narration while the voice is still talking. */
const VOICE_HOLD_MARGIN_S = 0.05;

const speech = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

const pickVoice = (lang: string) => {
  const voices = speech()?.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang)) ?? [];
  return voices.find((v) => /google/i.test(v.name)) ?? voices.find((v) => v.localService) ?? voices[0] ?? null;
};

interface Cursor {
  index: number;
  t: number;
  /** Index of the slide whose narration has already started. */
  spoken: number;
}

/**
 * Plays a student tutorial live: moves the clock, reads each slide aloud
 * with the browser voice, plays the 8-bit effects and goes to the next slide
 * when both the animation and the narration are over.
 */
export const useTutorialPlayer = (slides: SlideContent[], lang: string) => {
  const timeline = useMemo(() => buildTimeline(slides.map((s) => estimateVoiceSeconds(s.voice)), slides.map(revealCount)), [slides]);
  const events = useMemo(() => sfxEvents(timeline), [timeline]);
  const cursor = useRef<Cursor>({ index: 0, t: 0, spoken: -1 });
  const [, render] = useReducer((n: number) => n + 1, 0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const speaking = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const tts = !!speech();

  const stopVoice = useCallback(() => {
    speaking.current = false;
    speech()?.cancel();
  }, []);

  const speak = useCallback(
    (slide: SlideContent) => {
      const synth = speech();
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(slide.voice);
      const voice = pickVoice(lang);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? lang;
      u.pitch = VOICES[slide.speaker].pitch;
      u.rate = VOICES[slide.speaker].rate;
      u.onstart = () => (speaking.current = true);
      u.onend = u.onerror = () => (speaking.current = false);
      speaking.current = true;
      synth.speak(u);
    },
    [lang],
  );

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(MAX_STEP_S, (now - last) / 1000);
      last = now;
      const c = cursor.current;
      const timing = timeline[c.index];
      const voiceEnd = VOICE_START_S + timing.voice - VOICE_HOLD_MARGIN_S;
      let t = c.t + dt;
      if (speaking.current && t > voiceEnd) t = Math.max(c.t, voiceEnd);
      if (!muted && c.spoken !== c.index && t >= VOICE_START_S) {
        c.spoken = c.index;
        speak(slides[c.index]);
      }
      if (!muted && audio.current) {
        const from = timing.start + c.t;
        const to = timing.start + t;
        for (const e of events) if (e.t >= from && e.t < to) playSfx(audio.current, e.kind);
      }
      c.t = t;
      if (t >= timing.duration && !speaking.current) {
        if (c.index < slides.length - 1) {
          c.index += 1;
          c.t = 0;
        } else {
          setPlaying(false);
          setEnded(true);
        }
      }
      render();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, muted, timeline, events, slides, speak]);

  useEffect(() => stopVoice, [stopVoice]);

  const goTo = useCallback(
    (index: number) => {
      stopVoice();
      cursor.current = { index: Math.max(0, Math.min(slides.length - 1, index)), t: 0, spoken: -1 };
      setEnded(false);
      render();
    },
    [slides.length, stopVoice],
  );

  const start = useCallback(() => {
    if (!audio.current && typeof AudioContext !== "undefined") audio.current = new AudioContext();
    void audio.current?.resume();
    setStarted(true);
    if (ended) goTo(0);
    setPlaying(true);
  }, [ended, goTo]);

  /** Pausing stops the voice; playing again restarts the current slide so nothing is missed. */
  const pause = useCallback(() => {
    setPlaying(false);
    stopVoice();
    cursor.current = { ...cursor.current, t: 0, spoken: -1 };
    render();
  }, [stopVoice]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (!m) stopVoice();
      else cursor.current.spoken = -1;
      return !m;
    });
  }, [stopVoice]);

  const { index, t } = cursor.current;
  const timing = timeline[index];
  const frame: StageFrame = {
    index,
    t,
    clock: timing.start + t,
    talking: tts && !muted && started ? speaking.current : isTalking(timing, t),
  };

  return { timeline, frame, playing, started, ended, muted, start, pause, goTo, toggleMute };
};
