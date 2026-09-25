/**
 * POST /api/auth/forgot-password
 * Asks the PHP backend to send a password-reset email with a signed token.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/forgot-password
 *
 * Body: { email: string }
 */

import { NextResponse } from "next/server";
import { postToPhpApi } from "@/lib/auth/php-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string };

    const result = await postToPhpApi(
      "/auth/forgot-password",
      { email: body.email },
      "Could not send reset email."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/forgot-password]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
