"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  isUnverifiedLoginError,
  getGoogleOAuthRedirectUrl,
  loginUser,
  resendVerificationEmail,
} from "@/lib/auth/laravel-client";
import { useUserSession } from "@/components/providers/user-session-provider";

/* ─── Password field ─────────────────────────────────────────────────────── */
function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete="current-password"
        placeholder="Enter your password"
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
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile } = useUserSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendInfo, setResendInfo] = useState<string | null>(null);

  const signInGoogle = () => {
    const url = getGoogleOAuthRedirectUrl();
    if (!url) {
      setError("Google sign-in is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.");
      return;
    }
    window.location.href = url;
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    setUnverified(false);
    setResendInfo(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      const result = await loginUser({ email: email.trim(), password });

      if (!result.ok) {
        const msg = result.error;
        if (isUnverifiedLoginError(msg)) {
          setUnverified(true);
          setError(null);
          return;
        }
        setError(msg);
        return;
      }

      await refreshProfile();
      router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) return;
    setResendBusy(true);
    setResendInfo(null);
    setError(null);

    const result = await resendVerificationEmail(email.trim());

    if (!result.ok) {
      setError(result.error);
    } else {
      setResendInfo("Verification link sent! Please check your inbox.");
    }
    setResendBusy(false);
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
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">
          Welcome back
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-400">
          Sign in to manage your bookings
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl shadow-black/40">

        {/* ── Unverified notice ── */}
        {unverified && (
          <div className="mb-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">📧</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">Verify your email first</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  You cannot sign in until your email is verified. A verification link has been sent
                  to <strong>{email.trim()}</strong>. Please check your inbox (and spam folder),
                  click the link, then try signing in again.
                </p>
                {resendInfo && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">{resendInfo}</p>
                )}
                <button
                  type="button"
                  className="mt-3 w-full rounded-xl bg-amber-800 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-amber-900 disabled:opacity-60"
                  disabled={resendBusy || !email.trim()}
                  onClick={() => void resendVerification()}
                >
                  {resendBusy ? "Sending…" : "Resend verification link"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-xs font-medium leading-relaxed text-red-700">{error}</p>
          </div>
        )}

        {/* Google */}
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 py-3.5 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-60"
          onClick={signInGoogle}
          disabled={busy}
        >
          <GoogleIcon />
          Sign in with Google
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase text-slate-400">
            <span className="bg-white px-3">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-onyx-950">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-4 text-sm font-medium text-onyx-950 outline-none transition-all focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-600/20"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-onyx-950">
                Password
              </label>
              <Link
                href="/auth/reset-password"
                className="text-[10px] font-semibold uppercase tracking-widest text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>
            <PasswordField value={password} onChange={setPassword} />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-onyx-950 py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs font-medium text-slate-500">
          No account?{" "}
          <Link href="/" className="font-semibold text-brand-600 hover:text-brand-700">
            Create one on our home page
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ─── Google icon ────────────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
