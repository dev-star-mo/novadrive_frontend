"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, KeyRound, AlertCircle, Mail } from "lucide-react";
import {
  generateForgotPasswordToken,
  resetForgotPassword,
  verifyForgotPasswordToken,
} from "@/lib/auth/laravel-client";

type Stage = "form" | "success" | "failed";

/* ─── Password field ─────────────────────────────────────────────────────── */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-onyx-950">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 pr-12 text-sm font-medium text-onyx-950 outline-none transition-all focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailFromLink = searchParams.get("email") ?? "";

  const [stage, setStage] = useState<Stage>("form");
  const [resetEmail, setResetEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const hasToken = Boolean(token);
  const submittedOnce = useRef(false);
  const [requestEmail, setRequestEmail] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestInfo, setRequestInfo] = useState<string | null>(null);
  const [requestErr, setRequestErr] = useState<string | null>(null);

  /* ── Redirect countdown on success ── */
  useEffect(() => {
    if (stage !== "success") return;

    const DURATION = 3000;
    const INTERVAL = 50;
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
  }, [stage]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (submittedOnce.current) return;
    setErr(null);

    if (!token) {
      setErr("No reset token found. Please use the link from your email.");
      return;
    }
    if (!resetEmail.trim()) {
      setErr("Please enter the email address for your account.");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const verify = await verifyForgotPasswordToken(resetEmail.trim(), token);

      if (!verify.ok) {
        setStage("failed");
        setErr(verify.error);
        return;
      }

      const reset = await resetForgotPassword({
        email: resetEmail.trim(),
        password,
        confirm_password: confirm,
        token,
      });

      if (!reset.ok) {
        setStage("failed");
        setErr(reset.error);
        return;
      }

      submittedOnce.current = true;
      setStage("success");
    } catch {
      setStage("failed");
      setErr("A network error occurred. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const requestResetLink = async (e?: FormEvent) => {
    e?.preventDefault();
    setRequestErr(null);
    setRequestInfo(null);

    if (!requestEmail.trim()) {
      setRequestErr("Please enter your email address.");
      return;
    }

    setRequestBusy(true);
    const result = await generateForgotPasswordToken(requestEmail.trim());
    setRequestBusy(false);

    if (!result.ok) {
      setRequestErr(result.error);
      return;
    }

    setRequestInfo(
      "If an account exists for this email, a password reset link has been sent to your inbox."
    );
  };

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

        {stage === "form" && (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-600/20 bg-brand-600/10">
              <KeyRound className="h-7 w-7 text-brand-600" />
            </div>
            <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">
              {hasToken ? "Set New Password" : "Reset password"}
            </h1>
            <p className="mt-3 max-w-sm text-sm font-medium leading-relaxed text-slate-400">
              {hasToken
                ? "Choose a secure password for your NovaDrive account."
                : "We will email you a link to choose a new password."}
            </p>
          </>
        )}
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl shadow-black/40">
        {/* ── Missing token state ── */}
        {!hasToken && stage === "form" && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-600/20 bg-brand-600/10">
                <Mail className="h-6 w-6 text-brand-600" />
              </div>
              <h2 className="font-display text-lg font-bold text-slate-900">Forgot your password?</h2>
              <p className="text-sm font-medium text-slate-600">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            {requestErr && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-xs font-medium leading-relaxed text-red-700">{requestErr}</p>
              </div>
            )}
            {requestInfo && (
              <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
                {requestInfo}
              </p>
            )}

            <form onSubmit={(e) => void requestResetLink(e)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-onyx-950">
                  Email
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-medium text-onyx-950 outline-none transition-all focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
                />
              </div>
              <button
                type="submit"
                disabled={requestBusy}
                className="w-full rounded-2xl bg-onyx-950 py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {requestBusy ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-xs font-medium text-slate-500">
              <Link href="/auth/login" className="text-brand-600 transition-colors hover:text-brand-500">
                Back to sign in
              </Link>
            </p>
          </div>
        )}

        {/* ── Password form ── */}
        {hasToken && stage === "form" && (
          <form onSubmit={(e) => void submit(e)} className="space-y-5">
            {err && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-xs font-medium leading-relaxed text-red-700">{err}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-onyx-950">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="Email for your account"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                readOnly={Boolean(emailFromLink)}
                className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-medium text-onyx-950 outline-none transition-all focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20 read-only:opacity-80"
              />
            </div>

            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <PasswordField
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-onyx-950 py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Saving…" : "Update password"}
            </button>

            <p className="text-center text-xs font-medium text-slate-500">
              <Link href="/" className="text-brand-600 transition-colors hover:text-brand-500">
                Cancel and return home
              </Link>
            </p>
          </form>
        )}

        {/* ── Success state ── */}
        {stage === "success" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-emerald-100 opacity-40" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-200">
                <CheckmarkSVG />
              </div>
            </div>

            <h1 className="font-display text-2xl font-black text-slate-900">
              Reset Password Successful
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              Your password was reset successfully. Redirecting you to login page…
            </p>

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

        {/* ── Failed state (token invalid / expired after submit attempt) ── */}
        {stage === "failed" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 ring-4 ring-red-200">
              <CrossSVG />
            </div>
            <h1 className="font-display text-2xl font-black text-slate-900">Reset Failed</h1>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              {err ?? "The reset link is invalid or has expired."}
            </p>
            <div className="flex flex-col gap-2 w-full mt-2">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-brand-600"
                onClick={() => {
                  setStage("form");
                  setErr(null);
                }}
              >
                Try again
              </button>
              <Link
                href="/auth/login"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:bg-slate-50"
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
