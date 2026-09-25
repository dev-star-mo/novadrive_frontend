"use client";

import { useEffect, useState } from "react";
import { useAppUI } from "@/components/providers/app-ui-provider";
import { useUserSession } from "@/components/providers/user-session-provider";
import {
  generateForgotPasswordToken,
  getGoogleOAuthRedirectUrl,
  isUnverifiedLoginError,
  loginUser,
  registerUser,
  resendVerificationEmail,
} from "@/lib/auth/laravel-client";

/* ─── Password field with show / hide toggle ─────────────────────────────── */
function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        onClick={() => setShow((s) => !s)}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

/* ─── Main modal ─────────────────────────────────────────────────────────── */
export function AuthModal() {
  const { authOpen, authView, closeAuth, setAuthView } = useAppUI();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [subscribeToNewsletter, setSubscribeToNewsletter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { user, refreshProfile } = useUserSession();

  /* Close modal when user becomes authenticated */
  useEffect(() => {
    if (user?.email_verified) {
      closeAuth();
    }
  }, [user, closeAuth]);

  /* Reset form state when modal closes */
  useEffect(() => {
    if (!authOpen) {
      setError(null);
      setInfo(null);
      setName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setSubscribeToNewsletter(false);
    }
  }, [authOpen]);

  /* Pre-fill email in the "unverified" gate view */
  useEffect(() => {
    if (authView === "unverified" && user?.email) {
      setEmail(user.email);
    }
  }, [authView, user?.email]);

  if (!authOpen) return null;

  /* ── Google sign-in: Laravel OAuth redirect ── */
  const signInGoogle = () => {
    const url = getGoogleOAuthRedirectUrl();
    if (!url) {
      setError("Google sign-in is not configured. Set NEXT_PUBLIC_LARAVEL_API_URL.");
      return;
    }
    window.location.href = url;
  };

  /* ── Email sign-in ── */
  const signInEmail = async () => {
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const result = await loginUser({ email: email.trim(), password });

      if (!result.ok) {
        const msg = result.error;
        if (isUnverifiedLoginError(msg)) {
          setError(null);
          setInfo(null);
          setAuthView("unverified");
          return;
        }
        setError(msg);
        return;
      }

      await refreshProfile();
      closeAuth();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ── Sign-up: email + password only ── */
  const signUp = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (password !== confirm) {
      setError("Password and confirm password must match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);

    const result = await registerUser({
      name: trimmedName,
      email: trimmedEmail,
      password,
      confirm_password: confirm,
      subscribe_to_newsletter: subscribeToNewsletter,
    });

    if (!result.ok) {
      const msg = result.error;
      if (
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("user already") ||
        msg.toLowerCase().includes("already been taken")
      ) {
        setError("An account with this email already exists. Please sign in instead.");
      } else {
        setError(msg);
      }
      setBusy(false);
      return;
    }

    setName("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setSubscribeToNewsletter(false);
    setAuthView("signin");
    setInfo(
      "Account created! A verification email has been sent to your inbox. Please verify before signing in."
    );
    setBusy(false);
  };

  /* ── Forgot password ── */
  const sendReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      const result = await generateForgotPasswordToken(email.trim());

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setInfo("If an account exists for this email, a reset link has been sent.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  /* ── Resend verification email ── */
  const resendVerification = async () => {
    const addr = email.trim() || user?.email;
    if (!addr) return;
    setBusy(true);
    setError(null);
    setInfo(null);

    const result = await resendVerificationEmail(addr);

    if (!result.ok) {
      setError(result.error);
    } else {
      setInfo("Verification link sent! Please check your inbox.");
    }
    setBusy(false);
  };

  /* ─────────────────────────────────────────────────────────── RENDER ───── */
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        aria-hidden
        onClick={() => !busy && closeAuth()}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
          onClick={() => !busy && closeAuth()}
          aria-label="Close"
        >
          ✕
        </button>

        {/* ── Gate: must be signed in to book ── */}
        {authView === "gate" && (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Book your car</h2>
            <p className="mt-3 text-slate-600">
              You need to be signed in to make a booking. This ensures your booking is secure and
              you can track your reservation.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={closeAuth}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                onClick={() => setAuthView("signin")}
              >
                Sign in
              </button>
            </div>
          </>
        )}

        {/* ── Unverified account gate ── */}
        {authView === "unverified" && (
          <>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl">
                📧
              </span>
              <h2 className="font-display text-xl font-bold text-ink">Verify your email</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              You need to verify your email before you can sign in or book a car. A verification link
              has been sent to <strong>{email || user?.email}</strong>. Please check your inbox (and
              spam folder), click the link, then sign in again.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {info && <p className="mt-2 text-sm text-green-700">{info}</p>}
            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={busy || !(email.trim() || user?.email)}
              onClick={() => void resendVerification()}
            >
              {busy ? "Sending…" : "Resend verification link"}
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setError(null);
                setInfo(null);
                setAuthView("signin");
              }}
            >
              Back to sign in
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={closeAuth}
            >
              Close
            </button>
          </>
        )}

        {/* ── Sign in ── */}
        {authView === "signin" && (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Sign in</h2>
            {info && <p className="mt-2 text-sm text-brand-700">{info}</p>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            {/* Google sign-in */}
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50"
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
                <span className="bg-white px-2">Or continue with email</span>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="mt-1 text-sm text-brand-600 hover:underline"
              onClick={() => {
                setError(null);
                setAuthView("reset");
              }}
            >
              Forgot password?
            </button>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void signInEmail()}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="mt-4 text-center text-sm text-slate-600">
              No account?{" "}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setAuthView("signup");
                }}
              >
                Create account
              </button>
            </p>
          </>
        )}

        {/* ── Sign up ── */}
        {authView === "signup" && (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Create account</h2>
            {error && (
              <p className="mt-2 text-sm text-red-600">
                {error}
                {error.includes("already exists") && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="font-semibold text-brand-600 hover:underline"
                      onClick={() => {
                        setError(null);
                        setInfo(null);
                        setAuthView("signin");
                      }}
                    >
                      Sign in instead →
                    </button>
                  </>
                )}
              </p>
            )}

            {/* Google sign-up */}
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50"
              onClick={signInGoogle}
              disabled={busy}
            >
              <GoogleIcon />
              Sign up with Google
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase text-slate-400">
                <span className="bg-white px-2">Or sign up with email</span>
              </div>
            </div>

            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              type="text"
              autoComplete="name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">Password</label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Confirm password
            </label>
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <input
                type="checkbox"
                checked={subscribeToNewsletter}
                onChange={(e) => setSubscribeToNewsletter(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm leading-snug text-slate-600">
                Subscribe to our newsletter. You&apos;ll get notified about discounts and promotions
                we offer.
              </span>
            </label>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={busy}
              onClick={() => void signUp()}
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
            <p className="mt-4 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => setAuthView("signin")}
              >
                Sign in
              </button>
            </p>
          </>
        )}

        {/* ── Reset password ── */}
        {authView === "reset" && (
          <>
            <h2 className="font-display text-xl font-bold text-ink">Reset password</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter your email and we will send you a link to choose a new password.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            {info && <p className="mt-2 text-sm text-brand-700">{info}</p>}
            <label className="mt-4 block text-sm font-medium text-slate-700">Email</label>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50"
                onClick={() => setAuthView("signin")}
              >
                Back
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => void sendReset()}
              >
                {busy ? "Sending…" : "Send link"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Icons ──────────────────────────────────────────────────────────────── */
function Eye() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** Coloured Google "G" icon */
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
