/**
 * Server-side helper that forwards requests through the shared Laravel API client.
 */

import { apiRequest, API_BASE_URL } from "@/lib/api/client";

export const PHP_API = API_BASE_URL;

export type PhpApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function postToPhpApi<T = Record<string, unknown>>(
  endpoint: string,
  body: unknown,
  defaultErrorMessage = "Request failed."
): Promise<PhpApiResult<T>> {
  const phpRes = await apiRequest(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = (await phpRes.json().catch(() => ({}))) as Record<string, unknown>;

  if (!phpRes.ok) {
    return {
      ok: false,
      status: phpRes.status,
      error: (data?.message as string) ?? defaultErrorMessage,
    };
  }

  return { ok: true, data: data as T };
}
