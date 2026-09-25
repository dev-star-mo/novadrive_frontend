"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { exchangeGoogleAuthCode } from "@/lib/auth/laravel-client";
import { useUserSession } from "@/components/providers/user-session-provider";

const GOOGLE_OAUTH_ROLE = "customer";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useUserSession();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError(oauthError || "Google sign-in was cancelled or failed.");
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setError("Missing authorization code. Please try signing in with Google again.");
      return;
    }

    const complete = async () => {
      const result = await exchangeGoogleAuthCode({ code, role: GOOGLE_OAUTH_ROLE });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await refreshProfile();
      router.replace("/");
    };

    void complete();
  }, [searchParams, refreshProfile, router]);

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-6 flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="NovaDrive Logo" width={48} height={48} className="rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-white">
            NovaDrive <span className="text-brand-600">Car Rentals</span>
          </span>
        </Link>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-10 shadow-2xl shadow-black/40">
        {error ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-red-500" />
            <h1 className="font-display text-xl font-bold text-slate-900">Google sign-in failed</h1>
            <p className="text-sm leading-relaxed text-slate-600">{error}</p>
            <Link
              href="/auth/login"
              className="mt-2 inline-flex w-full items-center justify-center rounded-2xl bg-onyx-950 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-brand-600"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="text-sm font-medium text-slate-600">Completing Google sign-in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
