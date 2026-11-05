import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  callbacks: null as { onclose: (e: { reason: string }) => void } | null,
  session: { sendRealtimeInput: vi.fn(), sendClientContent: vi.fn(), close: vi.fn() },
}));

vi.mock("@/lib/api", () => ({ api: { post: mocks.post } }));
vi.mock("@google/genai", () => ({
  Modality: { AUDIO: "AUDIO" },
  GoogleGenAI: class {
    live = {
      connect: async ({ callbacks }: { callbacks: typeof mocks.callbacks }) => {
        mocks.callbacks = callbacks;
        return mocks.session;
      },
    };
  },
}));

import { startLiveConversation } from "./liveConversationService";

const usageReports = () => mocks.post.mock.calls.filter(([url]) => url === "/api/ai/live/usage");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockImplementation(async (url: string) =>
    url === "/api/ai/live/token" ? { token: "t", model: "m", voiceName: "Aoede", grantId: 7 } : {});
  // no microphone in jsdom: the service reports it and carries on
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => Promise.reject(new DOMException("denied", "NotAllowedError")) },
  });
});

describe("startLiveConversation", () => {
  it("reports usage once and sends nothing more when the server closes the connection", async () => {
    const onError = vi.fn();
    const ctrl = await startLiveConversation({ onError });
    mocks.callbacks!.onclose({ reason: "dropped" });
    expect(onError).toHaveBeenCalledWith("dropped");

    ctrl.close();
    expect(usageReports()).toHaveLength(1);
    expect(mocks.session.sendRealtimeInput).not.toHaveBeenCalled();
    expect(mocks.session.close).not.toHaveBeenCalled();
  });

  it("closes the connection and reports usage when the student stops", async () => {
    const ctrl = await startLiveConversation({});
    ctrl.close();
    expect(mocks.session.sendRealtimeInput).toHaveBeenCalledWith({ audioStreamEnd: true });
    expect(mocks.session.close).toHaveBeenCalled();
    expect(usageReports()).toHaveLength(1);
  });
});
