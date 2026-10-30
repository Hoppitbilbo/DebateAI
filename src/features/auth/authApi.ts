import { api, EnrollmentMode, PublicConfig, User } from "@/lib/api";

// Data layer of authentication: login, registration from an invite or a
// username class link,
// password reset, first setup and the user's own profile.

/** What a username class link shows before enrolling: nothing but the class. */
export interface ClassInvite { className: string; enrollmentMode: EnrollmentMode }

/** A student account created from a username class link: no e-mail, no role. */
export interface ClassRegistration { code: string; username: string; password: string; locale: string }

export interface InviteInfo { email: string; role: string; className: string; invitedBy: string; locale: string; userExists: boolean }

/** Changes a user may make to their own account. */
export interface ProfileChange { name?: string; locale?: string; currentPassword?: string; newPassword?: string }

export const authApi = {
  publicConfig: () => api.get<PublicConfig>("/api/public/config"),
  me: () => api.get<{ user: User | null }>("/api/auth/me"),
  /** identifier is an e-mail (it has an "@") or a username. */
  login: (identifier: string, password: string) => api.post<User>("/api/auth/login", { identifier, password }),
  logout: () => api.post("/api/auth/logout"),
  inviteInfo: (token: string) => api.get<InviteInfo>(`/api/auth/invite/${encodeURIComponent(token)}`),
  register: (r: { token: string; name: string; password: string; locale: string }) => api.post<User>("/api/auth/register", r),
  classInvite: (code: string) => api.get<ClassInvite>(`/api/auth/class-invite/${encodeURIComponent(code)}`),
  /** Creates the account, enrolls it in the class and logs it in. */
  registerClass: (r: ClassRegistration) => api.post<User>("/api/auth/register-class", r),
  /** Always succeeds from the user's point of view (the server never says whether the account exists). */
  forgotPassword: (email: string) => api.post("/api/auth/forgot", { email }).catch(() => undefined),
  resetPassword: (token: string | null, password: string) => api.post<User>("/api/auth/reset", { token, password }),
  /** Creates the first administrator of a new installation. */
  setup: (s: { name: string; email: string; password: string; locale: string }) => api.post<User>("/api/setup", s),
  updateProfile: (change: ProfileChange) => api.patch<User>("/api/auth/me", change),
};
