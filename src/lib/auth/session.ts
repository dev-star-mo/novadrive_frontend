/**
 * Server-side helpers for reading and writing the httpOnly JWT cookie.
 * These run in Next.js API routes and middleware — NOT in the browser.
 *
 * Cookie name: nova_jwt
 * The cookie carries the raw JWT string issued by the PHP backend.
 */

import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/auth/types";

export const JWT_COOKIE = "nova_jwt";

/** Decode the base64url-encoded payload of a JWT (no signature verification). */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 → binary → JSON
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Read the JWT from the request cookie store (server component / route handler). */
export async function getTokenFromCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(JWT_COOKIE)?.value ?? null;
}

/**
 * Decode the JWT from the cookie and return the user payload.
 * Returns null if no cookie or if the token is malformed.
 *
 * NOTE: This does NOT verify the JWT signature — the PHP backend owns that.
 *       Signature verification can be added once a public key endpoint is available.
 */
export async function getUserFromCookie(): Promise<AuthUser | null> {
  const token = await getTokenFromCookie();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  // Map the PHP JWT claims to our AuthUser shape.
  // Adjust field names here once you see the actual PHP JWT structure.
  return {
    id: String(payload.sub ?? payload.id ?? ""),
    email: String(payload.email ?? ""),
    full_name: payload.full_name ? String(payload.full_name) : null,
    role: payload.role === "admin" ? "admin" : "user",
    email_verified: Boolean(payload.email_verified ?? false),
    created_at: String(payload.created_at ?? ""),
  };
}
