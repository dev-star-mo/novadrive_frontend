/**
 * POST /api/auth/register
 * Proxies registration to the PHP backend.
 * On success the PHP backend sends a verification email — no JWT is issued yet.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/register
 */

import { NextResponse } from "next/server";
import { postToPhpApi } from "@/lib/auth/php-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email: string; password: string };

    const result = await postToPhpApi(
      "/auth/register",
      {
        email: body.email,
        password: body.password,
      },
      "Registration failed."
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/auth/register]", err);
    return NextResponse.json({ error: "Server error. Please try again." }, { status: 500 });
  }
}
