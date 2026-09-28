"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CalendarDays, ChevronRight, Crown, Loader2, Mail, Pencil, Phone, Shield, ShieldCheck, ShieldOff, Trash2, User, UserMinus, UserPlus, X } from "lucide-react";
import { fetchUsersIndex, createUser, fetchUser, updateUser, deleteUser, activateUser, deactivateUser, makeUserAdmin, demoteUserAdmin } from "@/lib/auth/laravel-client";
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

export function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── Create user form state ── */
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /* ── Show user drawer state ── */
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  /* ── Edit user state ── */
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── Delete user state ── */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ── Activate / deactivate user state ── */
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  /* ── Make / demote admin state ── */
  const [makingAdmin, setMakingAdmin] = useState(false);
  const [makeAdminError, setMakeAdminError] = useState<string | null>(null);
  const [demotingAdmin, setDemotingAdmin] = useState(false);
  const [demoteAdminError, setDemoteAdminError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await fetchUsersIndex();
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setUsers([]);
      } else {
        setUsers(result.users);
      }
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleShowUser = async (id: string) => {
    setSelectedUser(null);
    setUserError(null);
    setLoadingUser(true);
    setEditing(false);
    setSaveError(null);
    setConfirmDelete(false);
    setDeleteError(null);
    setActivateError(null);
    setDeactivateError(null);
    setMakeAdminError(null);
    setDemoteAdminError(null);

    const result = await fetchUser(id);
    setLoadingUser(false);

    if (!result.ok) {
      setUserError(result.error);
      return;
    }
    setSelectedUser(result.user);
  };

  const startEditing = (u: AdminUser) => {
    setEditName(u.name ?? "");
    setEditPhone(u.phone_number ?? "");
    setSaveError(null);
    setEditing(true);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setSaveError(null);

    const result = await updateUser(selectedUser.id, {
      name: editName.trim() || undefined,
      phone_number: editPhone.trim() || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setSaveError(result.error);
      return;
    }

    // Update the drawer and the table row in one go
    setSelectedUser(result.user);
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
    setEditing(false);
  };

  const handleActivateUser = async () => {
    if (!selectedUser) return;
    setActivating(true);
    setActivateError(null);

    const result = await activateUser(selectedUser.id);
    setActivating(false);

    if (!result.ok) {
      setActivateError(result.error);
      return;
    }

    setSelectedUser(result.user);
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
  };

  const handleMakeAdmin = async () => {
    if (!selectedUser) return;
    setMakingAdmin(true);
    setMakeAdminError(null);

    const result = await makeUserAdmin(selectedUser.id);
    setMakingAdmin(false);

    if (!result.ok) {
      setMakeAdminError(result.error);
      return;
    }

    setSelectedUser(result.user);
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
  };

  const handleDemoteAdmin = async () => {
    if (!selectedUser) return;
    setDemotingAdmin(true);
    setDemoteAdminError(null);

    const result = await demoteUserAdmin(selectedUser.id);
    setDemotingAdmin(false);

    if (!result.ok) {
      setDemoteAdminError(result.error);
      return;
    }

    setSelectedUser(result.user);
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
  };

  const handleDeactivateUser = async () => {
    if (!selectedUser) return;
    setDeactivating(true);
    setDeactivateError(null);

    const result = await deactivateUser(selectedUser.id);
    setDeactivating(false);

    if (!result.ok) {
      setDeactivateError(result.error);
      return;
    }

    setSelectedUser(result.user);
    setUsers((prev) => prev.map((u) => (u.id === result.user.id ? result.user : u)));
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setDeleting(true);
    setDeleteError(null);

    const result = await deleteUser(selectedUser.id);
    setDeleting(false);

    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }

    // Remove from table and close drawer
    setUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
    setSelectedUser(null);
    setConfirmDelete(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError("Name is required."); return; }
    if (!newEmail.trim()) { setCreateError("Email is required."); return; }

    setCreating(true);
    setCreateError(null);

    const result = await createUser({ name: newName, email: newEmail });

    if (!result.ok) {
      setCreateError(result.error);
      setCreating(false);
      return;
    }

    setUsers((prev) => [result.user, ...prev]);
    setNewName("");
    setNewEmail("");
    setShowForm(false);
    setCreating(false);
  };

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
    <div className="mb-20 flex flex-col xl:flex-row gap-6 items-start">
    {/* ── User detail drawer ── */}
    {(loadingUser || selectedUser || userError) && (
      <div className="w-full xl:w-80 shrink-0 rounded-[2.5rem] border border-slate-100 bg-white shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/50 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {editing ? "Edit user" : "User detail"}
          </p>
          <button
            type="button"
            onClick={() => { setSelectedUser(null); setUserError(null); setEditing(false); setConfirmDelete(false); setDeleteError(null); setActivateError(null); setDeactivateError(null); setMakeAdminError(null); setDemoteAdminError(null); }}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close detail"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-6">
          {loadingUser && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          )}
          {userError && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{userError}</p>
          )}
          {selectedUser && !editing && (
            <div className="space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <User className="h-7 w-7" />
              </div>
              <div>
                <p className="text-lg font-bold text-onyx-950">{selectedUser.name || "—"}</p>
                <p className="text-xs text-slate-500">ID: {selectedUser.id}</p>
              </div>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  {selectedUser.email}
                </div>
                {selectedUser.phone_number && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                    {selectedUser.phone_number}
                  </div>
                )}
                <div className="flex items-center gap-2 text-slate-600">
                  <Shield className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                    {selectedUser.role}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                  Joined {formatDate(selectedUser.created_at)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedUser.email_verified
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {selectedUser.email_verified ? "Email verified" : "Not verified"}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedUser.is_active
                      ? "bg-sky-50 text-sky-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Activate / deactivate toggle */}
              {!selectedUser.is_active ? (
                <div className="space-y-1.5">
                  {activateError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{activateError}</p>
                  )}
                  <button
                    type="button"
                    disabled={activating}
                    onClick={() => void handleActivateUser()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 py-2.5 text-sm font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50 transition-colors"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {activating ? "Activating…" : "Activate user"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {deactivateError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{deactivateError}</p>
                  )}
                  <button
                    type="button"
                    disabled={deactivating}
                    onClick={() => void handleDeactivateUser()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <ShieldOff className="h-3.5 w-3.5" />
                    {deactivating ? "Deactivating…" : "Deactivate user"}
                  </button>
                </div>
              )}

              {/* Make admin / Demote admin toggle */}
              {selectedUser.role !== "admin" ? (
                <div className="space-y-1.5">
                  {makeAdminError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{makeAdminError}</p>
                  )}
                  <button
                    type="button"
                    disabled={makingAdmin}
                    onClick={() => void handleMakeAdmin()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                  >
                    <Crown className="h-3.5 w-3.5" />
                    {makingAdmin ? "Promoting…" : "Make admin"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {demoteAdminError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{demoteAdminError}</p>
                  )}
                  <button
                    type="button"
                    disabled={demotingAdmin}
                    onClick={() => void handleDemoteAdmin()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    {demotingAdmin ? "Demoting…" : "Demote from admin"}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => startEditing(selectedUser)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit user
              </button>

              {/* ── Delete zone ── */}
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-100 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete user
                </button>
              ) : (
                <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">
                    Delete <span className="font-bold">{selectedUser.name || selectedUser.email}</span>?
                  </p>
                  <p className="text-xs text-red-500">This action cannot be undone.</p>
                  {deleteError && (
                    <p className="rounded-lg bg-white px-3 py-2 text-xs text-red-600">{deleteError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(false); setDeleteError(null); }}
                      disabled={deleting}
                      className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteUser()}
                      disabled={deleting}
                      className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedUser && editing && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-onyx-950">{selectedUser.name || "—"}</p>
                <p className="text-xs text-slate-500">ID: {selectedUser.id}</p>
              </div>
              {saveError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Phone number</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="e.g. 74948-28430"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setSaveError(null); }}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveUser()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    <div className="flex-1 min-w-0 overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/40 border border-slate-50">
      {/* Header */}
      <div className="border-b border-slate-50 bg-slate-50/50 px-8 py-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-onyx-950">Registered users</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {users.length} account{users.length === 1 ? "" : "s"} from Laravel
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm((v) => !v); setCreateError(null); }}
          className="inline-flex items-center gap-2 rounded-2xl bg-onyx-950 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-brand-600 shadow hover:bg-onyx-800 transition-all"
        >
          {showForm ? <X className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
          {showForm ? "Cancel" : "Add user"}
        </button>
      </div>

      {/* Create user form */}
      {showForm && (
        <div className="border-b border-slate-100 bg-white px-8 py-6">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">New user</p>
          {createError && (
            <p className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600">{createError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              disabled={creating}
              onClick={() => void handleCreate()}
              className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}


      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-50">
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                User
              </th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Email
              </th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Role
              </th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Status
              </th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Verified
              </th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Joined
              </th>
              <th className="px-4 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-8 py-12 text-center text-sm text-slate-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => void handleShowUser(u.id)}
                  className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${selectedUser?.id === u.id ? "bg-brand-50/40" : ""}`}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                        <User className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-onyx-950">
                        {u.name || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                      <Shield className="h-3 w-3" />
                      {u.role}
                    </span>
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
                    <span
                      className={`text-xs font-semibold ${u.email_verified ? "text-emerald-600" : "text-amber-600"}`}
                    >
                      {u.email_verified ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-5 text-slate-300">
                    <ChevronRight className="h-4 w-4" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
