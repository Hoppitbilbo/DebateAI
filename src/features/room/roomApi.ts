import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, AppType, SessionDetail, SessionSummary, User } from "@/lib/api";
import { APPS } from "@/features/activity/types";
import type { draftBody } from "@/features/teacher/assignmentDraft";

// Data layer of the temporary rooms ("aula lampo"): students join with a
// code, a nickname and an avatar; the teacher manages the room with a
// secret key (no account needed) or as its owner.

export interface Room {
  id: number;
  code: string;
  title: string;
  instructions: string;
  appType: AppType;
  assignmentId?: number;
  teacherId?: number;
  locked: boolean;
  maxGuests: number;
  createdAt: string;
  expiresAt: string;
  guestCount: number;
}

export interface RoomGuest {
  userId: number;
  nickname: string;
  avatar: string;
  joinedAt: string;
  rejoinPending: boolean;
  sessions: number;
  turns: number;
  bestProgress: number;
  status?: SessionDetail["status"];
  lastActivity?: string;
}

/** One stop of a room's path; status and turns are the guest's latest attempt. */
export interface RoomActivity { assignmentId: number; appType: AppType; title: string; status?: SessionDetail["status"]; turns?: number }

/** aiReady is false when no AI model is usable for rooms: the guests could not chat. */
export interface RoomView { room: Room; guests: RoomGuest[]; now: string; aiReady: boolean; activities: RoomActivity[] }

export interface RoomInfo { title: string; appType: AppType; locked: boolean; full: boolean; expiresAt: string }

export interface GuestRoom {
  title: string;
  instructions: string;
  appType: AppType;
  assignmentId?: number;
  expiresAt: string;
  nickname: string;
  avatar: string;
  /** The room's path, with this guest's progress. */
  activities?: RoomActivity[];
}

/** A room opens on an assignment of the teacher's classes, or on one of its own. */
export interface RoomRequest {
  assignmentId?: number;
  /** The activity prepared for this room only (the fields of an assignment). */
  assignment?: ReturnType<typeof draftBody>;
  /** The room's path: several activities prepared for it, done in order. */
  assignments?: ReturnType<typeof draftBody>[];
  minutes: number;
  maxGuests?: number;
}

export interface OpenedRoom { room: Room; hostKey: string }

export interface RoomPreview { title: string; appType: AppType; createdAt: string; guests: { nickname: string; avatar: string; sessions: number }[] }

export interface ImportMatch { nickname: string; studentId: number }

export interface ImportResult { sessions: number; students: number; discarded: number }

/** Text limits, the same as the server's (domain.MaxNicknameChars). */
export const ROOM_LIMITS = { nickname: 20 } as const;

/** How often the screens refresh (ms): the teacher's lobby, the dashboard list, the guest's room. */
export const REFRESH_MS = { lobby: 4000, openRooms: 30000, guestRoom: 60000 } as const;

/** Slowest lobby refresh while nothing changes, and after failed requests. */
const LOBBY_MAX_IDLE_MS = 15000;
const LOBBY_MAX_RETRY_MS = 30000;
/** Unchanged answers before the lobby refresh slows down. */
const LOBBY_STEADY_POLLS = 3;

/** A room error that retrying will not fix: the room is gone or not ours to manage. */
export const roomIsGone = (e: unknown) => e instanceof ApiError && [401, 403, 404].includes(e.status);

/**
 * Next lobby refresh: every REFRESH_MS.lobby while guests come and go,
 * doubling while the answer stays the same (up to 15 s) and after failures
 * (up to 30 s).
 */
export const lobbyDelay = (unchanged: number, failures: number) =>
  failures > 0
    ? Math.min(LOBBY_MAX_RETRY_MS, REFRESH_MS.lobby * 2 ** failures)
    : unchanged < LOBBY_STEADY_POLLS
      ? REFRESH_MS.lobby
      : Math.min(LOBBY_MAX_IDLE_MS, REFRESH_MS.lobby * 2 ** (unchanged - LOBBY_STEADY_POLLS + 1));

// ---------- host key ----------

/** The secret key of a room lives in this browser only. */
const keyName = (roomId: number) => `debateai-room-key:${roomId}`;

export const hostKeys = {
  get: (roomId: number): string | null => {
    try {
      return localStorage.getItem(keyName(roomId));
    } catch {
      return null;
    }
  },
  save: (roomId: number, key: string) => {
    try {
      localStorage.setItem(keyName(roomId), key);
    } catch {
      /* private mode: the key stays in the link */
    }
  },
  forget: (roomId: number) => {
    try {
      localStorage.removeItem(keyName(roomId));
    } catch {
      /* nothing stored */
    }
  },
};

/** The link that manages a room from any browser; the key stays in the fragment, never sent to the server in a URL. */
export const hostLink = (roomId: number, key: string) => `${window.location.origin}/aula/gestisci/${roomId}#k=${encodeURIComponent(key)}`;

/** Where a guest works: the room's activity, with its assignment when it has one. */
export const activityPath = (room: Pick<GuestRoom, "appType" | "assignmentId">) =>
  `${APPS[room.appType].path}${room.assignmentId ? `?assignment=${room.assignmentId}` : ""}`;

/** The link students open, with the code already filled in. */
export const joinLink = (code: string) => `${window.location.origin}/entra?c=${code}`;

/** The host key header, when this browser has the key of the room. */
const hostHeaders = (roomId: number): Record<string, string> => {
  const key = hostKeys.get(roomId);
  return key ? { "X-Room-Key": key } : {};
};

/** Calls a room endpoint with the host key when this browser has it. */
async function hostRequest<T>(method: string, roomId: number, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/rooms/${roomId}${path}`, {
    method,
    credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...hostHeaders(roomId) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "error", data.message || res.statusText);
  return data as T;
}

/** Saves a downloaded file under the name the server suggests. */
const saveBlob = (blob: Blob, fallback: string, disposition?: string | null) => {
  const name = disposition?.match(/filename\*=UTF-8''([^;]+)/)?.[1];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name ? decodeURIComponent(name) : fallback;
  a.click();
  URL.revokeObjectURL(a.href);
};

async function download(roomId: number, path: string, fallback: string) {
  const res = await fetch(`/api/rooms/${roomId}${path}`, { credentials: "same-origin", headers: hostHeaders(roomId) });
  if (!res.ok) throw new ApiError(res.status, "download_failed", res.statusText);
  saveBlob(await res.blob(), fallback, res.headers.get("Content-Disposition"));
}

// ---------- students ----------

export const roomApi = {
  lookup: (code: string) => api.get<RoomInfo>(`/api/guest/rooms/${encodeURIComponent(code.trim().toUpperCase())}`),
  join: (j: { code: string; nickname: string; avatar: string; locale: string }) => api.post<User>("/api/guest/join", j),
  rejoin: (j: { code: string; nickname: string; pin: string }) => api.post<User>("/api/guest/rejoin", j),
  myRoom: () => api.get<GuestRoom>("/api/guest/room"),

  // ---------- teachers ----------
  open: (r: RoomRequest) => api.post<OpenedRoom>("/api/rooms", r),
  listMine: () => api.get<Room[]>("/api/rooms"),
  view: (id: number) => hostRequest<RoomView>("GET", id, ""),
  setLocked: (id: number, locked: boolean) => hostRequest<RoomView>("PATCH", id, "", { locked }),
  end: (id: number) => hostRequest("DELETE", id, ""),
  pin: (id: number, userId: number) => hostRequest<{ pin: string }>("POST", id, `/guests/${userId}/pin`),
  removeGuest: (id: number, userId: number) => hostRequest("DELETE", id, `/guests/${userId}`),
  session: (id: number, sessionId: number) => hostRequest<SessionDetail>("GET", id, `/sessions/${sessionId}`),
  guestSessions: (id: number, userId: number) => hostRequest<SessionSummary[]>("GET", id, `/guests/${userId}/sessions`),
  downloadXLSX: (id: number, lang: string) => download(id, `/export.xlsx?lang=${lang}`, "aula.xlsx"),
  downloadFile: (id: number) => download(id, "/export.aula", "aula.aula"),

  importPreview: (classId: number, file: string) => api.post<RoomPreview>(`/api/classes/${classId}/room-import/preview`, { file }),
  importIntoClass: (classId: number, source: { roomId?: number; hostKey?: string; file?: string }, matches: ImportMatch[]) =>
    api.post<ImportResult>(`/api/classes/${classId}/room-import`, { ...source, matches }),
};

/**
 * The teacher's live view of a room, refreshed every few seconds (see
 * lobbyDelay). A failed refresh keeps the last data and is tried again; it
 * stops only when the room is gone.
 */
export const useRoomView = (roomId: number) => {
  const qc = useQueryClient();
  // Counted once per answer (refetchInterval may be asked more often).
  const polls = useRef({ seenAt: 0, failedAt: 0, key: "", unchanged: 0, failures: 0 });
  return {
    view: useQuery({
      queryKey: ["room", roomId],
      queryFn: () => roomApi.view(roomId),
      refetchInterval: (q) => {
        const { data, dataUpdatedAt, error, errorUpdatedAt } = q.state;
        if (roomIsGone(error)) return false;
        const p = polls.current;
        if (error && errorUpdatedAt > dataUpdatedAt) {
          if (errorUpdatedAt !== p.failedAt) [p.failedAt, p.failures] = [errorUpdatedAt, p.failures + 1];
        } else if (data && dataUpdatedAt !== p.seenAt) {
          const key = JSON.stringify({ ...data, now: undefined }); // the server clock always changes
          [p.seenAt, p.failures, p.unchanged, p.key] = [dataUpdatedAt, 0, key === p.key ? p.unchanged + 1 : 0, key];
        }
        return lobbyDelay(p.unchanged, p.failures);
      },
      retry: false,
    }),
    /** Refreshes now, after a local action: the lobby is about to change. */
    refresh: () => {
      polls.current.unchanged = 0;
      void qc.invalidateQueries({ queryKey: ["room", roomId] });
    },
  };
};
