import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import i18n from "@/i18n";
import { api, PublicConfig, User } from "@/lib/api";

interface AuthState {
  user: User | null;
  config: PublicConfig | null;
  loading: boolean;
  serverAvailable: boolean;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverAvailable, setServerAvailable] = useState(true);

  const setUser = useCallback((u: User | null) => {
    setUserState(u);
    // The user's saved language wins over the browser default.
    if (u?.locale && u.locale !== i18n.language) {
      void i18n.changeLanguage(u.locale);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [cfg, me] = await Promise.all([
        api.get<PublicConfig>("/api/public/config"),
        api.get<{ user: User | null }>("/api/auth/me"),
      ]);
      setConfig(cfg);
      setUser(me.user);
      setServerAvailable(true);
    } catch {
      setServerAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.post<User>("/api/auth/login", { email, password });
    setUser(u);
    return u;
  }, [setUser]);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, config, loading, serverAvailable, refresh, login, logout, setUser }),
    [user, config, loading, serverAvailable, refresh, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};

export const dashboardPath = (u: User | null) =>
  !u ? "/login" : u.role === "admin" ? "/admin" : u.role === "teacher" ? "/teacher" : "/student";
