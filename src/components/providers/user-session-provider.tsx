"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchCurrentUser,
  logoutUser,
  tryRestoreAccessTokenFromRefresh,
} from "@/lib/auth/laravel-client";
import type { AuthUser } from "@/lib/auth/types";
import type { Profile } from "@/types/database";

type UserSessionContextValue = {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      await tryRestoreAccessTokenFromRefresh();

      const me = await fetchCurrentUser();
      if (me.ok) {
        setUser(me.user);
        return;
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const refreshProfile = useCallback(async () => {
    setLoading(true);
    await fetchMe();
  }, [fetchMe]);

  const signOut = useCallback(async () => {
    await logoutUser();
    setUser(null);

    if (window.location.pathname.startsWith("/admin")) {
      window.location.href = "/";
    } else {
      window.location.reload();
    }
  }, []);

  const profile = useMemo<Profile | null>(() => {
    if (!user) return null;
    return {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.created_at,
    };
  }, [user]);

  const value = useMemo<UserSessionContextValue>(
    () => ({
      user,
      profile,
      loading,
      isAdmin: user?.role === "admin",
      refreshProfile,
      signOut,
    }),
    [user, profile, loading, refreshProfile, signOut]
  );

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const ctx = useContext(UserSessionContext);
  if (!ctx) throw new Error("useUserSession must be used within UserSessionProvider");
  return ctx;
}
