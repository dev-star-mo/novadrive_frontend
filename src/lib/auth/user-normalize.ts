import type { AuthUser } from "@/lib/auth/types";

export function normalizeAuthUser(raw: Record<string, unknown>): AuthUser {
  const emailVerified =
    raw.email_verified != null
      ? Boolean(raw.email_verified)
      : raw.email_verified_at != null
        ? Boolean(raw.email_verified_at)
        : false;

  const roleRaw = raw.role;
  const role =
    roleRaw === "superadmin"
      ? "superadmin"
      : roleRaw === "admin"
        ? "admin"
        : roleRaw === "customer"
          ? "user"
          : "user";

  return {
    id: String(raw.id ?? raw.sub ?? ""),
    email: String(raw.email ?? ""),
    full_name:
      raw.full_name != null
        ? String(raw.full_name)
        : raw.name != null
          ? String(raw.name)
          : null,
    role,
    email_verified: emailVerified,
    created_at: String(raw.created_at ?? ""),
  };
}
