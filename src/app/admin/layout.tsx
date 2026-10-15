"use client";

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useUserSession } from "@/components/providers/user-session-provider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, profile, loading, isAdmin } = useUserSession();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/?auth=required", { replace: true });
      return;
    }
    if (!isAdmin) {
      navigate("/?denied=admin", { replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return null;
  }

  const displayName = profile?.full_name ?? user.email.split("@")[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-onyx-950 shadow-xl shadow-onyx-950/10 transition-transform hover:scale-105">
              <span className="text-sm font-bold text-brand-600">N</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold text-onyx-950 tracking-tight leading-none">Nova Intelligence</span>
              <span className="mt-1.5 inline-flex w-fit items-center rounded-full bg-brand-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.2em] text-brand-700 border border-brand-100">
                Administrative Desk
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-onyx-950 uppercase tracking-widest leading-none">
                {displayName}
              </span>
              <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-1">Authenticated Officer</span>
            </div>
            <Link
              to="/"
              className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-onyx-950 hover:text-onyx-950 hover:bg-white transition-all active:scale-95"
            >
              ← Terminate Session
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-screen-xl px-5 py-8">
        {children}
      </main>
    </div>
  );
}
