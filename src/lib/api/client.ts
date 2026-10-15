/**
 * Shared Laravel API client.
 * Browser calls send the JWT as Authorization: Bearer <token>.
 */

import { getAccessToken } from "@/lib/auth/token-store";

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

export type ApiErrorBody = {
  message?: string;
  errors?: Record<string, string[]>;
};

export function parseApiError(data: ApiErrorBody, fallback: string): string {
  if (data.errors && typeof data.errors === "object") {
    const first = Object.values(data.errors).flat()[0];
    if (first) return first;
  }
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }
  return fallback;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody, fallback: string) {
    super(parseApiError(body, fallback));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export type ApiRequestOptions = RequestInit & {
  /** Attach the stored JWT as a Bearer token. */
  auth?: boolean;
  /** When false, do not send Accept. Defaults to true. */
  accept?: boolean;
};

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<Response> {
  const { auth = false, accept = true, headers: initHeaders, body, ...init } = options;
  const headers = new Headers(initHeaders);
  if (accept) headers.set("Accept", "application/json");

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body != null && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getAccessToken();
    if (!token) {
      return new Response(JSON.stringify({ message: "Unauthenticated." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(apiUrl(path), { ...init, body, headers });
}

export async function apiJson<T>(path: string, options: ApiRequestOptions = {}, fallback = "Request failed."): Promise<T> {
  const res = await apiRequest(path, options);
  const data = (await res.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!res.ok) {
    throw new ApiError(res.status, data, fallback);
  }
  return data;
}
