/**
 * Small fetch wrapper for admin data calls. Throws on a non-2xx response
 * (surfacing the API's `error` message when present) so callers can `catch`
 * and route the failure into a toast instead of silently swallowing it.
 */
export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        message = body.error;
      }
    } catch {
      // Response had no JSON body; keep the status-based message.
    }
    throw new Error(message);
  }

  return (await res.json()) as T;
}
