/**
 * POST /api/auth/reset-password
 * Sends the reset token + new password to PHP for verification and update.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/reset-password
 *
 * Body: { token: string; password: string }
 * PHP response on success: { success: true }
 * PHP response on failure: { message: string }  (e.g. "TOKEN_EXPIRED", "TOKEN_INVALID")
 */

import { NextResponse } from "next/server";
import { postToPhpApi } from "@/lib/auth/php-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string; password: string };

    const result = await postToPhpApi(
      "/auth/reset-password",
      { token: body.token, password: body.password },
      "Password reset failed."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/reset-password]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
