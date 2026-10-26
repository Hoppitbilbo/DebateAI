// Exports the student tutorials (the 8-bit slides of /tutorial-player/:app)
// as MP4 videos: macOS `say` reads the narration, the page draws each frame
// and renders the 8-bit effects, ffmpeg puts pictures and sound together.
//
// Usage: node scripts/render-tutorial-videos.mjs [--app convinci-tu] [--fps 15] [--out tutorial-videos] [--stills]
//   --stills  saves two PNGs per slide (mid-morph and complete) instead of the video
// Needs macOS (say), ffmpeg and the Playwright Chromium (npx playwright install chromium).

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createServer } from "vite";

const APPS = ["convinci-tu", "doppia-intervista", "personaggio-misterioso", "impersona-tu", "you-moderate", "wiki-chatbot"];
const SAMPLE_RATE = 24000;
const VIEWPORT = { width: 1280, height: 720 };
const NARRATION_GAIN = 1;

const { values: args } = parseArgs({
  options: {
    app: { type: "string" },
    fps: { type: "string", default: "15" },
    out: { type: "string", default: "tutorial-videos" },
    stills: { type: "boolean", default: false },
  },
});
const fps = Number(args.fps);
const outDir = resolve(args.out);
const workDir = join(outDir, ".work");
mkdirSync(workDir, { recursive: true });

/** Mono 16-bit PCM samples of a WAV file, as floats. */
const readWav = (buf) => {
  let o = 12;
  while (o < buf.length) {
    const id = buf.toString("ascii", o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (id === "data") {
      const out = new Float32Array(size / 2);
      for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(o + 8 + i * 2) / 0x8000;
      return out;
    }
    o += 8 + size + (size % 2);
  }
  throw new Error("WAV without data chunk");
};

const writeWav = (path, samples) => {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVEfmt ", 8, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 0x7fff), 44 + i * 2));
  writeFileSync(path, buf);
};

const narrate = (text, voice, path) => {
  execFileSync("say", ["-v", voice, "-o", path, "--file-format=WAVE", `--data-format=LEI16@${SAMPLE_RATE}`, text]);
  return readWav(readFileSync(path));
};

/** Pipes PNG frames into ffmpeg and muxes them with the soundtrack. */
const encoder = (audioPath, outPath) => {
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-i", audioPath,
    "-c:v", "libx264", "-preset", "medium", "-tune", "animation", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", outPath,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((ok, ko) => ff.on("close", (code) => (code === 0 ? ok() : ko(new Error(`ffmpeg exited with ${code}`)))));
  const write = (buf) => new Promise((ok) => (ff.stdin.write(buf) ? ok() : ff.stdin.once("drain", ok)));
  return { write, end: () => (ff.stdin.end(), done) };
};

const renderApp = async (page, baseUrl, app) => {
  await page.goto(`${baseUrl}tutorial-player/${app}?render=1`);
  await page.waitForFunction(() => window.__tutorial?.ready === true, null, { timeout: 30000 });
  const voices = await page.evaluate(() => window.__tutorial.voices);

  const narrations = voices.map((v, i) => narrate(v.text, v.mac, join(workDir, `${app}-${i}.wav`)));
  const { total, voiceStarts } = await page.evaluate((s) => window.__tutorial.setVoiceSeconds(s), narrations.map((n) => n.length / SAMPLE_RATE));

  if (args.stills) {
    const starts = voiceStarts.map((v, i) => [v - 0.6, voiceStarts[i + 1] !== undefined ? voiceStarts[i + 1] - 0.6 : total]);
    for (const [i, [start, end]] of starts.entries()) {
      for (const [label, t] of [["morph", start + 0.45], ["full", end - 0.1]]) {
        await page.evaluate((x) => window.__tutorial.seek(x), t);
        await page.screenshot({ path: join(outDir, `${app}-${i + 1}-${label}.png`) });
      }
    }
    return null;
  }

  const sfx = readWav(Buffer.from(await page.evaluate((r) => window.__tutorial.renderSfx(r), SAMPLE_RATE), "base64"));
  const mix = new Float32Array(Math.ceil(total * SAMPLE_RATE));
  mix.set(sfx.subarray(0, mix.length));
  narrations.forEach((n, i) => {
    const at = Math.round(voiceStarts[i] * SAMPLE_RATE);
    for (let k = 0; k < n.length && at + k < mix.length; k++) mix[at + k] += n[k] * NARRATION_GAIN;
  });
  const audioPath = join(workDir, `${app}.wav`);
  writeWav(audioPath, mix);

  const outPath = join(outDir, `tutorial-${app}.mp4`);
  const enc = encoder(audioPath, outPath);
  const frames = Math.ceil(total * fps);
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.__tutorial.seek(x), f / fps);
    await enc.write(await page.screenshot({ type: "png" }));
    if (f % (fps * 10) === 0) process.stdout.write(`\r${app}: ${Math.round((f / frames) * 100)}%`);
  }
  await enc.end();
  process.stdout.write(`\r${app}: ${total.toFixed(1)} s -> ${outPath}\n`);
  return outPath;
};

const server = await createServer({ server: { host: "127.0.0.1", port: 5199, strictPort: false }, logLevel: "error" });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // the tutorials need no backend: answer API calls locally instead of proxying them
  await page.route("**/api/**", (route) => route.fulfill({ status: 404, body: "{}" }));
  const videos = [];
  for (const app of args.app ? [args.app] : APPS) {
    const out = await renderApp(page, baseUrl, app);
    if (out) videos.push(out);
  }
  if (videos.length > 1) {
    const list = join(workDir, "list.txt");
    writeFileSync(list, videos.map((v) => `file '${v}'`).join("\n"));
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", join(outDir, "tutorial-tutte-le-app.mp4")]);
    console.log(`all apps -> ${join(outDir, "tutorial-tutte-le-app.mp4")}`);
  }
} finally {
  await browser.close();
  await server.close();
  if (!args.stills) rmSync(workDir, { recursive: true, force: true });
}
