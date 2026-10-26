import type { SfxEvent, SfxKind } from "./timeline";

// 8-bit sound effects made with oscillators: the same code plays them live
// (AudioContext) and renders them for the video export (OfflineAudioContext).

const VOLUME = 0.06;

const tone = (ctx: BaseAudioContext, out: AudioNode, when: number, freq: number, dur: number, opts: { to?: number; type?: OscillatorType; gain?: number } = {}) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(freq, when);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, when + dur);
  gain.gain.setValueAtTime(opts.gain ?? VOLUME, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain).connect(out);
  osc.start(when);
  osc.stop(when + dur + 0.02);
};

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const SOUNDS: Record<SfxKind, (ctx: BaseAudioContext, out: AudioNode, when: number) => void> = {
  blip: (ctx, out, when) => {
    tone(ctx, out, when, 880, 0.05);
    tone(ctx, out, when + 0.05, 1320, 0.06);
  },
  whoosh: (ctx, out, when) => {
    tone(ctx, out, when, 180, 0.28, { to: 1200, type: "triangle", gain: VOLUME * 1.6 });
    tone(ctx, out, when + 0.04, 90, 0.22, { to: 600, gain: VOLUME * 0.5 });
  },
  jingle: (ctx, out, when) => {
    [C5, E5, G5].forEach((f, i) => tone(ctx, out, when + i * 0.09, f, 0.09));
    tone(ctx, out, when + 0.27, C6, 0.45);
  },
};

export const playSfx = (ctx: BaseAudioContext, kind: SfxKind, when = ctx.currentTime) => SOUNDS[kind](ctx, ctx.destination, when);

const encodeWav = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 0x7fff, true));
  return buf;
};

/** All the effects of a tutorial as a mono 16-bit WAV, for the video export. */
export const renderSfxWav = async (events: SfxEvent[], seconds: number, sampleRate: number): Promise<ArrayBuffer> => {
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  for (const e of events) playSfx(ctx, e.kind, e.t);
  const audio = await ctx.startRendering();
  return encodeWav(audio.getChannelData(0), sampleRate);
};
