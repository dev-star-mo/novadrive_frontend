/**
 * Access token storage for Laravel Bearer API auth.
 *
 * - Primary: in-memory
 * - Tab reload: sessionStorage
 * - Middleware hint: non-httpOnly SESSION_FLAG_COOKIE (not a secret)
 *
 * Refresh: NEXT_PUBLIC_LARAVEL_REFRESH_PATH + httpOnly cookie on API domain.
 */

import { SESSION_FLAG_COOKIE } from "@/lib/auth/constants";

const SESSION_ACCESS_KEY = "nova_access_token";

let memoryAccessToken: string | null = null;

function setSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_FLAG_COOKIE}=1; path=/; SameSite=Lax`;
}

function clearSessionFlagCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_FLAG_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_ACCESS_KEY);
  if (stored) {
    memoryAccessToken = stored;
    setSessionFlagCookie();
  }
  return memoryAccessToken;
}

export function setAccessToken(token: string): void {
  memoryAccessToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_ACCESS_KEY, token);
    setSessionFlagCookie();
  }
}

export function clearAccessToken(): void {
  memoryAccessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
    clearSessionFlagCookie();
  }
}
