/**
 * POST /api/auth/login
 * Proxies login credentials to the PHP backend.
 * On success, sets the returned JWT as an httpOnly cookie and returns
 * the user payload so the client can update its UI state.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/login
 *
 * Expected PHP response shape:
 *   { token: string; user: { id, email, full_name, role, email_verified, created_at } }
 * Error shapes:
 *   { message: "EMAIL_NOT_VERIFIED" }  →  forwarded so the client knows to prompt verification
 *   { message: "INVALID_CREDENTIALS" } →  forwarded
 */

import { NextResponse } from "next/server";
import { JWT_COOKIE } from "@/lib/auth/session";
import { postToPhpApi } from "@/lib/auth/php-client";

// Cookie lifetime: 7 days (adjust to match your JWT expiry)
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string; password: string };

    const result = await postToPhpApi<{ token: string; user: Record<string, unknown> }>(
      "/auth/login",
      { email: body.email, password: body.password },
      "Login failed."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { token, user } = result.data;

    const response = NextResponse.json({ success: true, user });

    response.cookies.set(JWT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (err) {
    console.error("[api/auth/login]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
