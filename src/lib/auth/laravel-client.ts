/**
 * Browser-side Laravel API client (Bearer token authentication).
 */

import { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/auth/token-store";
import { normalizeAuthUser } from "@/lib/auth/user-normalize";
import type { AuthUser } from "@/lib/auth/types";
import type { AdminUser } from "@/types/admin-user";

export { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/auth/token-store";

export const LARAVEL_API_BASE =
  process.env.NEXT_PUBLIC_LARAVEL_API_URL ??
  process.env.NEXT_PUBLIC_PHP_API_URL ??
  "";

const JSON_HEADERS: HeadersInit = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

type LaravelErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

export function parseLaravelErrorBody(data: LaravelErrorBody, fallback: string): string {
  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors).flat()[0];
    if (first) return first;
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  return fallback;
}

export function isUnverifiedLoginError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    message === "EMAIL_NOT_VERIFIED" ||
    m.includes("email not verified") ||
    m.includes("not verified") ||
    m.includes("verify your email") ||
    m.includes("must verify") ||
    m.includes("unverified")
  );
}

function apiUrl(path: string): string {
  return `${LARAVEL_API_BASE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

function extractAccessToken(data: Record<string, unknown>): string {
  const nested = data.data as Record<string, unknown> | undefined;
  return (
    (typeof data.token === "string" && data.token) ||
    (typeof data.access_token === "string" && data.access_token) ||
    (typeof nested?.token === "string" && nested.token) ||
    (typeof nested?.access_token === "string" && nested.access_token) ||
    ""
  );
}

function extractUserRecord(data: Record<string, unknown>): Record<string, unknown> | null {
  if (data.user && typeof data.user === "object") {
    return data.user as Record<string, unknown>;
  }

  const nested = data.data;
  if (nested && typeof nested === "object") {
    const record = nested as Record<string, unknown>;
    if (record.user && typeof record.user === "object") {
      return record.user as Record<string, unknown>;
    }
    if ("email" in record || "id" in record) {
      return record;
    }
  }

  if ("email" in data || "id" in data) {
    return data;
  }

  return null;
}

async function jsonFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), { ...init, headers });
}

async function authJsonFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  if (!token) {
    return new Response(JSON.stringify({ message: "Unauthenticated." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(apiUrl(path), { ...init, headers });
}

async function authJsonFetchWithRefresh(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  let res = await authJsonFetch(path, init);
  if (res.status === 401) {
    const restored = await tryRestoreAccessTokenFromRefresh();
    if (restored) {
      res = await authJsonFetch(path, init);
    }
  }
  return res;
}

/** Optional: restore access token using Laravel httpOnly refresh cookie + credentials. */
export async function tryRestoreAccessTokenFromRefresh(): Promise<boolean> {
  if (getAccessToken()) return true;

  const refreshPath = process.env.NEXT_PUBLIC_LARAVEL_REFRESH_PATH;
  if (!LARAVEL_API_BASE || !refreshPath) return false;

  try {
    const res = await fetch(apiUrl(refreshPath), {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return false;

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const token = extractAccessToken(data);
    if (!token) return false;

    setAccessToken(token);
    return true;
  } catch {
    return false;
  }
}

export type RegisterUserPayload = {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  subscribe_to_newsletter: boolean;
};

export type LoginUserPayload = {
  email: string;
  password: string;
};

export type LoginSuccess = {
  token: string;
  user: AuthUser | null;
};

export async function loginUser(
  payload: LoginUserPayload
): Promise<{ ok: true; data: LoginSuccess } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/login", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Login failed."),
      };
    }

    const token = extractAccessToken(data);
    if (!token) {
      return { ok: false, error: "Login succeeded but no token was returned." };
    }

    setAccessToken(token);
    const raw = extractUserRecord(data);
    return {
      ok: true,
      data: { token, user: raw ? normalizeAuthUser(raw) : null },
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function fetchCurrentUser(): Promise<
  { ok: true; user: AuthUser } | { ok: false; unauthorized: boolean }
> {
  if (!LARAVEL_API_BASE) {
    return { ok: false, unauthorized: false };
  }

  if (!getAccessToken()) {
    await tryRestoreAccessTokenFromRefresh();
  }
  if (!getAccessToken()) {
    return { ok: false, unauthorized: true };
  }

  try {
    const res = await authJsonFetchWithRefresh("/me", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, unauthorized: true };
    }

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, unauthorized: false };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, unauthorized: false };
    }

    return { ok: true, user: normalizeAuthUser(raw) };
  } catch {
    return { ok: false, unauthorized: false };
  }
}

export async function verifyEmail(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/verify-email", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Verification failed."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "A network error occurred. Please try again." };
  }
}

export async function resendVerificationEmail(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/resend-verification-link", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Could not resend verification email."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type UpdatePasswordPayload = {
  old_password: string;
  password: string;
  confirm_password: string;
};

export async function updatePassword(
  payload: UpdatePasswordPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  if (!getAccessToken()) {
    return { ok: false, error: "You must be signed in to change your password." };
  }

  try {
    const res = await authJsonFetchWithRefresh("/password-update", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Could not update password."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function generateForgotPasswordToken(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/generate-token", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Could not send reset email."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function verifyForgotPasswordToken(
  email: string,
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/verify-token", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: email.trim(),
        token,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "This reset link is invalid or has expired."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type ResetForgotPasswordPayload = {
  email: string;
  password: string;
  confirm_password: string;
  token: string;
};

export async function resetForgotPassword(
  payload: ResetForgotPasswordPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/reset-password", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: payload.email.trim(),
        password: payload.password,
        confirm_password: payload.confirm_password,
        token: payload.token,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Password reset failed."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function logoutUser(): Promise<void> {
  if (!LARAVEL_API_BASE) {
    clearAccessToken();
    return;
  }

  try {
    await authJsonFetchWithRefresh("/logout", { method: "POST" });
  } catch {
    // ignore
  } finally {
    clearAccessToken();
  }
}

export async function registerUser(
  payload: RegisterUserPayload
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/register", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Registration failed."),
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function getGoogleOAuthRedirectUrl(): string | null {
  if (!LARAVEL_API_BASE) return null;
  return apiUrl("/auth/google/redirect");
}

export type GoogleCodeExchangePayload = {
  code: string;
  role: string;
};

export async function exchangeGoogleAuthCode(
  payload: GoogleCodeExchangePayload
): Promise<{ ok: true; data: LoginSuccess } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/auth/code-exchange", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        code: payload.code,
        role: payload.role,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Google sign-in failed."),
      };
    }

    const token = extractAccessToken(data);
    if (!token) {
      return { ok: false, error: "Google sign-in succeeded but no token was returned." };
    }

    setAccessToken(token);
    const raw = extractUserRecord(data);
    return {
      ok: true,
      data: { token, user: raw ? normalizeAuthUser(raw) : null },
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function normalizeAdminUser(raw: Record<string, unknown>): AdminUser {
  return {
    id: String(raw.id ?? ""),
    name:
      raw.name != null
        ? String(raw.name)
        : raw.full_name != null
          ? String(raw.full_name)
          : null,
    email: String(raw.email ?? ""),
    role: String(raw.role ?? "customer"),
    email_verified: Boolean(
      raw.email_verified ?? raw.email_verified_at != null
    ),
    created_at: String(raw.created_at ?? ""),
  };
}

function extractUsersList(data: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data as Record<string, unknown>[];
  }
  if (Array.isArray(data.data)) {
    return data.data as Record<string, unknown>[];
  }
  if (data.data && typeof data.data === "object") {
    const nested = data.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) {
      return nested.data as Record<string, unknown>[];
    }
  }
  if (Array.isArray(data.users)) {
    return data.users as Record<string, unknown>[];
  }
  return [];
}

/** List users (`GET /users`, Bearer token). */
export async function fetchUsersIndex(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetchWithRefresh("/users", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load users."),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load users."),
      };
    }

    const users = extractUsersList(data).map(normalizeAdminUser);
    return { ok: true, users };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
