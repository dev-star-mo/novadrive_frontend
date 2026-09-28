/**
 * Access token storage for Laravel Bearer API auth.
 *
 * - Primary: in-memory (not readable from other tabs; cleared when tab closes if not persisted)
 * - Tab reload: mirrored in sessionStorage (not localStorage)
 *
 * For httpOnly refresh cookies: set NEXT_PUBLIC_LARAVEL_REFRESH_PATH (e.g. "/refresh")
 * on Laravel; call tryRestoreAccessTokenFromRefresh() on app boot.
 */

const SESSION_ACCESS_KEY = "nova_access_token";

let memoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_ACCESS_KEY);
  if (stored) memoryAccessToken = stored;
  return memoryAccessToken;
}

export function setAccessToken(token: string): void {
  memoryAccessToken = token;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_ACCESS_KEY, token);
  }
}

export function clearAccessToken(): void {
  memoryAccessToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_ACCESS_KEY);
  }
}
