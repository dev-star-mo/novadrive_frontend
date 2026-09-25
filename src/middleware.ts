import { NextResponse, type NextRequest } from "next/server";

/**
 * Sanctum session cookies live on the Laravel API domain and are not visible here.
 * Route protection for /admin relies on the session provider + Laravel authorization.
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
