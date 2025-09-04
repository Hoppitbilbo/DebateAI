
export interface WikiCharacter {
  title: string;
  snippet: string;
  pageid: number;
}

export interface Message {
  role: "user" | "character";
  content: string;
}
