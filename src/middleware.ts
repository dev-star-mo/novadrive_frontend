import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js middleware cannot read in-memory Bearer tokens.
 * Auth and admin checks use the client session provider + Laravel API.
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
