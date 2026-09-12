import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callSocialRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { tenantPostizClient } from "./postiz-adapter";
import { readWorkspaceMedia } from "./media-assets";
import { createHash } from "node:crypto";
import {
  prepareSocialWeek,
  previewSocialChange,
  executeSocialChange,
  socialConfiguration,
} from "./social-marketing";
import { createWorkItem, type WorkItem } from "./work-items";
import { registerWorkKindHandler } from "./work-executor";
import type { WorkResult } from "./work-result";
async function record(
  db: SupabaseClient,
  id: string,
  state: string,
  postId: string | null = null,
  url: string | null = null,
  reason: string | null = null,
  metrics: unknown = null,
) {
  const result = await callSocialRpc(db, "record_social_publication", {
    p_attempt_id: id,
    p_state: state,
    p_provider_post_id: postId,
    p_release_url: url,
    p_reason: reason,
    p_metrics: metrics,
  });
  if (result.error)
    throw new Error("Publication receipt could not be saved; reconcile this attempt");
  return result.data;
}
export async function publishSocialPost(
  db: SupabaseClient,
  work: WorkItem,
  signal?: AbortSignal,
): Promise<WorkResult> {
  const deadline = AbortSignal.any([AbortSignal.timeout(25000), ...(signal ? [signal] : [])]);
  deadline.throwIfAborted();
  const tenantId = tenantIdForDatabase(db)!;
  const p = await db
    .from("social_posts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", work.entity_id)
    .single();
  if (p.error) throw new Error("Scheduled post unavailable");
  // Work identity is revision-bound: an old wake-up cannot publish a newly edited post.
  const revision = Number(work.dedupe_key?.split(":").at(-1));
  if (!Number.isSafeInteger(revision) || p.data.revision !== revision)
    return {
      status: "skipped",
      outcome: "The scheduled revision changed; new approval is required",
    };
  const claim = await callSocialRpc(db, "claim_social_publication", {
    p_post_id: p.data.id,
    p_revision: revision,
  });
  if (claim.error) throw new Error("Publication claim failed");
  if (!claim.data.claimed)
    return {
      status: "skipped",
      outcome:
        claim.data.reason ??
        "Post cancelled, not due, changed, or already attempted; no new provider request",
    };
  const attempt = claim.data.attempt;
  const post = claim.data.post;
  try {
    const client = await tenantPostizClient(db, { signal: deadline });
    const cfg = await socialConfiguration(db);
    if (
      cfg.updatedAt !== post.approved_config_updated_at ||
      client.credentialVersion !== post.connection_version ||
      client.organizationId !== post.organization_id ||
      client.origin !== post.approved_origin
    )
      throw new Error("Approval configuration changed");
    const media = post.media_id ? await readWorkspaceMedia(db, post.media_id) : null;
    const uploaded = media ? await client.upload(media.bytes, media.mime) : null;
    const fresh = await socialConfiguration(db);
    if (fresh.updatedAt !== post.approved_config_updated_at)
      throw new Error("Approval configuration changed before submission");
    const authority = await callSocialRpc(db, "assert_social_dispatch", {
      p_attempt_id: attempt.id,
    });
    if (authority.error || authority.data !== true)
      throw new Error("Publication authority changed before submission");
    deadline.throwIfAborted();
    const receipt = await client.submitNow(post.draft.channelId, post.draft.content, uploaded);
    await record(db, attempt.id, "submitted", receipt.postId);
    return {
      status: "completed",
      outcome:
        "Postiz accepted the post. Publication remains unverified until a LinkedIn URL is received.",
    };
  } catch {
    // Includes interruption between provider acceptance and local receipt persistence.
    // This durable attempt is never eligible for another automatic submission.
    await record(
      db,
      attempt.id,
      "unknown",
      null,
      null,
      "Submission outcome requires provider reconciliation. Do not retry publication.",
    );
    return {
      status: "reconciliation_required",
      outcome: "Postiz outcome is unknown. Review the retained attempt before any new publication.",
    };
  }
}
export async function reconcileSocialPost(db: SupabaseClient, work: WorkItem): Promise<WorkResult> {
  const tenantId = tenantIdForDatabase(db)!;
  const a = await db
    .from("social_publication_attempts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", work.entity_id)
    .single();
  if (a.error) throw new Error("Publication attempt unavailable");
  const attempt = a.data;
  if (!attempt.provider_post_id)
    return {
      status: "reconciliation_required",
      outcome:
        "No provider post ID was received. Inspect this organization’s Postiz history; no publication retry was made.",
    };
  if (attempt.state === "failed")
    return { status: "skipped", outcome: "Provider reported failure; retained for review" };
  const client = await tenantPostizClient(db, { historyOnly: true });
  const posts = await client.posts(
    new Date(Date.parse(attempt.started_at) - 86400000).toISOString(),
    new Date(Date.parse(attempt.started_at) + 86400000).toISOString(),
  );
  const provider = posts.find((p) => p.id === attempt.provider_post_id);
  if (!provider)
    return {
      status: "deferred",
      nextCheckAt: new Date(Date.now() + 900000).toISOString(),
      outcome: "Postiz has not returned this post; publication remains unverified",
    };
  const local = await db
    .from("social_posts")
    .select("draft,organization_id")
    .eq("tenant_id", tenantId)
    .eq("id", attempt.post_id)
    .single();
  if (
    local.error ||
    client.organizationId !== local.data.organization_id ||
    provider.integration.id !== local.data.draft.channelId ||
    provider.content !== local.data.draft.content
  )
    return {
      status: "reconciliation_required",
      outcome: "Provider receipt does not match the approved page and content",
    };
  if (provider.state === "PUBLISHED" && provider.releaseURL) {
    let metrics: unknown = { available: false, reason: "Provider metrics unavailable" };
    try {
      metrics = { available: true, provider: "postiz", values: await client.metrics(provider.id) };
    } catch {
      /* Keep unavailable explicit; never invent zero engagement. */
    }
    await record(db, attempt.id, "published", provider.id, provider.releaseURL, null, metrics);
    return { status: "completed", outcome: `Verified publication: ${provider.releaseURL}` };
  }
  if (provider.state === "ERROR") {
    await record(
      db,
      attempt.id,
      "failed",
      provider.id,
      null,
      "Postiz reported publication failure",
    );
    return {
      status: "completed",
      outcome:
        "Postiz reported a failed publication; review before creating another approved draft",
    };
  }
  return {
    status: "deferred",
    nextCheckAt: new Date(Date.now() + 300000).toISOString(),
    outcome: "Postiz accepted this post but has not proved publication",
  };
}
export function registerSocialWorkHandlers() {
  registerWorkKindHandler("social_prepare_week", prepareSocialWeeklyDrafts);
  registerWorkKindHandler("social_publish", publishSocialPost);
  registerWorkKindHandler("social_reconcile", reconcileSocialPost);
}
export async function scheduleSocialReconciliation(db: SupabaseClient) {
  const tenantId = tenantIdForDatabase(db)!;
  // Reads and receipt polling remain available after disabling new publication.
  const result = await db
    .from("social_publication_attempts")
    .select("id,state,metrics_at")
    .eq("tenant_id", tenantId)
    .in("state", ["submitting", "unknown", "submitted", "published"])
    .order("reconciled_at", { ascending: true, nullsFirst: true })
    .limit(20);
  if (result.error) throw new Error("Social reconciliation storage unavailable");
  for (const a of result.data ?? []) {
    if (a.state === "published" && a.metrics_at && Date.parse(a.metrics_at) > Date.now() - 86400000)
      continue;
    if (["submitting", "unknown"].includes(a.state)) continue; // Unknown attempts need explicit operator association, never heuristic matching.
    await createWorkItem(db, {
      kind: "social_reconcile",
      objective: "Verify Postiz publication and metrics",
      reason: "Provider acceptance requires a publication receipt",
      source: "social-marketing",
      entityType: "social_attempt",
      entityId: a.id,
      dedupeKey: `social-reconcile:${a.id}`,
      maxAttempts: 3,
      surfaceInInbox: false,
    });
  }
}

async function prepareSocialWeeklyDrafts(db: SupabaseClient, work: WorkItem): Promise<WorkResult> {
  const cfg = await socialConfiguration(db, false);
  const settings = cfg.config.moduleSettings?.["social-marketing"] ?? {};
  if (!cfg.enabled || settings.prepareWeekly !== true)
    return { status: "skipped", outcome: "Weekly draft preparation is off" };
  const stableId = (suffix: string) => {
    const hash = createHash("sha256")
      .update(`${cfg.tenantId}:${work.dedupe_key}:${suffix}`)
      .digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  };
  const operationId = stableId("operation");
  const prior = await db
    .from("social_operation_receipts")
    .select("id")
    .eq("tenant_id", cfg.tenantId)
    .eq("operation_key", operationId)
    .maybeSingle();
  if (prior.error) throw new Error("Weekly draft receipt unavailable");
  if (prior.data)
    return { status: "completed", outcome: "This week’s source-backed drafts already exist" };
  const week = await prepareSocialWeek(db, {
    source: {
      title: settings.weeklySourceTitle,
      url: settings.weeklySourceUrl,
      excerpt: settings.weeklySourceText,
    },
    channelId: settings.weeklyChannelId,
    weekStart: new Date(Date.now() + 2 * 86400000).toISOString(),
    timeZone: settings.timeZone || "UTC",
  });
  const drafts = week.drafts.map((draft, index) => ({ ...draft, id: stableId(String(index)) }));
  const preview = await previewSocialChange(db, {
    operationId,
    change: { operation: "save", drafts },
  });
  await executeSocialChange(db, preview, "system:weekly-social-drafts");
  return {
    status: "completed",
    outcome:
      "Three source-backed drafts prepared. Each needs editorial review and exact human publication approval.",
  };
}
export async function scheduleSocialWeeklyDrafts(db: SupabaseClient) {
  const cfg = await socialConfiguration(db, false);
  const settings = cfg.config.moduleSettings?.["social-marketing"] ?? {};
  if (!cfg.enabled || settings.prepareWeekly !== true) return;
  // One calendar-week key in the workspace zone. Approval retains exact UTC instants.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: settings.timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const localDay = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  localDay.setUTCDate(localDay.getUTCDate() - ((localDay.getUTCDay() + 6) % 7));
  const week = localDay.toISOString().slice(0, 10);
  const prior = await db
    .from("work_items")
    .select("id")
    .eq("tenant_id", cfg.tenantId)
    .eq("kind", "social_prepare_week")
    .eq("dedupe_key", `social-week:${week}`)
    .limit(1);
  if (prior.error) throw new Error("Weekly scheduling history unavailable");
  if (prior.data?.length) return;
  await createWorkItem(db, {
    kind: "social_prepare_week",
    objective: "Prepare this week’s three social drafts",
    reason: "Workspace enabled source-backed weekly draft preparation",
    source: "social-marketing",
    dedupeKey: `social-week:${week}`,
    maxAttempts: 2,
    surfaceInInbox: false,
  });
}
