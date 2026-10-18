import React, { useCallback, useEffect, useMemo, useState } from "react";
import i18n from "@/i18n";
import type { PublicConfig, User } from "@/lib/api";
import { authApi } from "@/features/auth/authApi";
import { AuthContext } from "./auth";

/** Loads the session and the public config, and provides login/logout to the app. */
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
        authApi.publicConfig(),
        authApi.me(),
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
    const u = await authApi.login(email, password);
    setUser(u);
    return u;
  }, [setUser]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, config, loading, serverAvailable, refresh, login, logout, setUser }),
    [user, config, loading, serverAvailable, refresh, login, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
