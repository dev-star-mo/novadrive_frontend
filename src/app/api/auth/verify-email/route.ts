/**
 * POST /api/auth/verify-email
 * Proxies the email verification token to the PHP backend for comparison.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/verify-email
 *
 * Body: { token: string }
 * PHP response on success: { success: true }
 * PHP response on failure: { message: string }
 */

import { NextResponse } from "next/server";
import { postToPhpApi } from "@/lib/auth/php-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token: string };

    const result = await postToPhpApi(
      "/auth/verify-email",
      { token: body.token },
      "Verification failed."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/verify-email]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
