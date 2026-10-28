import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, AppType, SessionDetail, SessionSummary, User } from "@/lib/api";

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

export interface RoomView { room: Room; guests: RoomGuest[]; now: string }

export interface RoomInfo { title: string; appType: AppType; locked: boolean; full: boolean; expiresAt: string }

export interface GuestRoom {
  title: string;
  instructions: string;
  appType: AppType;
  assignmentId?: number;
  expiresAt: string;
  nickname: string;
  avatar: string;
}

export interface RoomRequest {
  title: string;
  instructions: string;
  appType: AppType;
  assignmentId?: number;
  minutes: number;
  maxGuests?: number;
}

export interface OpenedRoom { room: Room; hostKey: string }

export interface RoomPreview { title: string; appType: AppType; createdAt: string; guests: { nickname: string; avatar: string; sessions: number }[] }

export interface ImportMatch { nickname: string; studentId: number }

export interface ImportResult { sessions: number; students: number; discarded: number }

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

/** The link students open, with the code already filled in. */
export const joinLink = (code: string) => `${window.location.origin}/entra?c=${code}`;

/** Calls a room endpoint with the host key when this browser has it. */
async function hostRequest<T>(method: string, roomId: number, path: string, body?: unknown): Promise<T> {
  const key = hostKeys.get(roomId);
  const res = await fetch(`/api/rooms/${roomId}${path}`, {
    method,
    credentials: "same-origin",
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(key ? { "X-Room-Key": key } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error || "error", err.message || res.statusText);
  }
  return (res.headers.get("Content-Type")?.includes("json") ? res.json() : res.blob()) as Promise<T>;
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
  const key = hostKeys.get(roomId);
  const res = await fetch(`/api/rooms/${roomId}${path}`, { credentials: "same-origin", headers: key ? { "X-Room-Key": key } : {} });
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

/** The teacher's live view of a room, refreshed every few seconds. */
export const useRoomView = (roomId: number) => {
  const qc = useQueryClient();
  return {
    view: useQuery({
      queryKey: ["room", roomId],
      queryFn: () => roomApi.view(roomId),
      refetchInterval: (q) => (q.state.error ? false : 4000),
      retry: false,
    }),
    refresh: () => void qc.invalidateQueries({ queryKey: ["room", roomId] }),
  };
};
