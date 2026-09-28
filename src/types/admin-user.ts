/** User row returned by Laravel `GET /users` / `GET /users/:id`. */
export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  email_verified: boolean;
  created_at: string;
};
