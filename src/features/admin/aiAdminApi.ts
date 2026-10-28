import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { resetAiStatus } from "@/services/aiService";

// Data layer of Admin → AI: providers, routing, JEV judge and prices.

export interface ModelInfo { id: string; name?: string; inputPerM?: number; outputPerM?: number; free: boolean; supportLive?: boolean }

export type Kind = "gemini" | "openai" | "anthropic" | "jev";
export interface Provider { id: number; name: string; kind: Kind; baseUrl: string; hasKey: boolean; keyHint?: string; models: ModelInfo[]; enabled: boolean }
export interface RouteTarget { providerId: number; model: string }
export interface Routing { strategy: "ordered" | "free_first" | "cheapest"; tasks: Record<string, RouteTarget[]>; defaultVoice: string }
export interface JevSettings { enabled: boolean; threshold: number; evaluateEvery: number; maxStateChars: number }
/** Temporary rooms ("aula lampo"): limits per guest and per room, and their own models. */
export interface RoomSettings {
  enabled: boolean;
  allowAnonymousTeachers: boolean;
  maxMinutes: number;
  maxGuests: number;
  requestsPerGuestPerHour: number;
  maxRequestsPerRoom: number;
  maxOpenAnonymousRooms: number;
  tasks: Record<string, RouteTarget[]>;
  freeOnly: boolean;
}
export interface AiSettings { routing: Routing; jev: JevSettings; rooms: RoomSettings; tasks: string[]; roomTasks: string[] }
export interface PriceRow { providerId: number; providerName: string; model: string; inputPerM: number; outputPerM: number }

export interface NewProvider {
  name: string;
  kind: Kind;
  baseUrl: string;
  apiKey: string;
  /** Preset list used when the provider cannot list its models. */
  models?: { id: string; free: boolean }[];
}

export interface PriceChange { providerId: number; model: string; inputPerM: number; outputPerM: number; delete?: boolean }

export const useProviders = () => useQuery({ queryKey: ["providers"], queryFn: () => api.get<Provider[]>("/api/admin/providers") });

export const useAiSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api.get<AiSettings>("/api/admin/settings") });

/** Providers and routing changed: reload them and the AI status cache. */
export const useAiRefresh = () => {
  const qc = useQueryClient();
  return () => {
    resetAiStatus();
    void qc.invalidateQueries({ queryKey: ["providers"] });
    void qc.invalidateQueries({ queryKey: ["settings"] });
  };
};

export const providerActions = {
  add: (p: NewProvider) => api.post("/api/admin/providers", p),
  setEnabled: (id: number, enabled: boolean) => api.patch(`/api/admin/providers/${id}`, { enabled }),
  replaceKey: (id: number, apiKey: string) => api.patch(`/api/admin/providers/${id}`, { apiKey }),
  remove: (id: number) => api.del(`/api/admin/providers/${id}`),
  refreshModels: (id: number) => api.post<ModelInfo[]>(`/api/admin/providers/${id}/models`),
  test: (id: number, model: string) => api.post<{ output: string; latencyMs: number }>(`/api/admin/providers/${id}/test`, { model }),
};

/** Saves the routing and the judge settings together. */
export const saveRouting = async (routing: Routing, jev: JevSettings) => {
  await api.put("/api/admin/settings/routing", routing);
  await api.put("/api/admin/settings/jev", jev);
  resetAiStatus();
};

export const usePrices = () => {
  const qc = useQueryClient();
  return {
    prices: useQuery({ queryKey: ["prices"], queryFn: () => api.get<PriceRow[]>("/api/admin/prices") }),
    /** Sets (or with delete: true removes) the price of a model. */
    put: async (change: PriceChange) => {
      await api.put("/api/admin/prices", change);
      void qc.invalidateQueries({ queryKey: ["prices"] });
    },
  };
};

export const saveRooms = (rooms: RoomSettings) => api.put("/api/admin/settings/rooms", rooms);
