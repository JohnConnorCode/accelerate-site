import "server-only";
import type { OperationalHealth } from "./health";

export const HEALTH_SNAPSHOT_CADENCE_MINUTES = 15;

export function healthSnapshotClaimKey(now = Date.now()): string {
  return `system-health-snapshot:${Math.floor(now / (HEALTH_SNAPSHOT_CADENCE_MINUTES * 60_000))}`;
}

export function summarizeOperationalHealth(health: OperationalHealth): Record<string, unknown> {
  return {
    status: health.status,
    attentionCount: health.attentionCount,
    integrationCount: health.integrations.length,
    sourceCount: health.sourceRuns.length,
    jobCount: health.jobRuns.length,
    webhookFailureCount: health.webhookFailures.length,
  };
}
