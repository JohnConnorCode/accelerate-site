const requests = new Map<string, number[]>();

// Clean up old entries every 10 minutes to prevent memory leak
const CLEANUP_INTERVAL = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, timestamps] of requests) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      requests.delete(key);
    } else {
      requests.set(key, valid);
    }
  }
}

export function rateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number } {
  const now = Date.now();
  cleanup(windowMs);

  const timestamps = requests.get(ip) ?? [];
  const valid = timestamps.filter((t) => now - t < windowMs);

  if (valid.length >= limit) {
    return { success: false, remaining: 0 };
  }

  valid.push(now);
  requests.set(ip, valid);

  return { success: true, remaining: limit - valid.length };
}
