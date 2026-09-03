import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDailyDigestWork,
  createDetectStaleDealsWork,
  createDetectStageBottleneckWork,
  createDetectVelocityChangeWork,
} from "./business-pulse-coworker";
import {
  createDailyHealthCheckWork,
  createIntegrationStatusAuditWork,
  createDataQualityScanWork,
} from "./operations-coworker";
import {
  createWeeklyReconciliationWork,
  createDetectOverduePaymentsWork,
  createRevenueStageAuditWork,
} from "./finance-coworker";
import { createPreCallBriefWork } from "./meeting-intel-coworker";
import { runTrustGraduationScan } from "./trust-graduation";
import { createProactiveIntelBriefWork } from "./proactive-intel";
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
export async function scheduleDailyWork(supabase: SupabaseClient): Promise<WorkSchedulerSummary> {
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
    // Proactive intelligence: daily NOTICE layer brief.
    { name: "proactive_intel_brief", fn: () => createProactiveIntelBriefWork(supabase) },
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
      description:
        "Automated daily check-in. The work engine has scheduled today's coworker work items.",
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
export async function scheduleWeeklyWork(supabase: SupabaseClient): Promise<WorkSchedulerSummary> {
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

  // Trust graduation scan: propose autonomy upgrades for policies with
  // accumulated approvals. Runs weekly so the system evolves over time.
  try {
    const gradResult = await runTrustGraduationScan(supabase);
    if (gradResult.proposed > 0) {
      summary.created += gradResult.proposed;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`trust_graduation: ${msg}`);
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
 * Scan upcoming calendar events and create pre-call brief work items for
 * meetings that don't already have one. Looks ahead 48 hours so the
 * Meeting Intel coworker has time to prepare context before the call.
 */
export async function scheduleMeetingBriefs(
  supabase: SupabaseClient,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };

  const now = new Date();
  const lookAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  const { data: upcoming, error } = await supabase
    .from("calendar_events")
    .select("id, contact_id, start_time")
    .gte("start_time", now.toISOString())
    .lt("start_time", lookAhead)
    .not("contact_id", "is", null)
    .order("start_time", { ascending: true })
    .limit(20);

  if (error || !upcoming?.length) {
    if (error) summary.errors.push(`calendar_events: ${error.message}`);
    return summary;
  }

  for (const event of upcoming) {
    try {
      await createPreCallBriefWork(supabase, {
        contactId: event.contact_id,
        meetingAt: event.start_time,
        actorEmail: "system",
      });
      summary.created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("duplicate") || msg.includes("23505")) {
        summary.skipped++;
      } else {
        summary.errors.push(`brief:${event.id}: ${msg}`);
      }
    }
  }

  return summary;
}

/**
 * Main entry point: schedule all recurring work based on the current day.
 * Runs daily work every cycle; runs weekly work on Mondays (day 1);
 * scans upcoming meetings for pre-call briefs.
 */
export async function scheduleRecurringWork(
  supabase: SupabaseClient,
): Promise<WorkSchedulerSummary> {
  const daily = await scheduleDailyWork(supabase);

  // Monday = day 1 in ISO weekday.
  const isMonday = new Date().getDay() === 1;
  const weekly = isMonday
    ? await scheduleWeeklyWork(supabase)
    : { created: 0, skipped: 0, errors: [] };

  // Scan upcoming meetings for pre-call briefs.
  const meetings = await scheduleMeetingBriefs(supabase);

  return {
    created: daily.created + weekly.created + meetings.created,
    skipped: daily.skipped + weekly.skipped + meetings.skipped,
    errors: [...daily.errors, ...weekly.errors, ...meetings.errors],
  };
}
