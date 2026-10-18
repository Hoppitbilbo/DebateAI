// Client for the server-side AI gateway. The browser never sees provider API
// keys: every request goes through /api/ai/*, where the JEV router picks the
// provider/model configured by the administrator (Gemini, OpenCode, OpenRouter,
// Groq, Ollama, ...), applies budgets and records costs.
import { api, ApiError } from "@/lib/api";
import i18n from "@/i18n";

export type AiTask = "chat" | "evaluation" | "utility";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  task?: AiTask;
  system?: string;
  messages: ChatMessage[];
  sessionId?: number | null;
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AiStatus {
  text: boolean;
  live: boolean;
  judge: boolean;
  loggedIn: boolean;
  guestAccess: boolean;
}

let statusCache: Promise<AiStatus> | null = null;

export const getAiStatus = (force = false): Promise<AiStatus> => {
  if (!statusCache || force) {
    statusCache = api.get<AiStatus>("/api/ai/status").catch(() => ({
      text: false, live: false, judge: false, loggedIn: false, guestAccess: false,
    }));
  }
  return statusCache;
};

export const resetAiStatus = () => {
  statusCache = null;
};

/** Translates gateway errors into a message for the student. */
export const formatAiError = (error: unknown): string => {
  if (error instanceof ApiError) {
    const key = `platform.aiErrors.${error.code}`;
    if (i18n.exists(key)) return i18n.t(key);
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return i18n.t("platform.aiErrors.generic");
};

const body = (o: GenerateOptions, stream: boolean) => ({
  task: o.task ?? "chat",
  system: o.system ?? "",
  messages: mergeConsecutive(o.messages.filter((m) => m.content.trim() !== "")),
  sessionId: o.sessionId ?? 0,
  json: o.json ?? false,
  temperature: o.temperature,
  maxTokens: o.maxTokens,
  stream,
});

/** Most providers reject two consecutive turns with the same role. */
const mergeConsecutive = (messages: ChatMessage[]): ChatMessage[] => {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      out.push({ ...m });
    }
  }
  if (out.length === 0 || out[0].role !== "user") {
    out.unshift({ role: "user", content: "(start)" });
  }
  return out;
};

export const generate = async (o: GenerateOptions): Promise<string> => {
  const res = await api.post<{ text: string }>("/api/ai/generate", body(o, false));
  return res.text.trim();
};

/** Streams the answer; onDelta receives each chunk. Resolves with the full text. */
export const generateStream = async (o: GenerateOptions, onDelta: (chunk: string, full: string) => void): Promise<string> => {
  const res = await fetch("/api/ai/generate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body(o, true)),
    signal: o.signal,
  });
  if (!res.ok || !res.body) {
    let data: { error?: string; message?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, data.error || "ai_error", data.message || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!line.startsWith("data:")) continue;
      const evt = JSON.parse(line.slice(5).trim()) as { delta?: string; error?: string; done?: boolean };
      if (evt.error) throw new ApiError(502, "ai_error", evt.error);
      if (evt.delta) {
        full += evt.delta;
        onDelta(evt.delta, full);
      }
    }
  }
  return full.trim();
};

/** One-shot helper: single prompt with optional system instruction. */
export const complete = (prompt: string, system?: string, task: AiTask = "utility", sessionId?: number | null) =>
  generate({ task, system, messages: [{ role: "user", content: prompt }], sessionId });

/** Asks for JSON and parses it leniently (handles ```json fences). */
export const generateJSON = async <T>(o: GenerateOptions): Promise<T> => {
  const text = await generate({ ...o, json: true });
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as T;
};
