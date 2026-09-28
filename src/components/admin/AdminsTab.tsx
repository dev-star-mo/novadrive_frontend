"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, Crown, Loader2, Mail, ShieldCheck } from "lucide-react";
import { fetchAdminsList } from "@/lib/auth/laravel-client";
import type { AdminUser } from "@/types/admin-user";

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function AdminsTab() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await fetchAdminsList();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setAdmins([]);
      } else {
        setAdmins(result.users);
      }
      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/40">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[2.5rem] border border-red-100 bg-white p-10 text-center shadow-xl shadow-slate-200/40">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm font-medium text-slate-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="mb-20 overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/40 border border-slate-50">
      {/* Header */}
      <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-6 flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50">
          <Crown className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-onyx-950">Administrators</h2>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            {admins.length} admin{admins.length === 1 ? "" : "s"} from Laravel
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-50">
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Admin</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Email</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Verified</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {admins.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center text-sm text-slate-500">
                  No admins found.
                </td>
              </tr>
            ) : (
              admins.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <Crown className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-onyx-950">{u.name || "—"}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Admin</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                        u.is_active
                          ? "bg-sky-50 text-sky-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck
                        className={`h-4 w-4 ${u.email_verified ? "text-emerald-500" : "text-amber-400"}`}
                      />
                      <span
                        className={`text-xs font-semibold ${u.email_verified ? "text-emerald-600" : "text-amber-600"}`}
                      >
                        {u.email_verified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-1.5 text-sm text-slate-500">
                      <CalendarDays className="h-4 w-4 text-slate-300" />
                      {formatDate(u.created_at)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
