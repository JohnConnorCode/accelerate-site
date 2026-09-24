import { scheduleSocialReconciliation, scheduleSocialWeeklyDrafts } from "./social-marketing-work";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUSINESS_PULSE_COWORKER_ID,
  createDailyDigestWork,
  createDetectStaleDealsWork,
  createDetectStageBottleneckWork,
  createDetectVelocityChangeWork,
} from "./business-pulse-coworker";
import {
  OPERATIONS_COWORKER_ID,
  createDailyHealthCheckWork,
  createIntegrationStatusAuditWork,
  createDataQualityScanWork,
} from "./operations-coworker";
import {
  FINANCE_COWORKER_ID,
  createWeeklyReconciliationWork,
  createDetectOverduePaymentsWork,
  createRevenueStageAuditWork,
} from "./finance-coworker";
import { createPreCallBriefWork, MEETING_INTEL_COWORKER_ID } from "./meeting-intel-coworker";
import { SALES_COWORKER_ID } from "./sales-coworker";
import { listCoworkers } from "./coworkers";
import { proposeAction } from "./actions";
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

/** Coworker id -> the `bootstrap_coworker` payload name the executor accepts. */
const SCHEDULED_COWORKERS: ReadonlyArray<readonly [string, string, string]> = [
  [SALES_COWORKER_ID, "sales", "Sales"],
  [BUSINESS_PULSE_COWORKER_ID, "business_pulse", "Business Pulse"],
  [MEETING_INTEL_COWORKER_ID, "meeting_intel", "Meeting Intelligence"],
  [FINANCE_COWORKER_ID, "finance", "Finance"],
  [OPERATIONS_COWORKER_ID, "operations", "Operations"],
];

/**
 * Coworker-owned work only runs once the founder has approved that coworker's
 * bootstrap; queuing it before then just fails every cycle. Bootstrapping
 * registers the coworker's autonomy policies, so it is never done silently:
 * a missing coworker gets one pending approval (deduped) and its work waits.
 */
async function activeCoworkerIds(supabase: SupabaseClient): Promise<Set<string>> {
  const coworkers = await listCoworkers(supabase);
  const active = new Set(
    coworkers.filter((coworker) => coworker.status === "active").map((coworker) => coworker.id),
  );
  const registered = new Set(coworkers.map((coworker) => coworker.id));
  for (const [id, name, label] of SCHEDULED_COWORKERS) {
    if (registered.has(id)) continue;
    await proposeAction(supabase, {
      actionType: "bootstrap_coworker",
      title: `Turn on the ${label} coworker`,
      description: `Its scheduled work is paused until you approve this. Approving registers the coworker and its default autonomy policies.`,
      payload: { coworker: name },
      sourceContext: "work_scheduler",
      dedupeKey: `bootstrap-coworker:${name}`,
      proposedBy: "system",
    });
  }
  return active;
}

/**
 * Schedule daily work items for all coworkers that run on a daily cadence.
 * Each helper uses a date-based dedupe key so it won't create duplicates
 * if called multiple times in the same day.
 */
export async function scheduleDailyWork(
  supabase: SupabaseClient,
  active?: Set<string>,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };
  const activeIds = active ?? (await activeCoworkerIds(supabase));

  // Business Pulse: daily digest + stale deals + bottleneck + velocity change.
  const pulse = BUSINESS_PULSE_COWORKER_ID;
  const ops = OPERATIONS_COWORKER_ID;
  const finance = FINANCE_COWORKER_ID;
  const dailyCreators: Array<{
    name: string;
    coworker: string | null;
    fn: () => Promise<unknown>;
  }> = [
    { name: "daily_digest", coworker: pulse, fn: () => createDailyDigestWork(supabase) },
    { name: "detect_stale_deals", coworker: pulse, fn: () => createDetectStaleDealsWork(supabase) },
    {
      name: "detect_stage_bottleneck",
      coworker: pulse,
      fn: () => createDetectStageBottleneckWork(supabase),
    },
    {
      name: "detect_velocity_change",
      coworker: pulse,
      fn: () => createDetectVelocityChangeWork(supabase),
    },
    { name: "daily_health_check", coworker: ops, fn: () => createDailyHealthCheckWork(supabase) },
    {
      name: "integration_status_audit",
      coworker: ops,
      fn: () => createIntegrationStatusAuditWork(supabase),
    },
    { name: "data_quality_scan", coworker: ops, fn: () => createDataQualityScanWork(supabase) },
    {
      name: "detect_overdue_payments",
      coworker: finance,
      fn: () => createDetectOverduePaymentsWork(supabase),
    },
    {
      name: "revenue_stage_audit",
      coworker: finance,
      fn: () => createRevenueStageAuditWork(supabase),
    },
    // Proactive intelligence: daily NOTICE layer brief (not coworker-owned).
    {
      name: "proactive_intel_brief",
      coworker: null,
      fn: () => createProactiveIntelBriefWork(supabase),
    },
  ];

  for (const { name, coworker, fn } of dailyCreators) {
    if (coworker && !activeIds.has(coworker)) {
      summary.skipped++;
      continue;
    }
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
  } catch (error) {
    summary.errors.push(`daily_checkin: ${error instanceof Error ? error.message : String(error)}`);
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
  active?: Set<string>,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };
  const activeIds = active ?? (await activeCoworkerIds(supabase));

  // Finance: weekly revenue reconciliation.
  const weeklyCreators = [
    {
      name: "weekly_revenue_reconciliation",
      coworker: FINANCE_COWORKER_ID,
      fn: () => createWeeklyReconciliationWork(supabase),
    },
  ];

  for (const { name, coworker, fn } of weeklyCreators) {
    if (!activeIds.has(coworker)) {
      summary.skipped++;
      continue;
    }
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
  active?: Set<string>,
): Promise<WorkSchedulerSummary> {
  const summary: WorkSchedulerSummary = { created: 0, skipped: 0, errors: [] };
  if (!(active ?? (await activeCoworkerIds(supabase))).has(MEETING_INTEL_COWORKER_ID))
    return summary;

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
  const active = await activeCoworkerIds(supabase);
  const daily = await scheduleDailyWork(supabase, active);
  try {
    await scheduleSocialWeeklyDrafts(supabase);
  } catch {
    daily.errors.push(
      "Social weekly drafts could not be scheduled; verify source settings and time zone",
    );
  }
  try {
    await scheduleSocialReconciliation(supabase);
  } catch {
    daily.errors.push("Social publication receipts could not be scheduled for reconciliation");
  }

  // Monday = day 1 in ISO weekday.
  const isMonday = new Date().getUTCDay() === 1;
  const weekly = isMonday
    ? await scheduleWeeklyWork(supabase, active)
    : { created: 0, skipped: 0, errors: [] };

  // Scan upcoming meetings for pre-call briefs.
  const meetings = await scheduleMeetingBriefs(supabase, active);

  return {
    created: daily.created + weekly.created + meetings.created,
    skipped: daily.skipped + weekly.skipped + meetings.skipped,
    errors: [...daily.errors, ...weekly.errors, ...meetings.errors],
  };
}
