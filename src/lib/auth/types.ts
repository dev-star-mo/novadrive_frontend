/** Authenticated user shape returned by the Laravel API. */
export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: "user" | "admin" | "superadmin";
  email_verified: boolean;
  created_at: string;
};
