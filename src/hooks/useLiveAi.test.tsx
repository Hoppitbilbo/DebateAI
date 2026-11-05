import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StartLiveConversationOptions } from "@/services/liveConversationService";
import { useLiveAi } from "./useLiveAi";

const mocks = vi.hoisted(() => ({
  supported: true,
  start: vi.fn(),
  options: null as StartLiveConversationOptions | null,
  controller: { sendTextTurn: vi.fn(), setMicMuted: vi.fn(), close: vi.fn() },
  toast: vi.fn(),
  t: (key: string) => key,
}));

vi.mock("@/services/liveConversationService", () => ({
  isLiveSupportedByBrowser: () => mocks.supported,
  startLiveConversation: mocks.start,
}));
vi.mock("@/services/voiceSelectionService", () => ({ getBestVoiceForCharacter: async () => "Aoede" }));
vi.mock("@/services/aiService", () => ({
  getAiStatus: async () => ({ live: true }),
  formatAiError: () => "spiegazione",
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: mocks.t }) }));

const setup = () => {
  const callbacks = { onAssistantText: vi.fn(), onUserText: vi.fn(), onTurnComplete: vi.fn() };
  const hook = renderHook(() => useLiveAi({ characterName: "Dante", ...callbacks }));
  return { ...hook, callbacks };
};

/** Turns voice on and waits for the session to be connected. */
const connect = async (result: ReturnType<typeof setup>["result"]) => {
  act(() => result.current.toggleLive());
  await waitFor(() => expect(result.current.liveState).toBe("listening"));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported = true;
  mocks.options = null;
  mocks.start.mockImplementation(async (options: StartLiveConversationOptions) => {
    mocks.options = options;
    return mocks.controller;
  });
});

describe("useLiveAi", () => {
  it("shows that the character is thinking once the student's turn has arrived", async () => {
    const { result } = setup();
    await connect(result);
    // Gemini Live sends the transcription when the turn ends, without marking it finished.
    act(() => mocks.options!.onUserTranscription!("Chi sei?", false));
    expect(result.current.liveState).toBe("thinking");
  });

  it("keeps speaking through a gap between audio chunks, and listens once the turn is complete", async () => {
    const sources: { onended: (() => void) | null }[] = [];
    class FakeAudioContext {
      state = "running";
      currentTime = 0;
      destination = {};
      createBuffer = () => ({ duration: 0.1, getChannelData: () => new Float32Array(2) });
      createBufferSource = () => {
        const src = { buffer: null, onended: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
        sources.push(src);
        return src;
      };
      resume = vi.fn();
      close = vi.fn(async () => undefined);
    }
    vi.stubGlobal("AudioContext", FakeAudioContext);
    try {
      const { result } = setup();
      await connect(result);
      act(() => mocks.options!.onAudioChunk!({ data: "AAAA", mimeType: "audio/pcm;rate=24000" }));
      expect(result.current.liveState).toBe("speaking");
      act(() => sources[0].onended!());
      expect(result.current.liveState).toBe("speaking");
      act(() => mocks.options!.onTurnComplete!());
      expect(result.current.liveState).toBe("listening");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("listens again when the student speaks over the character", async () => {
    const { result } = setup();
    await connect(result);
    act(() => mocks.options!.onUserTranscription!("Aspetta", false));
    act(() => mocks.options!.onInterrupted!());
    expect(result.current.liveState).toBe("listening");
  });

  it("shows that the character is thinking after a typed message", async () => {
    const { result } = setup();
    await connect(result);
    act(() => void result.current.sendLiveText("Ciao"));
    expect(mocks.controller.sendTextTurn).toHaveBeenCalledWith("Ciao");
    expect(result.current.liveState).toBe("thinking");
  });

  it("turns voice off and says to go on in writing when the microphone is missing", async () => {
    const { result, callbacks } = setup();
    await connect(result);
    act(() => mocks.options!.onUserTranscription!("Chi", false));
    act(() => mocks.options!.onError!("microphone"));
    expect(mocks.toast).toHaveBeenCalledWith("platform.live.failed.microphone", expect.anything());
    expect(result.current.liveMode).toBe(false);
    expect(result.current.liveState).toBe("off");
    expect(callbacks.onTurnComplete).toHaveBeenCalledTimes(1); // the half turn is saved
    expect(mocks.controller.close).toHaveBeenCalled();
  });

  it("reports a dropped connection once, without the raw error", async () => {
    const { result } = setup();
    await connect(result);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    act(() => {
      mocks.options!.onError!("WebSocket closed 1011");
      mocks.options!.onClose!();
    });
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith("platform.live.failed.connection", expect.anything());
    expect(result.current.liveMode).toBe(false);
  });

  it("goes back to text when voice cannot start", async () => {
    mocks.start.mockRejectedValue(new Error("token"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = setup();
    act(() => result.current.toggleLive());
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("platform.live.failed.start", expect.objectContaining({ description: "spiegazione" })));
    expect(result.current.liveMode).toBe(false);
    expect(result.current.liveState).toBe("off");
  });

  it("tells when the browser cannot do voice", async () => {
    mocks.supported = false;
    const { result } = setup();
    await waitFor(() => expect(result.current.liveUnsupported).toBe(true));
    expect(result.current.liveAvailable).toBe(false);
  });
});
