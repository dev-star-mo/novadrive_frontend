/**
 * Browser-side Laravel API client (Bearer token authentication).
 */

import { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/auth/token-store";
import { normalizeAuthUser } from "@/lib/auth/user-normalize";
import type { AuthUser } from "@/lib/auth/types";
import type { AdminUser } from "@/types/admin-user";
import type { Car } from "@/types/database";
import type { Attachment } from "@/types/attachment";

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
    phone_number:
      raw.phone_number != null ? String(raw.phone_number) : null,
    role: String(raw.role ?? "customer"), // "customer" | "admin" | "superadmin"
    is_active: raw.is_active != null ? Boolean(raw.is_active) : true,
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

/** Fetch a single user (`GET /users/:id`, Bearer token). */
export async function fetchUser(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}`, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not load user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "No user record in response." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type UpdateUserPayload = {
  name?: string;
  phone_number?: string;
};

/** Update a user (`PUT /users/:id`, Bearer token). */
export async function updateUser(
  id: string,
  payload: UpdateUserPayload
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not update user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User updated but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Delete a user (`DELETE /users/:id`, Bearer token). */
export async function deleteUser(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}`, { method: "DELETE" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    // 204 No Content — success with no body
    if (res.status === 204 || res.ok) {
      return { ok: true };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
    return { ok: false, error: parseLaravelErrorBody(data, "Could not delete user.") };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Activate a user (`PATCH /users/:id/activate`, Bearer token). */
export async function activateUser(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}/activate`, { method: "PATCH" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not activate user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User activated but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Deactivate a user (`PATCH /users/:id/deactivate`, Bearer token). */
export async function deactivateUser(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}/deactivate`, { method: "PATCH" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not deactivate user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User deactivated but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Promote a user to admin (`POST /users/:id/make-admin`, Bearer token). */
export async function makeUserAdmin(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}/make-admin`, { method: "POST" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not promote user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User promoted but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Demote a user from admin (`POST /users/:id/demote-admin`, Bearer token). */
export async function demoteUserAdmin(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/users/${id}/demote-admin`, { method: "POST" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not demote user.") };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User demoted but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type CreateUserPayload = {
  name: string;
  email: string;
};

/** Create a user (`POST /users`, Bearer token). */
export async function createUser(
  payload: CreateUserPayload
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        name: payload.name.trim(),
        email: payload.email.trim(),
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Unauthorized."),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Could not create user."),
      };
    }

    const raw = extractUserRecord(data);
    if (!raw) {
      return { ok: false, error: "User created but no record was returned." };
    }

    return { ok: true, user: normalizeAdminUser(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** List super-admins (`GET /super-admins/list`, Bearer token). */
export async function fetchSuperAdminsList(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch("/super-admins/list", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load super-admins."),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load super-admins."),
      };
    }

    const users = extractUsersList(data).map(normalizeAdminUser);
    return { ok: true, users };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** List admin users (`GET /admins/list`, Bearer token). */
export async function fetchAdminsList(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch("/admins/list", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load admins."),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load admins."),
      };
    }

    const users = extractUsersList(data).map(normalizeAdminUser);
    return { ok: true, users };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// Attachments
// ─────────────────────────────────────────────────────────────────────────────

function normalizeAttachment(raw: Record<string, unknown>): Attachment {
  return {
    id: String(raw.id ?? ""),
    name: raw.name != null ? String(raw.name) : null,
    file_name: raw.file_name != null ? String(raw.file_name) : null,
    mime_type: raw.mime_type != null ? String(raw.mime_type) : null,
    url: String(raw.url ?? raw.original_image_url ?? raw.thumbnail_url ?? ""),
    thumbnail_url: raw.thumbnail_url != null ? String(raw.thumbnail_url) : null,
    original_image_url: raw.original_image_url != null ? String(raw.original_image_url) : null,
    size: raw.size != null ? Number(raw.size) : null,
    attachable_type: raw.attachable_type != null ? String(raw.attachable_type) : null,
    attachable_id: raw.attachable_id != null ? String(raw.attachable_id) : null,
    created_at: String(raw.created_at ?? ""),
  };
}

function extractAttachmentsList(data: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (Array.isArray(data.data)) return data.data as Record<string, unknown>[];
  if (data.data && typeof data.data === "object") {
    const nested = data.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[];
  }
  if (Array.isArray(data.attachments)) return data.attachments as Record<string, unknown>[];
  return [];
}

export type CreateAttachmentPayload = {
  file: File;
  attachable_type?: string;  // e.g. "App\Models\Vehicle"
  attachable_id?: string | number;
  name?: string;
};

/**
 * Upload an attachment (`POST /attachments`).
 * Sends multipart/form-data — Bearer token attached, no Content-Type override
 * (browser sets it automatically with the correct boundary).
 */
export async function createAttachment(
  payload: CreateAttachmentPayload
): Promise<{ ok: true; attachment: Attachment } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  const token = getAccessToken();

  const fd = new FormData();
  fd.append("file", payload.file);
  if (payload.attachable_type) fd.append("attachable_type", payload.attachable_type);
  if (payload.attachable_id != null) fd.append("attachable_id", String(payload.attachable_id));
  if (payload.name) fd.append("name", payload.name);

  try {
    const headers: HeadersInit = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(apiUrl("/attachments"), {
      method: "POST",
      headers,
      body: fd,  // browser sets Content-Type: multipart/form-data with boundary
    });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not upload attachment.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, attachment: normalizeAttachment(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Fetch a single attachment (`GET /attachments/:id`).
 * Public endpoint — no Authorization header required.
 */
export async function fetchAttachment(
  id: string
): Promise<{ ok: true; attachment: Attachment } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch(`/attachments/${id}`, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data, "Could not load attachment."),
      };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, attachment: normalizeAttachment(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * Delete an attachment (`DELETE /attachments/:id`).
 * No body. Bearer token sent when available (admin fleet always has one).
 */
export async function deleteAttachment(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  const token = getAccessToken();
  const headers = new Headers({ Accept: "application/json" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  try {
    const res = await fetch(apiUrl(`/attachments/${id}`), {
      method: "DELETE",
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (res.status === 204 || res.ok) {
      return { ok: true };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
    return { ok: false, error: parseLaravelErrorBody(data, "Could not delete attachment.") };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/**
 * List all attachments (`GET /attachments`).
 * Public endpoint — no Authorization header required.
 */
export async function fetchAttachmentsIndex(): Promise<
  { ok: true; attachments: Attachment[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/attachments", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load attachments."),
      };
    }

    const attachments = extractAttachmentsList(data).map(normalizeAttachment);
    return { ok: true, attachments };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vehicles
// ─────────────────────────────────────────────────────────────────────────────

export function normalizeVehicle(raw: Record<string, unknown>): Car {
  // featured_image object → image_url
  let imageUrl: string | null = null;
  if (raw.image_url != null) {
    imageUrl = String(raw.image_url);
  } else if (raw.featured_image && typeof raw.featured_image === "object") {
    const fi = raw.featured_image as Record<string, unknown>;
    imageUrl = String(fi.thumbnail_url ?? fi.original_image_url ?? "");
  }

  // gallery array → images
  let images: string[] | null = null;
  if (Array.isArray(raw.images)) {
    images = raw.images as string[];
  } else if (Array.isArray(raw.gallery)) {
    images = (raw.gallery as Record<string, unknown>[]).map(
      (g) => String(g.thumbnail_url ?? g.original_image_url ?? g)
    );
  }

  return {
    id: String(raw.id ?? ""),
    make: String(raw.make ?? ""),
    model: String(raw.model ?? ""),
    year: Number(raw.year ?? 0),
    slug: raw.slug != null ? String(raw.slug) : null,
    category: (raw.category as Car["category"]) ?? null,
    // API uses daily_rate_per_day / weekly_rate_per_day / monthly_rate_per_day
    price_per_day: Number(raw.price_per_day ?? raw.daily_rate_per_day ?? raw.daily_rate ?? 0),
    price_per_week: raw.price_per_week != null
      ? Number(raw.price_per_week)
      : raw.weekly_rate_per_day != null
        ? Number(raw.weekly_rate_per_day)
        : null,
    price_per_month: raw.price_per_month != null
      ? Number(raw.price_per_month)
      : raw.monthly_rate_per_day != null
        ? Number(raw.monthly_rate_per_day)
        : null,
    location: String(raw.location ?? ""),
    image_url: imageUrl,
    images,
    description: raw.description != null ? String(raw.description) : null,
    features: Array.isArray(raw.features) ? (raw.features as string[]) : null,
    available: Boolean(raw.available ?? raw.is_available ?? true),
    seats: Number(raw.seats ?? 0),
    transmission: String(raw.transmission ?? ""),
    fuel_type: String(raw.fuel_type ?? ""),
    // API uses "units" for stock count
    units_available: Number(raw.units_available ?? raw.units ?? raw.quantity ?? 1),
    created_at: String(raw.created_at ?? ""),
  };
}

function extractVehiclesList(data: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (Array.isArray(data.data)) return data.data as Record<string, unknown>[];
  if (data.data && typeof data.data === "object") {
    const nested = data.data as Record<string, unknown>;
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[];
  }
  if (Array.isArray(data.vehicles)) return data.vehicles as Record<string, unknown>[];
  return [];
}

export type VehicleFeaturedImage = {
  id?: number | null;
  thumbnail_url: string;
  original_image_url?: string;
};

export type CreateVehiclePayload = {
  name: string;
  slug: string;
  make: string;
  model: string;
  category: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  engine?: number | null;
  max_speed?: number | null;
  location: string;
  insurance?: string | null;
  keyless_entry?: boolean;
  gps?: boolean;
  rear_camera?: boolean;
  description?: string | null;
  daily_rate_per_day: number;
  weekly_rate_per_day?: number | null;
  monthly_rate_per_day?: number | null;
  featured_image?: VehicleFeaturedImage | null;
  gallery?: VehicleFeaturedImage[];
  units: number;
  available?: boolean;
  is_active?: boolean;
};

/** Create a vehicle (`POST /vehicles`, Bearer token). */
export async function createVehicle(
  payload: CreateVehiclePayload
): Promise<{ ok: true; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch("/vehicles", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not create vehicle.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, vehicle: normalizeVehicle(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** All fields are optional — send only what changed. */
export type UpdateVehiclePayload = Partial<CreateVehiclePayload>;

/** Update a vehicle (`PUT /vehicles/:id`, Bearer token). */
export async function updateVehicle(
  id: string,
  payload: UpdateVehiclePayload
): Promise<{ ok: true; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/vehicles/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not update vehicle.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, vehicle: normalizeVehicle(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Activate a vehicle (`PATCH /admin/vehicles/:id/activate`, Bearer token). */
export async function activateVehicle(
  id: string
): Promise<{ ok: true; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/admin/vehicles/${id}/activate`, { method: "PATCH" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not activate vehicle.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, vehicle: normalizeVehicle(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Deactivate a vehicle (`PATCH /admin/vehicles/:id/deactivate`, Bearer token). */
export async function deactivateVehicle(
  id: string
): Promise<{ ok: true; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/admin/vehicles/${id}/deactivate`, { method: "PATCH" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not deactivate vehicle.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, vehicle: normalizeVehicle(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Delete a vehicle (`DELETE /vehicles/:id`, Bearer token). */
export async function deleteVehicle(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/vehicles/${id}`, { method: "DELETE" });

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    // 204 No Content — success with no body
    if (res.status === 204 || res.ok) {
      return { ok: true };
    }

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody;
    return { ok: false, error: parseLaravelErrorBody(data, "Could not delete vehicle.") };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Fetch a single vehicle (`GET /vehicles/:id`, Bearer token). */
export async function fetchVehicle(
  id: string
): Promise<{ ok: true; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch(`/vehicles/${id}`, { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody &
      Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return { ok: false, error: parseLaravelErrorBody(data, "Unauthorized.") };
    }

    if (!res.ok) {
      return { ok: false, error: parseLaravelErrorBody(data, "Could not load vehicle.") };
    }

    const raw = extractUserRecord(data) ?? (data as Record<string, unknown>);
    return { ok: true, vehicle: normalizeVehicle(raw) };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** List vehicles (`GET /vehicles`, Bearer token). */
export async function fetchVehiclesIndex(): Promise<
  { ok: true; vehicles: Car[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.",
    };
  }

  try {
    const res = await authJsonFetch("/vehicles", { method: "GET" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 401 || res.status === 403) {
      clearAccessToken();
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load vehicles."),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: parseLaravelErrorBody(data as LaravelErrorBody, "Could not load vehicles."),
      };
    }

    const vehicles = extractVehiclesList(data).map(normalizeVehicle);
    return { ok: true, vehicles };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
