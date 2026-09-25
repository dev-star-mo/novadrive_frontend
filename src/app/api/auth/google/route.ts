/**
 * GET /api/auth/google
 * Redirects the browser to the PHP backend's Google OAuth entry point.
 * The PHP backend (using Google API Client) will handle the full OAuth dance
 * and redirect back to /api/auth/google/callback when done.
 *
 * PHP endpoint placeholder: NEXT_PUBLIC_PHP_API_URL/auth/google
 */

import { NextResponse } from "next/server";
import { PHP_API } from "@/lib/auth/php-client";

export async function GET() {
  // The PHP backend will redirect the browser to Google's consent screen.
  return NextResponse.redirect(`${PHP_API}/auth/google`);
}
