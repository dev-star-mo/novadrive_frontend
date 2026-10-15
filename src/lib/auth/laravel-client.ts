/**
 * Browser-side Laravel API client (Bearer token authentication).
 */

import { apiRequest, API_BASE_URL, parseApiError, type ApiErrorBody } from "@/lib/api/client";
import { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/auth/token-store";
import { normalizeAuthUser } from "@/lib/auth/user-normalize";
import type { AuthUser } from "@/lib/auth/types";
import type { AdminUser } from "@/types/admin-user";
import type { Car, CarCategory } from "@/types/database";
import type { Attachment } from "@/types/attachment";

export { getAccessToken, setAccessToken, clearAccessToken } from "@/lib/auth/token-store";

export const LARAVEL_API_BASE = API_BASE_URL;

const JSON_HEADERS: HeadersInit = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

type LaravelErrorBody = ApiErrorBody;

export function parseLaravelErrorBody(data: LaravelErrorBody, fallback: string): string {
  return parseApiError(data, fallback);
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
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
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
  return apiRequest(path, init);
}

async function authJsonFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return apiRequest(path, { ...init, auth: true });
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

  const refreshPath = import.meta.env.VITE_LARAVEL_REFRESH_PATH;
  if (!LARAVEL_API_BASE || !refreshPath) return false;

  try {
    const res = await apiRequest(refreshPath, {
      method: "POST",
      credentials: "include",
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
  token_type: "Bearer";
  user: AuthUser;
};

type LoginResponseUser = {
  id?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  email_verified?: unknown;
  created_at?: unknown;
};

function userFromLoginResponse(raw: LoginResponseUser): AuthUser | null {
  const role = raw.role;
  if (role !== "user" && role !== "admin" && role !== "superadmin") return null;
  if (raw.id == null || raw.email == null || raw.name == null || raw.created_at == null) return null;
  if (typeof raw.email_verified !== "boolean") return null;

  return {
    id: String(raw.id),
    email: String(raw.email),
    full_name: String(raw.name),
    role,
    email_verified: raw.email_verified,
    created_at: String(raw.created_at),
  };
}

export async function loginUser(
  payload: LoginUserPayload
): Promise<{ ok: true; data: LoginSuccess } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
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

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody & {
      token?: unknown;
      token_type?: unknown;
      user?: LoginResponseUser;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Login failed.",
      };
    }

    if (typeof data.token !== "string" || !data.token || data.token_type !== "Bearer" || !data.user) {
      return { ok: false, error: "Login succeeded but the response did not match the expected shape." };
    }

    const user = userFromLoginResponse(data.user);
    if (!user) {
      return { ok: false, error: "Login succeeded but the user object did not match the expected shape." };
    }

    setAccessToken(data.token);
    return {
      ok: true,
      data: { token: data.token, token_type: "Bearer", user },
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function fetchCurrentUser(
  email: string,
  password: string
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/me", {
      method: "POST",
      accept: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: LoginResponseUser;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load the account.",
      };
    }

    if (!data.user) {
      return { ok: false, error: "Account lookup succeeded but the response did not match the expected shape." };
    }

    const user = userFromLoginResponse(data.user);
    if (!user) {
      return { ok: false, error: "Account lookup succeeded but the user object did not match the expected shape." };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function verifyEmail(
  token: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/verify-email", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Verification failed.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Verification succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "A network error occurred. Please try again." };
  }
}

export async function resendVerificationEmail(
  email: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/resend-verification-link", {
      method: "POST",
      accept: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not resend verification email.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Resend succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
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
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/password-update", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        old_password: payload.old_password,
        password: payload.password,
        confirm_password: payload.confirm_password,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not update password.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Password update succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function generateForgotPasswordToken(
  email: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/generate-token", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ email }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not send reset email.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Reset request succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function verifyForgotPasswordToken(
  email: string,
  token: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/verify-token", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email,
        token,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "This reset link is invalid or has expired.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Token check succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
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
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/forgot-password/reset-password", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        confirm_password: payload.confirm_password,
        token: payload.token,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Password reset failed.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Password reset succeeded but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function logoutUser(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not log out.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Logout succeeded but the response did not match the expected shape." };
    }

    clearAccessToken();
    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type RegisterSuccess = {
  message: string;
  user: AuthUser;
};

export async function registerUser(
  payload: RegisterUserPayload
): Promise<{ ok: true; data: RegisterSuccess } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/register", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        password: payload.password,
        confirm_password: payload.confirm_password,
        subscribe_to_newsletter: payload.subscribe_to_newsletter,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as LaravelErrorBody & {
      message?: unknown;
      user?: LoginResponseUser;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Registration failed.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "Registration succeeded but the response did not match the expected shape." };
    }

    const user = userFromLoginResponse(data.user);
    if (!user) {
      return { ok: false, error: "Registration succeeded but the user object did not match the expected shape." };
    }

    return { ok: true, data: { message: data.message, user } };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function fetchGoogleRedirect(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/auth/google/redirect", {
      method: "GET",
      accept: false,
      redirect: "follow",
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      url?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Google sign-in is unavailable.",
      };
    }

    if (typeof data.url !== "string" || !data.url.trim()) {
      return { ok: false, error: "Google redirect succeeded but the response did not match the expected shape." };
    }

    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
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
      error: "API URL is not configured. Set VITE_API_URL.",
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

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      token?: unknown;
      token_type?: unknown;
      user?: LoginResponseUser;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Google sign-in failed.",
      };
    }

    if (typeof data.token !== "string" || !data.token || data.token_type !== "Bearer" || !data.user) {
      return { ok: false, error: "Google sign-in succeeded but the response did not match the expected shape." };
    }

    const role = data.user.role === "customer" ? "user" : data.user.role;
    const user = userFromLoginResponse({ ...data.user, role });
    if (!user) {
      return { ok: false, error: "Google sign-in succeeded but the user object did not match the expected shape." };
    }

    setAccessToken(data.token);
    return {
      ok: true,
      data: { token: data.token, token_type: "Bearer", user },
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
/** Show one user (`GET /users/:id`). */
export async function fetchUser(
  id: string
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/users/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load user.",
      };
    }

    if (!data.user) {
      return { ok: false, error: "User lookup succeeded but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User lookup succeeded but the user record did not match the expected shape." };
    }

    return { ok: true, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type UpdateUserPayload = {
  name: string;
  phone_number: string;
};

/** Update a user (`PUT /users/:id`). */
export async function updateUser(
  id: string,
  payload: UpdateUserPayload
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch(`/users/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: payload.name,
        phone_number: payload.phone_number,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not update user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User updated but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User updated but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Delete a user (`DELETE /users/:id`). */
export async function deleteUser(
  id: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not delete user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "User deleted but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Activate a user (`PATCH /users/:id/activate`). */
export async function activateUser(
  id: string
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/users/${encodeURIComponent(id)}/activate`, {
      method: "PATCH",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not activate user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User activated but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User activated but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Deactivate a user (`PATCH /users/:id/deactivate`). No headers, no body. */
export async function deactivateUser(
  id: string
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/users/${encodeURIComponent(id)}/deactivate`, {
      method: "PATCH",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not deactivate user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User deactivated but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User deactivated but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Promote a user to admin (`POST /users/:id/make-admin`). */
export async function makeUserAdmin(
  id: string
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const headers = new Headers();
    headers.append("Accept", "");
    headers.append("Accept", "application/json");

    const res = await apiRequest(`/users/${encodeURIComponent(id)}/make-admin`, {
      method: "POST",
      accept: false,
      headers,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not make user admin.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User promoted but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User promoted but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Demote a user from admin (`POST /users/:id/demote-admin`). */
export async function demoteUserAdmin(
  id: string
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/users/${encodeURIComponent(id)}/demote-admin`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not demote user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User demoted but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User demoted but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export type CreateUserPayload = {
  name: string;
  email: string;
};

/** Create a user (`POST /users`). */
export async function createUser(
  payload: CreateUserPayload
): Promise<{ ok: true; message: string; user: AdminUser } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/users", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      user?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not create user.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.user) {
      return { ok: false, error: "User created but the response did not match the expected shape." };
    }

    const user = userFromIndex(data.user);
    if (!user) {
      return { ok: false, error: "User created but the user record did not match the expected shape." };
    }

    return { ok: true, message: data.message, user };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** List super admins (`GET /super-admins/list`). */
export async function fetchSuperAdminsList(): Promise<
  { ok: true; super_admins: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/super-admins/list", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      super_admins?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load super admins.",
      };
    }

    if (!Array.isArray(data.super_admins)) {
      return { ok: false, error: "Super admins list succeeded but the response did not match the expected shape." };
    }

    const superAdmins: AdminUser[] = [];
    for (const row of data.super_admins) {
      if (!row || typeof row !== "object") {
        return { ok: false, error: "Super admins list succeeded but a record did not match the expected shape." };
      }
      const admin = userFromIndex(row as Record<string, unknown>);
      if (!admin) {
        return { ok: false, error: "Super admins list succeeded but a record did not match the expected shape." };
      }
      superAdmins.push(admin);
    }

    return { ok: true, super_admins: superAdmins };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** List admins (`GET /admins/list`). */
export async function fetchAdminsList(): Promise<
  { ok: true; admins: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/admins/list", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      admins?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load admins.",
      };
    }

    if (!Array.isArray(data.admins)) {
      return { ok: false, error: "Admins list succeeded but the response did not match the expected shape." };
    }

    const admins: AdminUser[] = [];
    for (const row of data.admins) {
      if (!row || typeof row !== "object") {
        return { ok: false, error: "Admins list succeeded but an admin record did not match the expected shape." };
      }
      const admin = userFromIndex(row as Record<string, unknown>);
      if (!admin) {
        return { ok: false, error: "Admins list succeeded but an admin record did not match the expected shape." };
      }
      admins.push(admin);
    }

    return { ok: true, admins };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function userFromIndex(raw: Record<string, unknown>): AdminUser | null {
  if (raw.id == null || typeof raw.email !== "string") return null;
  if (raw.name != null && typeof raw.name !== "string") return null;
  if (raw.phone_number != null && typeof raw.phone_number !== "string") return null;
  if (typeof raw.role !== "string") return null;
  if (typeof raw.is_active !== "boolean") return null;
  if (typeof raw.email_verified !== "boolean") return null;
  if (typeof raw.created_at !== "string") return null;

  return {
    id: String(raw.id),
    name: raw.name == null ? null : raw.name,
    email: raw.email,
    phone_number: raw.phone_number == null ? null : raw.phone_number,
    role: raw.role,
    is_active: raw.is_active,
    email_verified: raw.email_verified,
    created_at: raw.created_at,
  };
}

/** List users (`GET /users`). */
export async function fetchUsersIndex(): Promise<
  { ok: true; users: AdminUser[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/users", {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      users?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load users.",
      };
    }

    if (!Array.isArray(data.users)) {
      return { ok: false, error: "Users list succeeded but the response did not match the expected shape." };
    }

    const users: AdminUser[] = [];
    for (const row of data.users) {
      if (!row || typeof row !== "object") {
        return { ok: false, error: "Users list succeeded but a user record did not match the expected shape." };
      }
      const user = userFromIndex(row as Record<string, unknown>);
      if (!user) {
        return { ok: false, error: "Users list succeeded but a user record did not match the expected shape." };
      }
      users.push(user);
    }

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

/** Create an attachment (`POST /attachments`). No headers, no body. */
export async function createAttachment(): Promise<
  { ok: true; message: string; attachment: Attachment } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/attachments", {
      method: "POST",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      attachment?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not create attachment.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.attachment) {
      return { ok: false, error: "Attachment created but the response did not match the expected shape." };
    }

    const attachment = attachmentFromIndex(data.attachment);
    if (!attachment) {
      return { ok: false, error: "Attachment created but the record did not match the expected shape." };
    }

    return { ok: true, message: data.message, attachment };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Show one attachment (`GET /attachments/:id`). No headers, no body. */
export async function fetchAttachment(
  id: string
): Promise<{ ok: true; attachment: Attachment } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/attachments/${encodeURIComponent(id)}`, {
      method: "GET",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      attachment?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load attachment.",
      };
    }

    if (!data.attachment) {
      return { ok: false, error: "Attachment lookup succeeded but the response did not match the expected shape." };
    }

    const attachment = attachmentFromIndex(data.attachment);
    if (!attachment) {
      return { ok: false, error: "Attachment lookup succeeded but the record did not match the expected shape." };
    }

    return { ok: true, attachment };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Delete an attachment (`DELETE /attachments/:id`). No headers, no body. */
export async function deleteAttachment(
  id: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/attachments/${encodeURIComponent(id)}`, {
      method: "DELETE",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not delete attachment.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Attachment deleted but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function attachmentFromIndex(raw: Record<string, unknown>): Attachment | null {
  if (raw.id == null) return null;
  if (raw.name != null && typeof raw.name !== "string") return null;
  if (raw.file_name != null && typeof raw.file_name !== "string") return null;
  if (raw.mime_type != null && typeof raw.mime_type !== "string") return null;
  if (typeof raw.url !== "string") return null;
  if (raw.thumbnail_url != null && typeof raw.thumbnail_url !== "string") return null;
  if (raw.original_image_url != null && typeof raw.original_image_url !== "string") return null;
  if (raw.size != null && typeof raw.size !== "number") return null;
  if (raw.attachable_type != null && typeof raw.attachable_type !== "string") return null;
  if (raw.attachable_id != null && typeof raw.attachable_id !== "string" && typeof raw.attachable_id !== "number") return null;
  if (typeof raw.created_at !== "string") return null;

  return {
    id: String(raw.id),
    name: raw.name == null ? null : raw.name,
    file_name: raw.file_name == null ? null : raw.file_name,
    mime_type: raw.mime_type == null ? null : raw.mime_type,
    url: raw.url,
    thumbnail_url: raw.thumbnail_url == null ? null : raw.thumbnail_url,
    original_image_url: raw.original_image_url == null ? null : raw.original_image_url,
    size: raw.size == null ? null : raw.size,
    attachable_type: raw.attachable_type == null ? null : raw.attachable_type,
    attachable_id: raw.attachable_id == null ? null : String(raw.attachable_id),
    created_at: raw.created_at,
  };
}

/** List attachments (`GET /attachments`). No headers, no body. */
export async function fetchAttachmentsIndex(): Promise<
  { ok: true; attachments: Attachment[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/attachments", {
      method: "GET",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      attachments?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load attachments.",
      };
    }

    if (!Array.isArray(data.attachments)) {
      return { ok: false, error: "Attachments list succeeded but the response did not match the expected shape." };
    }

    const attachments: Attachment[] = [];
    for (const row of data.attachments) {
      if (!row || typeof row !== "object") {
        return { ok: false, error: "Attachments list succeeded but a record did not match the expected shape." };
      }
      const attachment = attachmentFromIndex(row as Record<string, unknown>);
      if (!attachment) {
        return { ok: false, error: "Attachments list succeeded but a record did not match the expected shape." };
      }
      attachments.push(attachment);
    }

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
  id: number;
  thumbnail_url: string;
  original_image_url: string;
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
  engine: number | null;
  max_speed: number | null;
  location: string;
  insurance: string;
  keyless_entry: boolean;
  gps: boolean;
  rear_camera: boolean;
  description: string;
  daily_rate_per_day: number;
  weekly_rate_per_day: number | null;
  monthly_rate_per_day: number | null;
  featured_image: {
    id: number | null;
    thumbnail_url: string;
    original_image_url: string;
  };
  gallery: [];
  units: number;
  available: boolean;
  is_active: boolean;
};

function vehicleFromCreate(raw: Record<string, unknown>): Car | null {
  const image = raw.featured_image;
  if (!image || typeof image !== "object") return null;
  const featured = image as Record<string, unknown>;
  if (featured.id != null && typeof featured.id !== "number") return null;
  if (typeof featured.thumbnail_url !== "string" || typeof featured.original_image_url !== "string") return null;
  if (!Array.isArray(raw.gallery)) return null;
  if (raw.id == null || typeof raw.name !== "string" || typeof raw.slug !== "string") return null;
  if (typeof raw.make !== "string" || typeof raw.model !== "string") return null;
  if (typeof raw.category !== "string" || !PUBLIC_VEHICLE_CATEGORIES.has(raw.category as CarCategory)) return null;
  if (typeof raw.transmission !== "string" || typeof raw.fuel_type !== "string") return null;
  if (typeof raw.seats !== "number" || typeof raw.location !== "string") return null;
  if (raw.engine != null && typeof raw.engine !== "number") return null;
  if (raw.max_speed != null && typeof raw.max_speed !== "number") return null;
  if (typeof raw.insurance !== "string" || typeof raw.description !== "string") return null;
  if (typeof raw.keyless_entry !== "boolean" || typeof raw.gps !== "boolean" || typeof raw.rear_camera !== "boolean") return null;
  if (typeof raw.daily_rate_per_day !== "number") return null;
  if (raw.weekly_rate_per_day != null && typeof raw.weekly_rate_per_day !== "number") return null;
  if (raw.monthly_rate_per_day != null && typeof raw.monthly_rate_per_day !== "number") return null;
  if (typeof raw.units !== "number" || typeof raw.available !== "boolean" || typeof raw.is_active !== "boolean") return null;
  if (typeof raw.created_at !== "string") return null;

  const images = raw.gallery.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.thumbnail_url === "string" ? [row.thumbnail_url] : [];
  });

  return {
    id: String(raw.id),
    make: raw.make,
    model: raw.model,
    year: typeof raw.year === "number" ? raw.year : 0,
    slug: raw.slug,
    category: raw.category as CarCategory,
    price_per_day: raw.daily_rate_per_day,
    price_per_week: raw.weekly_rate_per_day == null ? null : raw.weekly_rate_per_day,
    price_per_month: raw.monthly_rate_per_day == null ? null : raw.monthly_rate_per_day,
    location: raw.location,
    image_url: featured.thumbnail_url,
    images,
    description: raw.description,
    features: null,
    available: raw.available,
    seats: raw.seats,
    transmission: raw.transmission,
    fuel_type: raw.fuel_type,
    units_available: raw.units,
    created_at: raw.created_at,
  };
}

/** Create a vehicle (`POST /vehicles`). */
export async function createVehicle(
  payload: CreateVehiclePayload
): Promise<{ ok: true; message: string; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await jsonFetch("/vehicles", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        name: payload.name,
        slug: payload.slug,
        make: payload.make,
        model: payload.model,
        category: payload.category,
        transmission: payload.transmission,
        fuel_type: payload.fuel_type,
        seats: payload.seats,
        engine: payload.engine,
        max_speed: payload.max_speed,
        location: payload.location,
        insurance: payload.insurance,
        keyless_entry: payload.keyless_entry,
        gps: payload.gps,
        rear_camera: payload.rear_camera,
        description: payload.description,
        daily_rate_per_day: payload.daily_rate_per_day,
        weekly_rate_per_day: payload.weekly_rate_per_day,
        monthly_rate_per_day: payload.monthly_rate_per_day,
        featured_image: payload.featured_image,
        gallery: payload.gallery,
        units: payload.units,
        available: payload.available,
        is_active: payload.is_active,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicle?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not create vehicle.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.vehicle) {
      return { ok: false, error: "Vehicle created but the response did not match the expected shape." };
    }

    const vehicle = vehicleFromCreate(data.vehicle);
    if (!vehicle) {
      return { ok: false, error: "Vehicle created but the vehicle record did not match the expected shape." };
    }

    return { ok: true, message: data.message, vehicle };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Update a vehicle (`PUT /vehicles/:id`). Header is only Content-Type. */
export type UpdateVehiclePayload = {
  name: string;
  slug: string;
  make: string;
  model: string;
  category: string;
  transmission: string;
  fuel_type: string;
  seats: number;
  engine: number | null;
  max_speed: number | null;
  location: string;
  insurance: string;
  keyless_entry: boolean;
  gps: boolean;
  rear_camera: boolean;
  description: string;
  daily_rate_per_day: number;
  weekly_rate_per_day: number | null;
  monthly_rate_per_day: number | null;
  featured_image: Record<string, never>;
  gallery: [];
  units: number;
  available: boolean;
  is_active: boolean;
};

export type ShownVehicle = Car & {
  name: string;
  engine: number | null;
  max_speed: number | null;
  insurance: string;
  keyless_entry: boolean;
  gps: boolean;
  rear_camera: boolean;
  is_active: boolean;
};

function vehicleFromUpdate(raw: Record<string, unknown>): ShownVehicle | null {
  if (!raw.featured_image || typeof raw.featured_image !== "object" || Array.isArray(raw.featured_image)) return null;
  const featured = raw.featured_image as Record<string, unknown>;
  if (!Array.isArray(raw.gallery)) return null;
  if (raw.id == null || typeof raw.name !== "string" || typeof raw.slug !== "string") return null;
  if (typeof raw.make !== "string" || typeof raw.model !== "string") return null;
  if (typeof raw.category !== "string" || !PUBLIC_VEHICLE_CATEGORIES.has(raw.category as CarCategory)) return null;
  if (typeof raw.transmission !== "string" || typeof raw.fuel_type !== "string") return null;
  if (typeof raw.seats !== "number" || typeof raw.location !== "string") return null;
  if (raw.engine != null && typeof raw.engine !== "number") return null;
  if (raw.max_speed != null && typeof raw.max_speed !== "number") return null;
  if (typeof raw.insurance !== "string" || typeof raw.description !== "string") return null;
  if (typeof raw.keyless_entry !== "boolean" || typeof raw.gps !== "boolean" || typeof raw.rear_camera !== "boolean") return null;
  if (typeof raw.daily_rate_per_day !== "number") return null;
  if (raw.weekly_rate_per_day != null && typeof raw.weekly_rate_per_day !== "number") return null;
  if (raw.monthly_rate_per_day != null && typeof raw.monthly_rate_per_day !== "number") return null;
  if (typeof raw.units !== "number" || typeof raw.available !== "boolean" || typeof raw.is_active !== "boolean") return null;
  if (typeof raw.created_at !== "string") return null;

  const images = raw.gallery.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.thumbnail_url === "string" ? [row.thumbnail_url] : [];
  });

  return {
    id: String(raw.id),
    make: raw.make,
    model: raw.model,
    year: typeof raw.year === "number" ? raw.year : 0,
    slug: raw.slug,
    category: raw.category as CarCategory,
    price_per_day: raw.daily_rate_per_day,
    price_per_week: raw.weekly_rate_per_day == null ? null : raw.weekly_rate_per_day,
    price_per_month: raw.monthly_rate_per_day == null ? null : raw.monthly_rate_per_day,
    location: raw.location,
    image_url: typeof featured.thumbnail_url === "string" ? featured.thumbnail_url : null,
    images,
    description: raw.description,
    features: null,
    available: raw.available,
    seats: raw.seats,
    transmission: raw.transmission,
    fuel_type: raw.fuel_type,
    units_available: raw.units,
    created_at: raw.created_at,
    name: raw.name,
    engine: raw.engine == null ? null : raw.engine,
    max_speed: raw.max_speed == null ? null : raw.max_speed,
    insurance: raw.insurance,
    keyless_entry: raw.keyless_entry,
    gps: raw.gps,
    rear_camera: raw.rear_camera,
    is_active: raw.is_active,
  };
}

export async function updateVehicle(
  id: string,
  payload: UpdateVehiclePayload
): Promise<{ ok: true; message: string; vehicle: Car } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/vehicles/${encodeURIComponent(id)}`, {
      method: "PUT",
      accept: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        slug: payload.slug,
        make: payload.make,
        model: payload.model,
        category: payload.category,
        transmission: payload.transmission,
        fuel_type: payload.fuel_type,
        seats: payload.seats,
        engine: payload.engine,
        max_speed: payload.max_speed,
        location: payload.location,
        insurance: payload.insurance,
        keyless_entry: payload.keyless_entry,
        gps: payload.gps,
        rear_camera: payload.rear_camera,
        description: payload.description,
        daily_rate_per_day: payload.daily_rate_per_day,
        weekly_rate_per_day: payload.weekly_rate_per_day,
        monthly_rate_per_day: payload.monthly_rate_per_day,
        featured_image: payload.featured_image,
        gallery: payload.gallery,
        units: payload.units,
        available: payload.available,
        is_active: payload.is_active,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicle?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not update vehicle.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.vehicle) {
      return { ok: false, error: "Vehicle updated but the response did not match the expected shape." };
    }

    const vehicle = vehicleFromUpdate(data.vehicle);
    if (!vehicle) {
      return { ok: false, error: "Vehicle updated but the vehicle record did not match the expected shape." };
    }

    return { ok: true, message: data.message, vehicle };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Activate a vehicle (`PATCH /admin/vehicles/:id/activate`). No headers, no body. */
export async function activateVehicle(
  id: string
): Promise<{ ok: true; message: string; vehicle: ShownVehicle } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/admin/vehicles/${encodeURIComponent(id)}/activate`, {
      method: "PATCH",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicle?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not activate vehicle.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.vehicle) {
      return { ok: false, error: "Vehicle activated but the response did not match the expected shape." };
    }

    const vehicle = vehicleFromUpdate(data.vehicle);
    if (!vehicle) {
      return { ok: false, error: "Vehicle activated but the vehicle record did not match the expected shape." };
    }

    return { ok: true, message: data.message, vehicle };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Deactivate a vehicle (`PATCH /admin/vehicles/:id/deactivate`). No headers, no body. */
export async function deactivateVehicle(
  id: string
): Promise<{ ok: true; message: string; vehicle: ShownVehicle } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/admin/vehicles/${encodeURIComponent(id)}/deactivate`, {
      method: "PATCH",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicle?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not deactivate vehicle.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim() || !data.vehicle) {
      return { ok: false, error: "Vehicle deactivated but the response did not match the expected shape." };
    }

    const vehicle = vehicleFromUpdate(data.vehicle);
    if (!vehicle) {
      return { ok: false, error: "Vehicle deactivated but the vehicle record did not match the expected shape." };
    }

    return { ok: true, message: data.message, vehicle };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Delete a vehicle (`DELETE /vehicles/:id?accept=application/json`). Header is only Content-Type. */
export async function deleteVehicle(
  id: string,
  payload: UpdateVehiclePayload
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/vehicles/${encodeURIComponent(id)}?accept=application/json`, {
      method: "DELETE",
      accept: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        slug: payload.slug,
        make: payload.make,
        model: payload.model,
        category: payload.category,
        transmission: payload.transmission,
        fuel_type: payload.fuel_type,
        seats: payload.seats,
        engine: payload.engine,
        max_speed: payload.max_speed,
        location: payload.location,
        insurance: payload.insurance,
        keyless_entry: payload.keyless_entry,
        gps: payload.gps,
        rear_camera: payload.rear_camera,
        description: payload.description,
        daily_rate_per_day: payload.daily_rate_per_day,
        weekly_rate_per_day: payload.weekly_rate_per_day,
        monthly_rate_per_day: payload.monthly_rate_per_day,
        featured_image: payload.featured_image,
        gallery: payload.gallery,
        units: payload.units,
        available: payload.available,
        is_active: payload.is_active,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as { message?: unknown };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not delete vehicle.",
      };
    }

    if (typeof data.message !== "string" || !data.message.trim()) {
      return { ok: false, error: "Vehicle deleted but the response did not match the expected shape." };
    }

    return { ok: true, message: data.message };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Show one vehicle (`GET /vehicles/:id`). Header is only Content-Type. The body uses the same keys as update. */
export async function fetchVehicle(
  id: string,
  payload: UpdateVehiclePayload
): Promise<{ ok: true; vehicle: ShownVehicle } | { ok: false; error: string }> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest(`/vehicles/${encodeURIComponent(id)}`, {
      method: "GET",
      accept: false,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        slug: payload.slug,
        make: payload.make,
        model: payload.model,
        category: payload.category,
        transmission: payload.transmission,
        fuel_type: payload.fuel_type,
        seats: payload.seats,
        engine: payload.engine,
        max_speed: payload.max_speed,
        location: payload.location,
        insurance: payload.insurance,
        keyless_entry: payload.keyless_entry,
        gps: payload.gps,
        rear_camera: payload.rear_camera,
        description: payload.description,
        daily_rate_per_day: payload.daily_rate_per_day,
        weekly_rate_per_day: payload.weekly_rate_per_day,
        monthly_rate_per_day: payload.monthly_rate_per_day,
        featured_image: payload.featured_image,
        gallery: payload.gallery,
        units: payload.units,
        available: payload.available,
        is_active: payload.is_active,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicle?: Record<string, unknown>;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load vehicle.",
      };
    }

    if (!data.vehicle) {
      return { ok: false, error: "Vehicle lookup succeeded but the response did not match the expected shape." };
    }

    const vehicle = vehicleFromUpdate(data.vehicle);
    if (!vehicle) {
      return { ok: false, error: "Vehicle lookup succeeded but the vehicle record did not match the expected shape." };
    }

    return { ok: true, vehicle };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const PUBLIC_VEHICLE_CATEGORIES = new Set<CarCategory>([
  "small_car",
  "mid_sized_car",
  "suv",
  "luxury",
  "corporate_group",
]);

function vehicleFromPublicIndex(raw: Record<string, unknown>): Car | null {
  if (raw.id == null) return null;
  if (typeof raw.make !== "string" || typeof raw.model !== "string") return null;
  if (typeof raw.year !== "number") return null;
  if (raw.slug != null && typeof raw.slug !== "string") return null;
  if (typeof raw.category !== "string" || !PUBLIC_VEHICLE_CATEGORIES.has(raw.category as CarCategory)) return null;
  if (typeof raw.price_per_day !== "number") return null;
  if (raw.price_per_week != null && typeof raw.price_per_week !== "number") return null;
  if (raw.price_per_month != null && typeof raw.price_per_month !== "number") return null;
  if (typeof raw.location !== "string") return null;
  if (raw.image_url != null && typeof raw.image_url !== "string") return null;
  if (!Array.isArray(raw.images) || raw.images.some((item) => typeof item !== "string")) return null;
  if (raw.description != null && typeof raw.description !== "string") return null;
  if (!Array.isArray(raw.features) || raw.features.some((item) => typeof item !== "string")) return null;
  if (typeof raw.available !== "boolean") return null;
  if (typeof raw.seats !== "number") return null;
  if (typeof raw.transmission !== "string" || typeof raw.fuel_type !== "string") return null;
  if (typeof raw.units_available !== "number") return null;
  if (typeof raw.created_at !== "string") return null;

  return {
    id: String(raw.id),
    make: raw.make,
    model: raw.model,
    year: raw.year,
    slug: raw.slug == null ? null : raw.slug,
    category: raw.category as CarCategory,
    price_per_day: raw.price_per_day,
    price_per_week: raw.price_per_week == null ? null : raw.price_per_week,
    price_per_month: raw.price_per_month == null ? null : raw.price_per_month,
    location: raw.location,
    image_url: raw.image_url == null ? null : raw.image_url,
    images: raw.images as string[],
    description: raw.description == null ? null : raw.description,
    features: raw.features as string[],
    available: raw.available,
    seats: raw.seats,
    transmission: raw.transmission,
    fuel_type: raw.fuel_type,
    units_available: raw.units_available,
    created_at: raw.created_at,
  };
}

/** Public vehicle index (`GET /vehicles`). No headers, no body. */
export async function fetchVehiclesIndex(): Promise<
  { ok: true; vehicles: Car[] } | { ok: false; error: string }
> {
  if (!LARAVEL_API_BASE) {
    return {
      ok: false,
      error: "API URL is not configured. Set VITE_API_URL.",
    };
  }

  try {
    const res = await apiRequest("/vehicles", {
      method: "GET",
      accept: false,
    });

    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      vehicles?: unknown;
    };

    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.message === "string" && data.message.trim()
          ? data.message
          : "Could not load vehicles.",
      };
    }

    if (!Array.isArray(data.vehicles)) {
      return { ok: false, error: "Vehicles list succeeded but the response did not match the expected shape." };
    }

    const vehicles: Car[] = [];
    for (const row of data.vehicles) {
      if (!row || typeof row !== "object") {
        return { ok: false, error: "Vehicles list succeeded but a vehicle record did not match the expected shape." };
      }
      const vehicle = vehicleFromPublicIndex(row as Record<string, unknown>);
      if (!vehicle) {
        return { ok: false, error: "Vehicles list succeeded but a vehicle record did not match the expected shape." };
      }
      vehicles.push(vehicle);
    }

    return { ok: true, vehicles };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
