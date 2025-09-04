
export interface WikiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface WikiChatProps {
  wikiTitle: string;
  wikiSummary: string;
}
