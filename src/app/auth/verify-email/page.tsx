"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { verifyEmail } from "@/lib/auth/laravel-client";

type Status = "pending" | "success" | "failed";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const hasRun = useRef(false);

  /* ── Verify token on mount ── */
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (!token) {
      setStatus("failed");
      setErrorMsg("Invalid verification. Please use the link from your email.");
      return;
    }

    const runVerify = async () => {
      const result = await verifyEmail(token);

      if (!result.ok) {
        setStatus("failed");
        setErrorMsg(
          result.error ??
            "Verification failed. The link may have expired. Resend the verification email."
        );
        return;
      }

      setStatus("success");
    };

    void runVerify();
  }, [token]);

  /* ── Progress bar animation + redirect on success ── */
  useEffect(() => {
    if (status !== "success") return;

    const DURATION = 3000; // ms before redirect
    const INTERVAL = 50;   // tick every 50 ms
    const step = (INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + step;
        if (next >= 100) {
          clearInterval(timer);
          window.location.href = "/auth/login";
          return 100;
        }
        return next;
      });
    }, INTERVAL);

    return () => clearInterval(timer);
  }, [status]);

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-6 flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="NovaDrive Logo" width={48} height={48} className="rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-white">
            NovaDrive <span className="text-brand-600">Car Rentals</span>
          </span>
        </Link>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-10 shadow-2xl shadow-black/40">
        {/* ── Loading state ── */}
        {status === "pending" && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="text-sm font-medium text-slate-600">Verifying your email…</p>
          </div>
        )}

        {/* ── Success state ── */}
        {status === "success" && (
          <div className="flex flex-col items-center gap-4 text-center">
            {/* Animated green tick */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-40" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-200">
                <CheckmarkSVG />
              </div>
            </div>

            <h1 className="font-display text-2xl font-black text-slate-900">
              Account Created Successfully
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              Your account has been created successfully. You will be redirected to your account shortly…
            </p>

            {/* Loading bar */}
            <div className="mt-2 w-full">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">Redirecting to login…</p>
            </div>
          </div>
        )}

        {/* ── Failed state ── */}
        {status === "failed" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-200">
              <CrossSVG />
            </div>
            <h1 className="font-display text-2xl font-black text-slate-900">
              Verification Failed
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              {errorMsg ??
                "The verification link is invalid or has expired. Please request a new one."}
            </p>
            <div className="mt-2 flex flex-col gap-2 w-full">
              <Link
                href="/auth/login"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-600"
              >
                Go to sign in
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Inline SVG icons ───────────────────────────────────────────────────── */
function CheckmarkSVG() {
  return (
    <svg
      className="h-10 w-10 text-emerald-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CrossSVG() {
  return (
    <svg
      className="h-10 w-10 text-red-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
