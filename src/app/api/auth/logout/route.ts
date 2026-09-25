/**
 * POST /api/auth/logout
 * Clears the httpOnly JWT cookie.
 * Optionally forwards a logout request to the PHP backend to invalidate the token server-side.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/logout
 */

import { NextResponse } from "next/server";
import { JWT_COOKIE, getTokenFromCookie } from "@/lib/auth/session";
import { PHP_API } from "@/lib/auth/php-client";

export async function POST() {
  const token = await getTokenFromCookie();

  // Notify PHP backend to invalidate the token (fire-and-forget — don't block on failure)
  if (token) {
    fetch(`${PHP_API}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch((err) => console.warn("[api/auth/logout] PHP notification failed:", err));
  }

  const response = NextResponse.json({ success: true });

  // Clear the cookie by setting maxAge to 0
  response.cookies.set(JWT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
