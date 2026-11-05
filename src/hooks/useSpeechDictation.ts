import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in lib.dom for all TS versions).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

const LOCALES: Record<string, string> = { it: "it-IT", en: "en-US", es: "es-ES", fr: "fr-FR", de: "de-DE" };

const getCtor = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Why dictation stopped by itself: no microphone (or no permission), or another failure. */
export type DictationFailure = "denied" | "failed";

/** Web Speech errors that mean no access to the microphone. */
const DENIED = new Set(["not-allowed", "service-not-allowed", "audio-capture"]);
/** Web Speech errors that are not failures: silence, or a stop asked for. */
const QUIET = new Set(["no-speech", "aborted"]);

/**
 * Free, on-device dictation via the browser's Web Speech API (no AI cost).
 * `onText` receives the full text dictated in this session; `onFailure` is
 * told when dictation stops because of an error.
 */
export const useSpeechDictation = (language: string, onText: (text: string) => void, onFailure?: (kind: DictationFailure) => void) => {
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const cb = useRef(onText);
  cb.current = onText;
  const failureCb = useRef(onFailure);
  failureCb.current = onFailure;
  const supported = !!getCtor();

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback((prefix = "") => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = LOCALES[language.slice(0, 2)] ?? language;
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      cb.current(`${prefix}${prefix && !prefix.endsWith(" ") ? " " : ""}${finalText}${interim}`.trimStart());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      if (!QUIET.has(e.error)) failureCb.current?.(DENIED.has(e.error) ? "denied" : "failed");
    };
    try {
      rec.start();
    } catch (e) {
      console.error("Dictation could not start:", e);
      failureCb.current?.("failed");
      return;
    }
    recRef.current = rec;
    setListening(true);
  }, [language]);

  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, start, stop };
};
