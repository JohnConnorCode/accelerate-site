import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminEmail, tenant } from "@/config/tenant";
import { recordAudit } from "./audit";
import { sendRecordedEmail } from "./communications";
import { safeErrorMessage } from "./db";

/**
 * Getting a failure in front of the founder when they are not looking at the
 * admin.
 *
 * Before this, every failure signal was in-app only: admin_notifications read
 * by a 30 second poll that exists solely while the tab is open. A cron could
 * fail nightly, a webhook could stop suppressing bounces, and a Google
 * connection could be revoked, and nobody would know until somebody happened to
 * open Setup Center.
 *
 * Two rules make this safe to run unattended:
 *
 *   1. Deduplicate. A recurring condition must produce one unread notification,
 *      not one per occurrence, or the alert channel becomes the noise it was
 *      meant to cut through.
 *   2. Never let alerting break the thing it is reporting on. Every failure in
 *      here is caught and logged; an alert that throws must not turn a partial
 *      job into a failed one.
 */

export type AlertKind = "job" | "source" | "integration" | "webhook" | "send" | "recovery";

export interface OperationalAlert {
  kind: AlertKind;
  /** Stable across repeats of the same condition. Drives both dedupe keys. */
  key: string;
  title: string;
  detail: string;
  /** Where the founder should go to act on it. */
  link?: string;
}

/** Email is reserved for things that are actually costing money or trust. */
const EMAIL_WORTHY: ReadonlySet<AlertKind> = new Set(["job", "integration", "send", "webhook"]);

function dedupeKey(alert: OperationalAlert): string {
  return `alert:${alert.kind}:${alert.key}`.slice(0, 200);
}

/**
 * Records an operational alert. In-app always, email for the kinds that warrant
 * interrupting someone. Returns what actually happened so callers can log it.
 */
export async function raiseOperationalAlert(
  supabase: SupabaseClient,
  alert: OperationalAlert,
): Promise<{ notified: boolean; emailed: boolean; duplicate: boolean }> {
  const key = dedupeKey(alert);
  let duplicate = false;
  let notified = false;

  try {
    const { error } = await supabase.from("admin_notifications").insert({
      type: "task_overdue",
      title: alert.title,
      description: alert.detail.slice(0, 500),
      link: alert.link ?? "/admin/setup",
      priority: "urgent",
      dedupe_key: key,
    });
    if (error) {
      // 23505 means an unread alert for this condition already exists, which is
      // the dedupe working rather than a failure.
      duplicate = error.code === "23505";
      if (!duplicate) console.error("[alerts] notification insert failed:", error.message);
    } else {
      notified = true;
    }
  } catch (error) {
    console.error("[alerts] notification insert threw:", safeErrorMessage(error));
  }

  // Only email on the first unread occurrence, so a nightly failure sends one
  // message rather than one per night until it is acknowledged.
  let emailed = false;
  if (notified && EMAIL_WORTHY.has(alert.kind)) {
    try {
      await sendRecordedEmail(supabase, {
        to: adminEmail(),
        subject: `[${tenant.brand.name}] ${alert.title}`,
        text: [
          alert.detail,
          "",
          `Where to look: ${tenant.brand.siteUrl}${alert.link ?? "/admin/setup"}`,
          "",
          "You are receiving this once for this condition. It will not repeat until you mark the notification read and the condition happens again.",
        ].join("\n"),
        source: "automation",
        template: `alert-${alert.kind}`,
        idempotencyKey: key,
        actorEmail: tenant.founder.systemActorEmail,
      });
      emailed = true;
    } catch (error) {
      // An alert that cannot be emailed must still not break the caller.
      console.error("[alerts] alert email failed:", safeErrorMessage(error));
    }
  }

  if (notified) {
    await recordAudit(supabase, {
      actorEmail: tenant.founder.systemActorEmail,
      action: "operations.alert_raised",
      entityType: alert.kind,
      entityId: null,
      source: "automation",
      metadata: { key: alert.key, emailed, title: alert.title },
    }).catch(() => undefined);
  }

  return { notified, emailed, duplicate };
}

/** Convenience for the cron wrappers: report a job that failed outright. */
export async function alertJobFailure(supabase: SupabaseClient, jobKey: string, error: unknown) {
  return raiseOperationalAlert(supabase, {
    kind: "job",
    key: jobKey,
    title: `Scheduled job failed: ${jobKey}`,
    detail: `${jobKey} did not complete. ${safeErrorMessage(error)}`,
    link: "/admin/setup",
  });
}

/** Report that a run had to take over an abandoned claim. */
export async function alertStaleRecovery(supabase: SupabaseClient, jobKey: string) {
  return raiseOperationalAlert(supabase, {
    kind: "recovery",
    key: `${jobKey}:stale-claim`,
    title: `Recovered an abandoned run: ${jobKey}`,
    detail: `A previous ${jobKey} run claimed the job and never reported a result, so this run took the claim over. A job that keeps needing recovery is timing out or crashing partway through.`,
    link: "/admin/setup",
  });
}
