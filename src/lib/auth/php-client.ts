/**
 * Helper to communicate with the upstream PHP authentication API.
 * Provides a standardized way to forward auth requests and handle responses.
 */

export const PHP_API = process.env.NEXT_PUBLIC_PHP_API_URL ?? "https://api.example.com";

export type PhpApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

/**
 * Sends a POST request to a PHP API endpoint with a JSON body and parses the response.
 */
export async function postToPhpApi<T = Record<string, unknown>>(
  endpoint: string,
  body: unknown,
  defaultErrorMessage = "Request failed."
): Promise<PhpApiResult<T>> {
  const url = `${PHP_API}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const phpRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
