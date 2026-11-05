import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeechDictation } from "./useSpeechDictation";

/** A fake Web Speech recognizer; the last one created is in `last`. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  static failOnStart = false;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    if (FakeRecognition.failOnStart) throw new Error("InvalidStateError");
  }
  stop() {}
}

const setup = () => {
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  const onFailure = vi.fn();
  const hook = renderHook(() => useSpeechDictation("it", vi.fn(), onFailure));
  return { ...hook, onFailure };
};

describe("useSpeechDictation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeRecognition.failOnStart = false;
  });

  it("says when the microphone is not allowed", () => {
    const { result, onFailure } = setup();
    act(() => result.current.start());
    expect(result.current.listening).toBe(true);
    act(() => FakeRecognition.last!.onerror!({ error: "not-allowed" }));
    expect(result.current.listening).toBe(false);
    expect(onFailure).toHaveBeenCalledWith("denied");
  });

  it("keeps quiet about silence", () => {
    const { result, onFailure } = setup();
    act(() => result.current.start());
    act(() => FakeRecognition.last!.onerror!({ error: "no-speech" }));
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("says when dictation cannot start", () => {
    FakeRecognition.failOnStart = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, onFailure } = setup();
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
    expect(onFailure).toHaveBeenCalledWith("failed");
  });
});
