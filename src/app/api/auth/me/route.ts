/**
 * GET /api/auth/me
 * Reads the httpOnly JWT cookie, decodes the payload, and returns the user object.
 * Called by the client-side UserSessionProvider on mount and after login.
 *
 * No Supabase. No external network call — the JWT payload is decoded locally.
 */

import { NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth/session";

export async function GET() {
  const user = await getUserFromCookie();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({ user });
}
