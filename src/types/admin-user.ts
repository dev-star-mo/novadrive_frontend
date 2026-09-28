/** User row returned by Laravel `GET /users`. */
export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  email_verified: boolean;
  created_at: string;
};
