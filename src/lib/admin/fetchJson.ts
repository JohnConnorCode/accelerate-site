/**
 * Small fetch wrapper for admin data calls. Throws on a non-2xx response
 * (surfacing the API's `error` message when present) so callers can `catch`
 * and route the failure into a toast instead of silently swallowing it.
 */
async function waitForDemoRuntime() {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/demo/command-center")) return;
  if ((window as Window & { __accelerateAdminDemoRuntime?: string }).__accelerateAdminDemoRuntime)
    return;
  await new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (
        (window as Window & { __accelerateAdminDemoRuntime?: string })
          .__accelerateAdminDemoRuntime ||
        Date.now() - started > 3000
      )
        resolve();
      else window.requestAnimationFrame(tick);
    };
    tick();
  });
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  await waitForDemoRuntime();
  const res = await fetch(input, init);

  if (!res.ok) {
    if (
      res.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/admin") &&
      window.location.pathname !== "/admin/login"
    ) {
      const destination = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/admin/login?redirect=${encodeURIComponent(destination)}`);
    }
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
