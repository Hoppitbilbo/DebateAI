import { api, PublicConfig, User } from "@/lib/api";

// Data layer of authentication: login, registration from an invite,
// password reset, first setup and the user's own profile.

export interface InviteInfo { email: string; role: string; className: string; invitedBy: string; locale: string; userExists: boolean }

/** Changes a user may make to their own account. */
export interface ProfileChange { name?: string; locale?: string; currentPassword?: string; newPassword?: string }

export const authApi = {
  publicConfig: () => api.get<PublicConfig>("/api/public/config"),
  me: () => api.get<{ user: User | null }>("/api/auth/me"),
  login: (email: string, password: string) => api.post<User>("/api/auth/login", { email, password }),
  logout: () => api.post("/api/auth/logout"),
  inviteInfo: (token: string) => api.get<InviteInfo>(`/api/auth/invite/${encodeURIComponent(token)}`),
  register: (r: { token: string; name: string; password: string; locale: string }) => api.post<User>("/api/auth/register", r),
  /** Always succeeds from the user's point of view (the server never says whether the account exists). */
  forgotPassword: (email: string) => api.post("/api/auth/forgot", { email }).catch(() => undefined),
  resetPassword: (token: string | null, password: string) => api.post<User>("/api/auth/reset", { token, password }),
  /** Creates the first administrator of a new installation. */
  setup: (s: { name: string; email: string; password: string; locale: string }) => api.post<User>("/api/setup", s),
  updateProfile: (change: ProfileChange) => api.patch<User>("/api/auth/me", change),
};
