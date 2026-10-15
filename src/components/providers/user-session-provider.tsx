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
import { logoutUser } from "@/lib/auth/laravel-client";
import type { AuthUser } from "@/lib/auth/types";
import type { Profile } from "@/types/database";

type UserSessionContextValue = {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  refreshProfile: () => Promise<void>;
  acceptSession: (user: AuthUser) => void;
  signOut: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
};

const UserSessionContext = createContext<UserSessionContextValue | null>(null);
const SESSION_USER_KEY = "nova_auth_user";

function readStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function writeStoredUser(user: AuthUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    sessionStorage.removeItem(SESSION_USER_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setLoading(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    setUser(readStoredUser());
    setLoading(false);
  }, []);

  const acceptSession = useCallback((next: AuthUser) => {
    writeStoredUser(next);
    setUser(next);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    const result = await logoutUser();
    if (!result.ok) return result;

    writeStoredUser(null);
    setUser(null);

    if (window.location.pathname.startsWith("/admin")) {
      window.location.href = "/";
    } else {
      window.location.reload();
    }

    return result;
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
      isAdmin: user?.role === "admin" || user?.role === "superadmin",
      isSuperAdmin: user?.role === "superadmin",
      refreshProfile,
      acceptSession,
      signOut,
    }),
    [user, profile, loading, refreshProfile, acceptSession, signOut]
  );

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const ctx = useContext(UserSessionContext);
  if (!ctx) throw new Error("useUserSession must be used within UserSessionProvider");
  return ctx;
}
