import type { AppType } from "@/lib/api";

export interface ActivityMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  /** Speaker name for assistant messages (characters) or the role the student plays. */
  name?: string;
  /** Which character produced it in multi-character apps. */
  speakerKey?: string;
  streaming?: boolean;
  error?: boolean;
}

export type ActivityPhase = "setup" | "chat" | "reflection" | "feedback";

export interface AppMeta {
  type: AppType;
  path: string;
  i18nKey: string;
  tutorialPath?: string;
}

export const APPS: Record<AppType, AppMeta> = {
  "convinci-tu": { type: "convinci-tu", path: "/apps/convinci-tu", i18nKey: "convinciTu", tutorialPath: "/apps/convinci-tu/tutorial" },
  "doppia-intervista": { type: "doppia-intervista", path: "/apps/doppia-intervista", i18nKey: "doppiaIntervista", tutorialPath: "/apps/doppia-intervista/tutorial" },
  "wiki-chatbot": { type: "wiki-chatbot", path: "/apps/wiki-chatbot", i18nKey: "wikiChatbot", tutorialPath: "/apps/wiki-chatbot/tutorial" },
  "personaggio-misterioso": { type: "personaggio-misterioso", path: "/apps/personaggio-misterioso", i18nKey: "personaggioMisterioso", tutorialPath: "/apps/personaggio-misterioso/tutorial" },
  "impersona-tu": { type: "impersona-tu", path: "/apps/impersona-tu", i18nKey: "impersonaTu", tutorialPath: "/apps/impersona-tu/tutorial" },
  "you-moderate": { type: "you-moderate", path: "/apps/you-moderate", i18nKey: "youModerate", tutorialPath: "/apps/you-moderate/tutorial" },
};

let counter = 0;
export const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
