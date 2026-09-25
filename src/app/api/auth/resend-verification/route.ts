/**
 * POST /api/auth/resend-verification
 * Asks the PHP backend to resend the verification email for the given address.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/resend-verification
 *
 * Body: { email: string }
 */

import { NextResponse } from "next/server";
import { postToPhpApi } from "@/lib/auth/php-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string };

    const result = await postToPhpApi(
      "/auth/resend-verification",
      { email: body.email },
      "Could not resend verification email."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/resend-verification]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
