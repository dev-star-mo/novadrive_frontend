"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { updatePassword } from "@/lib/auth/laravel-client";
import { useUserSession } from "@/components/providers/user-session-provider";

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

function ResetTokenRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  useEffect(() => {
    const dest = token
      ? `/auth/reset-password?token=${encodeURIComponent(token)}`
      : "/auth/reset-password";
    router.replace(dest);
  }, [router, token]);

  return (
    <p className="text-sm font-medium text-slate-400">Redirecting…</p>
  );
}

function ChangePasswordForm() {
  const router = useRouter();
  const { user, loading } = useUserSession();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!oldPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (password.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    const result = await updatePassword({
      old_password: oldPassword,
      password,
      confirm_password: confirm,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOldPassword("");
    setPassword("");
    setConfirm("");
    setSuccess(true);
  };

  if (loading) {
    return <p className="text-sm font-medium text-slate-400">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-sm font-medium text-slate-600">
          Sign in to change your password.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex rounded-2xl bg-onyx-950 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-brand-600"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-6 flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="NovaDrive Logo" width={48} height={48} className="rounded-xl" />
          <span className="font-display text-xl font-bold tracking-tight text-white">
            NovaDrive <span className="text-brand-600">Car Rentals</span>
          </span>
        </Link>
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-white">
          Change password
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-400">
          Signed in as {user.email}
        </p>
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white p-8 shadow-2xl shadow-black/40">
        {success ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-800">Password updated</p>
            <p className="text-xs text-slate-500">
              Your password has been changed successfully.
            </p>
            <button
              type="button"
              className="mt-2 w-full rounded-2xl bg-onyx-950 py-4 text-xs font-black uppercase tracking-[0.3em] text-white hover:bg-brand-600"
              onClick={() => router.push("/")}
            >
              Back to home
            </button>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <p className="text-xs font-medium leading-relaxed text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={(e) => void submit(e)} className="space-y-4">
              <PasswordField
                label="Current password"
                value={oldPassword}
                onChange={setOldPassword}
                autoComplete="current-password"
                placeholder="Enter current password"
              />
              <PasswordField
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Enter new password"
              />
              <PasswordField
                label="Confirm new password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
                placeholder="Repeat new password"
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-onyx-950 py-4 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving…" : "Update password"}
              </button>
            </form>

            <p className="mt-5 text-center text-xs font-medium text-slate-500">
              Forgot your current password?{" "}
              <Link href="/auth/reset-password" className="font-semibold text-brand-600 hover:text-brand-700">
                Reset via email
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <ResetTokenRedirect />;
  }

  return <ChangePasswordForm />;
}
