/**
 * GET /api/auth/google/callback
 * Receives the JWT token that the PHP backend passes back after completing
 * the Google OAuth flow. Sets it as an httpOnly cookie and redirects home.
 *
 * Expected query params from PHP redirect:
 *   ?token=<JWT>              on success
 *   ?error=<message>          on failure
 *
 * PHP should redirect to: https://<your-site>/api/auth/google/callback?token=...
 */

import { NextResponse } from "next/server";
import { JWT_COOKIE } from "@/lib/auth/session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_VERCEL_URL ??
  "https://novadriverentacar.com";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  if (error || !token) {
    // Redirect home with an error flag that the UI can pick up
    return NextResponse.redirect(`${SITE_URL}/?auth_error=${encodeURIComponent(error ?? "google_failed")}`);
  }

  const response = NextResponse.redirect(`${SITE_URL}/`);

  response.cookies.set(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  return response;
}
