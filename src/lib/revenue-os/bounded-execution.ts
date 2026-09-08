import "server-only";

export type DeadlineOutcome<T> =
  | { completed: true; value: T; elapsedMs: number }
  | { completed: false; timedOut: boolean; aborted: boolean; elapsedMs: number };

/** Stops waiting, not an assertion that a provider cancelled an in-flight effect. */
export async function runWithDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  deadlineMs: number,
  externalSignal?: AbortSignal,
): Promise<DeadlineOutcome<T>> {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new Error("Deadline must be positive");
  const started = performance.now();
  const controller = new AbortController();
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  try {
    return await new Promise<DeadlineOutcome<T>>((resolve, reject) => {
      const stop = (timedOut: boolean) => {
        if (settled) return;
        settled = true;
        // Publish the uncertain outcome before cooperative work rejects on abort.
        resolve({
          completed: false,
          timedOut,
          aborted: !timedOut,
          elapsedMs: performance.now() - started,
        });
        controller.abort(externalSignal?.reason);
      };
      onAbort = () => stop(false);
      if (externalSignal?.aborted) {
        stop(false);
        return;
      }
      externalSignal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => stop(true), deadlineMs);
      // Convert synchronous throws as well as async rejections into this lifecycle.
      Promise.resolve()
        .then(() => {
          controller.signal.throwIfAborted();
          return work(controller.signal);
        })
        .then(
          (value) => {
            if (settled) return;
            settled = true;
            resolve({ completed: true, value, elapsedMs: performance.now() - started });
          },
          (error) => {
            if (settled) {
              if (!controller.signal.aborted)
                console.warn("[bounded-execution] late work rejected; reconciliation required");
              return;
            }
            settled = true;
            reject(error);
          },
        );
    });
  } finally {
    if (timer) clearTimeout(timer);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}

export interface ProviderCircuitOptions {
  minItemsBeforeTrip?: number;
  errorRateThreshold?: number;
  cooldownMs?: number;
}
export type ProviderCircuitState = "closed" | "open" | "half_open";
type CircuitEntry = { outcomes: boolean[]; openedAt: number | null; probing: boolean };

/** Process-local admission hint. Keys must describe the actual caller's scope;
 * the work engine uses tenant-local handler kinds, not inferred provider names.
 * Durable work receipts remain authoritative across process restarts. */
export class ProviderCircuit {
  private providers = new Map<string, CircuitEntry>();
  private options: Required<ProviderCircuitOptions>;
  constructor(options: ProviderCircuitOptions = {}) {
    this.options = {
      minItemsBeforeTrip: 5,
      errorRateThreshold: 0.5,
      cooldownMs: 60_000,
      ...options,
    };
    const { minItemsBeforeTrip, errorRateThreshold, cooldownMs } = this.options;
    if (
      !Number.isInteger(minItemsBeforeTrip) ||
      minItemsBeforeTrip < 1 ||
      minItemsBeforeTrip > 1000 ||
      !Number.isFinite(errorRateThreshold) ||
      errorRateThreshold < 0 ||
      errorRateThreshold > 1 ||
      !Number.isFinite(cooldownMs) ||
      cooldownMs < 0
    )
      throw new Error("Invalid circuit options");
  }
  allow(provider: string, now = Date.now()): boolean {
    const entry = this.providers.get(provider);
    if (!entry || entry.openedAt === null) return true;
    if (entry.probing) return false;
    if (now - entry.openedAt < this.options.cooldownMs) return false;
    entry.probing = true;
    return true;
  }
  record(provider: string, ok: boolean, now = Date.now()): void {
    const entry = this.providers.get(provider) ?? { outcomes: [], openedAt: null, probing: false };
    if (entry.probing) {
      entry.probing = false;
      entry.openedAt = ok ? null : now;
      entry.outcomes = [];
    } else if (entry.openedAt === null) {
      entry.outcomes.push(ok);
      entry.outcomes = entry.outcomes.slice(-this.options.minItemsBeforeTrip);
      if (
        entry.outcomes.length >= this.options.minItemsBeforeTrip &&
        entry.outcomes.filter((value) => !value).length / entry.outcomes.length >
          this.options.errorRateThreshold
      )
        entry.openedAt = now;
    }
    this.providers.set(provider, entry);
  }
  state(provider: string): ProviderCircuitState {
    const entry = this.providers.get(provider);
    return !entry || entry.openedAt === null ? "closed" : entry.probing ? "half_open" : "open";
  }
  openProviders(): string[] {
    return [...this.providers].filter(([, entry]) => entry.openedAt !== null).map(([key]) => key);
  }
  reset(provider?: string): void {
    if (provider) this.providers.delete(provider);
    else this.providers.clear();
  }
}
