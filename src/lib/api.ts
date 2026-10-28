// Thin fetch wrapper for the DebateAI Go backend. Cookies carry the session.

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    if (res.status === 404 && !err.error && path.startsWith("/api/")) {
      throw new ApiError(503, "server_unreachable", "The DebateAI server is not reachable. Start it with `npm run dev:server`.");
    }
    throw new ApiError(res.status, err.error || "error", err.message || res.statusText);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, undefined, signal),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};

// ---------- shared types (mirror the Go API) ----------

export type Role = "admin" | "teacher" | "student";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  locale: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  /** Set for the temporary guests of a room ("aula lampo"). */
  roomId?: number;
}

export interface PublicConfig {
  siteName: string;
  defaultLocale: string;
  guestAccess: boolean;
  guestLive: boolean;
  allowJoinByCode: boolean;
  liveEnabled: boolean;
  setupRequired: boolean;
  mailConfigured: boolean;
  roomsEnabled?: boolean;
  anonymousRooms?: boolean;
  roomMaxMinutes?: number;
}

export type AppType =
  | "convinci-tu"
  | "doppia-intervista"
  | "wiki-chatbot"
  | "personaggio-misterioso"
  | "impersona-tu"
  | "you-moderate";

export interface WikiRef {
  title: string;
  snippet?: string;
}

/** App-specific presets a teacher can lock in an assignment. All optional. */
export interface AssignmentConfig {
  character?: WikiRef; // convinci-tu, personaggio-misterioso, wiki-chatbot
  characters?: WikiRef[]; // doppia-intervista, you-moderate
  aiCharacter?: WikiRef; // impersona-tu
  userCharacter?: WikiRef; // impersona-tu
  topic?: string;
  questions?: number; // personaggio-misterioso
}

export interface SessionSummary {
  id: number;
  userId?: number;
  userName?: string;
  assignmentId?: number;
  assignmentTitle?: string;
  appType: AppType;
  title: string;
  status: "active" | "goal_reached" | "turn_limit" | "completed" | "abandoned";
  turns: number;
  progress: number;
  scoreConversation?: number;
  scoreReflection?: number;
  /** 0-10, given by the teacher. */
  teacherScore?: number;
  costUsd: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GoalStatus {
  text: string;
  score: number;
  met: boolean;
}

export interface JudgeResult {
  progress: number;
  completed: boolean;
  goals: GoalStatus[] | null;
  offTopic: boolean;
  hint?: string;
  engine: "jev" | "llm" | "none";
  model?: string;
  evaluatedAt: string;
  error?: string;
}

export interface TranscriptMessage {
  role: "user" | "assistant" | "system";
  content: string;
  name?: string;
}

export interface SessionDetail extends SessionSummary {
  context: Record<string, unknown>;
  transcript: TranscriptMessage[];
  jev: Partial<JudgeResult>;
  reflection: string;
  evaluation: string;
  teacherFeedback: string;
  teacherFeedbackAt?: string;
}

export interface Assignment {
  id: number;
  classId: number;
  className: string;
  title: string;
  instructions: string;
  appType: AppType;
  config: AssignmentConfig;
  goals: string[];
  minTurns: number;
  maxTurns: number;
  autoEnd: boolean;
  requireReflection: boolean;
  allowLive: boolean;
  published: boolean;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  mySession?: SessionSummary;
  stats?: { students: number; started: number; completed: number };
}

export interface ClassInfo {
  id: number;
  name: string;
  description: string;
  joinCode?: string;
  ownerId?: number;
  ownerName?: string;
  archived: boolean;
  createdAt: string;
  studentCount: number;
  teacherCount: number;
  assignmentCount: number;
}

export interface Member {
  userId: number;
  name: string;
  email: string;
  role: "student" | "teacher";
  joinedAt: string;
  lastLoginAt?: string;
}

export interface Invite {
  id: number;
  email: string;
  role: Role;
  classId?: number;
  className?: string;
  invitedBy?: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  emailSent: boolean;
  link?: string;
}

export interface InviteResult {
  email: string;
  status: "added" | "invited" | "error";
  emailSent?: boolean;
  link?: string;
  error?: string;
}
