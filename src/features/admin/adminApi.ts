import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ClassInfo, Invite, Role, User } from "@/lib/api";

// Data layer of the admin pages: the admin API calls and their React Query
// caches. Components use these hooks and never call `api` directly.

export interface Overview {
  users: Record<Role, number>; classes: number; assignments: number; sessions: number; pendingInvites: number; providers: number;
  monthSpendUsd: number; todaySpendUsd: number; monthBudgetUsd: number; budgetExceeded: boolean; requestsToday: number; errorsToday: number;
  mailConfigured: boolean; routingComplete: boolean;
}

export type UserRow = User & { classes: number; costUsd: number };

export interface General {
  siteName: string; defaultLocale: string; publicUrl: string; guestAccess: boolean; guestLive: boolean;
  guestRequestsPerHour: number; studentRequestsPerDay: number; allowJoinByCode: boolean; liveEnabled: boolean;
}
export interface Smtp { host: string; port: number; username: string; password?: string; from: string; security: string }
export interface Budget { monthlyUsd: number; warnPercent: number; blockPaidWhenExceeded: boolean }
export interface AllSettings { general: General; smtp: Smtp; smtpHasPassword: boolean; budget: Budget }

export interface NewUser { name: string; email: string; password: string; role: Role; locale: string }

export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/api/admin/overview") });

/** Users whose name or e-mail contains q; role "all" means any role. */
export const useUsers = (q: string, role: string) =>
  useQuery({
    queryKey: ["users", q, role],
    queryFn: () => api.get<UserRow[]>(`/api/admin/users?q=${encodeURIComponent(q)}${role !== "all" ? `&role=${role}` : ""}`),
  });

export const useTeachers = () => useQuery({ queryKey: ["users", "", "teacher"], queryFn: () => api.get<UserRow[]>("/api/admin/users?role=teacher") });

export const useUserActions = () => {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["users"] });
  return {
    refresh,
    create: (u: NewUser) => api.post("/api/admin/users", u),
    update: async (id: number, change: Partial<Pick<User, "role" | "active" | "name" | "locale">>) => {
      await api.patch(`/api/admin/users/${id}`, change);
      refresh();
    },
    remove: async (id: number) => {
      await api.del(`/api/admin/users/${id}`);
      refresh();
    },
  };
};

export const useInvites = () => useQuery({ queryKey: ["invites"], queryFn: () => api.get<Invite[]>("/api/admin/invites") });

export const useInviteActions = () => {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ["invites"] });
  return {
    refresh,
    /** Sends the invite again with a new link (the old one stops working). */
    resend: async (id: number) => {
      const invite = await api.post<Invite>(`/api/admin/invites/${id}/resend`);
      refresh();
      return invite;
    },
    remove: async (id: number) => {
      await api.del(`/api/admin/invites/${id}`);
      refresh();
    },
  };
};

export const useAdminClasses = () => {
  const qc = useQueryClient();
  return {
    classes: useQuery({ queryKey: ["classes", "all"], queryFn: () => api.get<ClassInfo[]>("/api/classes") }),
    refresh: () => void qc.invalidateQueries({ queryKey: ["classes"] }),
  };
};

export const useSettings = () => useQuery({ queryKey: ["settings-all"], queryFn: () => api.get<AllSettings>("/api/admin/settings") });

export const useSettingsActions = () => ({
  save: (key: "general" | "smtp" | "budget", value: General | Smtp | Budget) => api.put(`/api/admin/settings/${key}`, value),
  sendTestMail: (to: string) => api.post("/api/admin/smtp/test", { to }),
});

// ---------- costs ----------

export interface Agg { key: string; label?: string; requests: number; errors: number; inputTokens: number; outputTokens: number; costUsd: number }
export interface UsageSummary {
  days: number;
  byDay: Agg[]; byModel: Agg[]; byTask: Agg[]; byProvider: Agg[]; byUser: Agg[]; byClass: Agg[];
  monthSpendUsd: number;
  budget: { monthlyUsd: number; warnPercent: number; blockPaidWhenExceeded: boolean };
}
export interface UsageLogRow { id: number; createdAt: string; user: string; sessionId?: number; provider: string; model: string; task: string; inputTokens: number; outputTokens: number; costUsd: number; ok: boolean; latencyMs: number; error?: string; estimated?: boolean; unpriced?: boolean }

/** Usage aggregated over the last `days` days. */
export const useUsageSummary = (days: string) =>
  useQuery({ queryKey: ["usage", days], queryFn: () => api.get<UsageSummary>(`/api/admin/usage?days=${days}`) });

export const useUsageLog = () => useQuery({ queryKey: ["usage-log"], queryFn: () => api.get<UsageLogRow[]>("/api/admin/usage/log?limit=200") });
