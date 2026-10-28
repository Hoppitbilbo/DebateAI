import { createContext, useContext } from "react";
import type { PublicConfig, User } from "@/lib/api";

// The logged-in user and the server config, shared by the whole app
// (provided by AuthProvider in AuthContext.tsx).

export interface AuthState {
  user: User | null;
  config: PublicConfig | null;
  loading: boolean;
  serverAvailable: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

export const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

/** Where a user lands after login. */
export const dashboardPath = (u: User | null) =>
  !u ? "/login" : u.roomId ? "/aula" : u.role === "admin" ? "/admin" : u.role === "teacher" ? "/teacher" : "/student";
