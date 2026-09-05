/**
 * Operator-facing expectation language for the system-health report.
 *
 * Pure and client-safe (no `server-only`): the Today ledger renders these
 * strings, the health service owns the numbers, and unit tests cover the
 * wording without a database. Cadence numbers must match EXPECTED_CADENCES
 * in `./health` — `test:health-expectation` fails if a concern kind loses
 * its label.
 */

export type HealthConcernKind = "integration" | "job" | "source" | "webhook";

/** Human cadence per subsystem kind, surfaced next to each health item. */
export const EXPECTED_CADENCE_LABELS: Record<HealthConcernKind, string> = {
  integration: "on every render",
  source: "hourly",
  job: "every 30 minutes",
  webhook: "48h failure window",
};

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "less than a minute";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h${remainder}m`;
}

/**
 * One operator-readable line for a health item's next expected execution,
 * e.g. "Runs hourly · next check in 42m" or
 * "Runs every 30 minutes · check overdue by 5m". Returns null when the item
 * carries no expectation (integrations have no fixed cadence).
 */
export function describeExpectedCheck(
  nextExpectedAt: number | undefined,
  cadenceLabel: string | undefined,
  now = Date.now(),
): string | null {
  if (nextExpectedAt === undefined || cadenceLabel === undefined) return null;
  if (nextExpectedAt < now)
    return `Runs ${cadenceLabel} · check overdue by ${formatDuration(now - nextExpectedAt)}`;
  return `Runs ${cadenceLabel} · next check in ${formatDuration(nextExpectedAt - now)}`;
}
