import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDailyDigestWork, createDetectStaleDealsWork, createDetectStageBottleneckWork, createDetectVelocityChangeWork } from "./business-pulse-coworker";
import { createDailyHealthCheckWork, createIntegrationStatusAuditWork, createDataQualityScanWork } from "./operations-coworker";
import { createWeeklyReconciliationWork, createDetectOverduePaymentsWork, createRevenueStageAuditWork } from "./finance-coworker";
import { createRevenueTask } from "./tasks";
import { recordAudit } from "./audit";

// ---------------------------------------------------------------------------
// Work scheduler: auto-creates recurring work items on each cron cycle.
//
// Every coworker has work creation helpers, but they only fire when something
// triggers them (inbound lead, calendar event, etc.). This module ensures the
// daily and weekly cadence work always exists so the work engine has something
// to execute on each cycle. Dedupe keys prevent duplicates.
// ---------------------------------------------------------------------------

export interface WorkSchedulerSummary {
  created: number;
  skipped: number;
  errors: string[];
}

/**
 * Schedule daily work items for all coworkers that run on a daily cadence.
 * Each helper uses a date-based dedupe key so it won't create duplicates
 * if called multiple times in the same day.
 */
export async function scheduleDailyWork(
  supabase: SupabaseClient,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };

  // Business Pulse: daily digest + stale deals + bottleneck + velocity change.
  const dailyCreators = [
    { name: "daily_digest", fn: () => createDailyDigestWork(supabase) },
    { name: "detect_stale_deals", fn: () => createDetectStaleDealsWork(supabase) },
    { name: "detect_stage_bottleneck", fn: () => createDetectStageBottleneckWork(supabase) },
    { name: "detect_velocity_change", fn: () => createDetectVelocityChangeWork(supabase) },
    // Operations: daily health check + integration audit + data quality.
    { name: "daily_health_check", fn: () => createDailyHealthCheckWork(supabase) },
    { name: "integration_status_audit", fn: () => createIntegrationStatusAuditWork(supabase) },
    { name: "data_quality_scan", fn: () => createDataQualityScanWork(supabase) },
    // Finance: overdue payment scan + revenue-stage audit (daily).
    { name: "detect_overdue_payments", fn: () => createDetectOverduePaymentsWork(supabase) },
    { name: "revenue_stage_audit", fn: () => createRevenueStageAuditWork(supabase) },
  ];

  for (const { name, fn } of dailyCreators) {
    try {
      await fn();
      summary.created++;
    } catch (err) {
      // Dedupe violations are expected — they mean the item already exists.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("23505")) {
        summary.skipped++;
      } else {
        summary.errors.push(`${name}: ${msg}`);
      }
    }
  }

  // Surface a daily operator task so the founder sees the engine is alive.
  const today = new Date().toISOString().slice(0, 10);
  try {
    await createRevenueTask(supabase, {
      title: `Daily engine check-in — ${today}`,
      description: "Automated daily check-in. The work engine has scheduled today's coworker work items.",
      priority: "low",
      source: "work_engine",
      dedupeKey: `engine:daily-checkin:${today}`,
      actorEmail: "system",
    });
  } catch {
    // Best-effort; dedupe is fine.
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_engine.schedule_daily",
    entityType: "work_engine",
    entityId: "scheduler",
    source: "automation",
    after: summary,
  });

  return summary;
}

/**
 * Schedule weekly work items. Call this on Mondays (or the first cron cycle
 * of the week) to ensure weekly reconciliation and other week-bound work exists.
 */
export async function scheduleWeeklyWork(
  supabase: SupabaseClient,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };

  // Finance: weekly revenue reconciliation.
  const weeklyCreators = [
    { name: "weekly_revenue_reconciliation", fn: () => createWeeklyReconciliationWork(supabase) },
  ];

  for (const { name, fn } of weeklyCreators) {
    try {
      await fn();
      summary.created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("23505")) {
        summary.skipped++;
      } else {
        summary.errors.push(`${name}: ${msg}`);
      }
    }
  }

  await recordAudit(supabase, {
    actorEmail: "system",
    action: "work_engine.schedule_weekly",
    entityType: "work_engine",
    entityId: "scheduler",
    source: "automation",
    after: summary,
  });

  return summary;
}

/**
 * Main entry point: schedule all recurring work based on the current day.
 * Runs daily work every cycle; runs weekly work on Mondays (day 1).
 */
export async function scheduleRecurringWork(
  supabase: SupabaseClient,
): Promise<WorkSchedulerSummary> {
  const daily = await scheduleDailyWork(supabase);

  // Monday = day 1 in ISO weekday.
  const isMonday = new Date().getDay() === 1;
  const weekly = isMonday ? await scheduleWeeklyWork(supabase) : { created: 0, skipped: 0, errors: [] };

  return {
    created: daily.created + weekly.created,
    skipped: daily.skipped + weekly.skipped,
    errors: [...daily.errors, ...weekly.errors],
  };
}
