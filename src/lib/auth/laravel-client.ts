/**
 * Browser-side Laravel API client using Sanctum SPA authentication.
 * Session is stored in httpOnly cookies on the API domain; requests use
 * credentials: "include" and CSRF protection via /sanctum/csrf-cookie.
 */

import { normalizeAuthUser } from "@/lib/auth/user-normalize";
import type { AuthUser } from "@/lib/auth/types";

export const LARAVEL_API_BASE =
  process.env.NEXT_PUBLIC_LARAVEL_API_URL ??
  process.env.NEXT_PUBLIC_PHP_API_URL ??
  "";

type LaravelErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

/** Flatten Laravel validation errors into a single user-facing string. */
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

/** True when Laravel rejected login because the account email is not verified yet. */
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

/** Read Laravel's XSRF-TOKEN cookie (must be exposed to the SPA domain via Sanctum config). */
function getXsrfTokenFromDocument(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Prime Sanctum CSRF cookie before state-changing requests. */
export async function ensureSanctumCsrfCookie(): Promise<void> {
  if (!LARAVEL_API_BASE) return;
  await fetch(apiUrl("/sanctum/csrf-cookie"), {
    method: "GET",
    credentials: "include",
  });
}

async function sanctumFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    await ensureSanctumCsrfCookie();
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const xsrf = getXsrfTokenFromDocument();
  if (xsrf) {
    headers.set("X-XSRF-TOKEN", xsrf);
  }

  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });
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
    const res = await sanctumFetch("/login", {
      method: "POST",
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

    const raw = extractUserRecord(data);
    return {
      ok: true,
      data: { user: raw ? normalizeAuthUser(raw) : null },
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

/** Load the authenticated user from Laravel (`POST /me`, Sanctum session cookie). */
export async function fetchCurrentUser(): Promise<
  { ok: true; user: AuthUser } | { ok: false; unauthorized: boolean }
> {
  if (!LARAVEL_API_BASE) {
    return { ok: false, unauthorized: false };
  }

  try {
    const res = await sanctumFetch("/me", {
      method: "POST",
      body: JSON.stringify({}),
    });

    if (res.status === 401 || res.status === 403) {
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
    const res = await sanctumFetch("/verify-email", {
      method: "POST",
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
    const res = await sanctumFetch("/resend-verification-link", {
      method: "POST",
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

  try {
    const res = await sanctumFetch("/password-update", {
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
    const res = await sanctumFetch("/forgot-password/generate-token", {
      method: "POST",
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
    const res = await sanctumFetch("/forgot-password/verify-token", {
      method: "POST",
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
    const res = await sanctumFetch("/forgot-password/reset-password", {
      method: "POST",
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
  if (!LARAVEL_API_BASE) return;

  try {
    await sanctumFetch("/logout", { method: "POST" });
  } catch {
    // Clear local UI state even if the network call fails.
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
    const res = await sanctumFetch("/register", {
      method: "POST",
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
    const res = await sanctumFetch("/auth/code-exchange", {
      method: "POST",
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

    const raw = extractUserRecord(data);
    return {
      ok: true,
      data: { user: raw ? normalizeAuthUser(raw) : null },
    };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
