/**
 * GET /auth/callback
 *
 * This route previously handled Supabase OAuth code exchange.
 * Auth is now managed by the PHP backend via JWT.
 *
 * - Google OAuth callback is handled by /auth/google/callback?code=...
 * - Email verification is handled by /auth/verify-email?token=...
 * - Password reset is handled by /auth/reset-password?token=...
 *
 * Any lingering old Supabase callback links are redirected to home.
 */

import { NextResponse } from "next/server";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.NEXT_PUBLIC_VERCEL_URL ??
  "https://novadriverentacar.com";

export async function GET() {
  return NextResponse.redirect(`${SITE_URL}/`);
}
