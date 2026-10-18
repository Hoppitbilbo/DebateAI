import type { Kind } from "./aiAdminApi";

// Static data of the Admin → AI page.

export interface Preset {
  id: string; name: string; kind: Kind; baseUrl: string; keyUrl?: string; noKey?: boolean; free?: boolean; models?: string[]; note?: string;
}

/** Ready-made providers. Free / local ones first. */
export const PRESETS: Preset[] = [
  { id: "gemini", name: "Google Gemini (AI Studio)", kind: "gemini", baseUrl: "", keyUrl: "https://aistudio.google.com/apikey", free: true, note: "presetNotes.gemini" },
  { id: "opencode", name: "OpenCode Zen", kind: "openai", baseUrl: "https://opencode.ai/inference/openai/v1", keyUrl: "https://opencode.ai/", free: true,
    models: ["big-pickle", "glm-5.3-flash-free", "deepseek-v4.1-flash-free", "mimo-v2.6-flash-free", "nemotron-3.5-super-vl-free", "nemotron-3-ultra-free", "longcat-2.5-preview-free"], note: "presetNotes.opencode" },
  { id: "typesafe", name: "TypeSafe Jev (JEV judge)", kind: "jev", baseUrl: "https://api.typesafe.ai/v1", keyUrl: "https://console.typesafe.ai/", models: ["jev-latest"], note: "presetNotes.typesafe" },
  { id: "jev-openrouter", name: "Jev via OpenRouter (JEV judge)", kind: "jev", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", models: ["jev-latest", "jev-1.13"], note: "presetNotes.jevOpenrouter" },
  { id: "jev", name: "OpenCode Jev (JEV judge)", kind: "jev", baseUrl: "https://opencode.ai/inference/systemone/v1/systemone", keyUrl: "https://opencode.ai/", free: true, models: ["jev-1.13-free", "jev-1.13"], note: "presetNotes.jev" },
  { id: "openrouter", name: "OpenRouter", kind: "openai", baseUrl: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", free: true, note: "presetNotes.openrouter" },
  { id: "groq", name: "Groq", kind: "openai", baseUrl: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys", free: true },
  { id: "cerebras", name: "Cerebras", kind: "openai", baseUrl: "https://api.cerebras.ai/v1", keyUrl: "https://cloud.cerebras.ai/", free: true },
  { id: "mistral", name: "Mistral AI", kind: "openai", baseUrl: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai/api-keys" },
  { id: "ollama", name: "Ollama (local)", kind: "openai", baseUrl: "http://localhost:11434/v1", noKey: true, free: true, note: "presetNotes.local" },
  { id: "lmstudio", name: "LM Studio (local)", kind: "openai", baseUrl: "http://localhost:1234/v1", noKey: true, free: true, note: "presetNotes.local" },
  { id: "openai", name: "OpenAI", kind: "openai", baseUrl: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "anthropic", name: "Anthropic Claude", kind: "anthropic", baseUrl: "https://api.anthropic.com/v1", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "deepseek", name: "DeepSeek", kind: "openai", baseUrl: "https://api.deepseek.com/v1", keyUrl: "https://platform.deepseek.com/api_keys" },
  { id: "custom", name: "Custom (OpenAI-compatible)", kind: "openai", baseUrl: "" },
];

export const VOICES = ["Aoede", "Puck", "Charon", "Kore", "Fenrir", "Leda", "Orus", "Zephyr", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus", "Umbriel", "Algieba", "Despina", "Erinome", "Algenib", "Rasalgethi", "Laomedeia", "Achernar", "Alnilam", "Schedar", "Gacrux", "Pulcherrima", "Achird", "Zubenelgenubi", "Vindemiatrix", "Sadachbia", "Sadaltager", "Sulafat"];

/** Provider kinds that can serve each task (Jev only judges, Live needs Gemini). */
export const TASK_KINDS: Record<string, Kind[]> = {
  chat: ["gemini", "openai", "anthropic"],
  evaluation: ["gemini", "openai", "anthropic"],
  utility: ["gemini", "openai", "anthropic"],
  judge: ["jev", "gemini", "openai", "anthropic"],
  live: ["gemini"],
};
