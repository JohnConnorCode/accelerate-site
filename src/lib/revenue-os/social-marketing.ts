import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callSocialRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { proposeAction } from "./actions";
import { tenantPostizClient } from "./postiz-adapter";
import { socialDigest } from "./social-digest";
import {
  socialPreviewSchema,
  socialProposalSchema,
  socialReadSchema,
  socialWeeklySchema,
} from "./social-marketing-contract";

export async function socialConfiguration(db: SupabaseClient, enabled = true) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Social Marketing requires workspace context");
  const { data, error } = await db
    .from("tenants")
    .select("status,config,updated_at")
    .eq("id", tenantId)
    .single();
  if (
    error ||
    data.status !== "active" ||
    (enabled && !isModuleEnabled("social-marketing", data.config))
  )
    throw new Error("Social Marketing is disabled or unavailable");
  return {
    tenantId,
    config: data.config,
    updatedAt: String(data.updated_at),
    enabled: isModuleEnabled("social-marketing", data.config),
  };
}
export async function readSocialWorkspace(db: SupabaseClient, raw: unknown = {}) {
  const input = socialReadSchema.parse(raw);
  const cfg = await socialConfiguration(db, false);
  const [posts, attempts, receipts, media] = await Promise.all([
    db
      .from("social_posts")
      .select("*")
      .eq("tenant_id", cfg.tenantId)
      .order("scheduled_at", { ascending: false })
      .limit(input.limit),
    db
      .from("social_publication_attempts")
      .select("*")
      .eq("tenant_id", cfg.tenantId)
      .order("started_at", { ascending: false })
      .limit(input.limit),
    db
      .from("social_operation_receipts")
      .select("id,operation,created_at,actor_email")
      .eq("tenant_id", cfg.tenantId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("media_assets")
      .select("id,mime_type,size_bytes,content_hash,created_at")
      .eq("tenant_id", cfg.tenantId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if ([posts, attempts, receipts, media].some((r) => r.error))
    throw new Error("Social Marketing storage is unavailable; verify the migration");
  let channels: Awaited<ReturnType<Awaited<ReturnType<typeof tenantPostizClient>>["channels"]>> =
    [];
  let connection: { organizationId: string; version: number } | null = null;
  let setupError: string | null = null;
  try {
    const client = await tenantPostizClient(db, { historyOnly: !cfg.enabled });
    channels = (await client.channels()).filter((c) => c.identifier === "linkedin-page");
    connection = { organizationId: client.organizationId, version: client.credentialVersion };
  } catch {
    console.warn(
      "[social-marketing] Operation unavailable; details retained in the returned state or publication attempt.",
    );
    setupError = "Connect a verified Postiz organization and LinkedIn company page in Setup.";
  }
  return {
    enabled: cfg.enabled,
    posts: posts.data,
    attempts: attempts.data,
    receipts: receipts.data,
    media: media.data,
    channels,
    connection,
    setupError,
    settings: cfg.config.moduleSettings?.["social-marketing"] ?? {},
    truncated: posts.data!.length === input.limit,
  };
}
export async function previewSocialChange(db: SupabaseClient, raw: unknown) {
  const input = socialPreviewSchema.parse(raw);
  const cfg = await socialConfiguration(db);
  if (input.change.operation === "reconcile") {
    const attempt = await db
      .from("social_publication_attempts")
      .select("*")
      .eq("tenant_id", cfg.tenantId)
      .eq("id", input.change.attemptId)
      .single();
    if (
      attempt.error ||
      !["unknown", "submitting"].includes(attempt.data.state) ||
      attempt.data.provider_post_id
    )
      throw new Error("Select an unresolved publication attempt");
    const post = await db
      .from("social_posts")
      .select("*")
      .eq("tenant_id", cfg.tenantId)
      .eq("id", attempt.data.post_id)
      .single();
    if (post.error) throw new Error("Attempt post unavailable");
    const client = await tenantPostizClient(db, { historyOnly: true });
    if (client.organizationId !== post.data.organization_id)
      throw new Error("Reconnect the original Postiz organization before receipt reconciliation");
    const providerPostId = input.change.providerPostId;
    const observed = (
      await client.posts(
        new Date(Date.parse(attempt.data.started_at) - 86400000).toISOString(),
        new Date(Date.parse(attempt.data.started_at) + 86400000).toISOString(),
      )
    ).find((p) => p.id === providerPostId);
    if (
      !observed ||
      observed.integration.id !== post.data.draft.channelId ||
      observed.content !== post.data.draft.content
    )
      throw new Error("Provider receipt does not match this organization, page and approved text");
    const facts = {
      version: 1,
      ...input,
      tenantId: cfg.tenantId,
      configUpdatedAt: cfg.updatedAt,
      before: [post.data],
      attempt: attempt.data,
      providerReceipt: observed,
      connection: {
        organizationId: client.organizationId,
        version: client.credentialVersion,
        origin: client.origin,
      },
    };
    return {
      ...facts,
      digest: socialDigest(facts),
      consequences:
        "Associate this exact Postiz record with the unresolved attempt. Confirm its image and publication history in Postiz. This records a receipt and never resubmits the post.",
    };
  }
  const ids =
    input.change.operation === "save"
      ? input.change.drafts.map((d) => d.id)
      : input.change.posts.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("Each post may appear once in a batch");
  const result = await db
    .from("social_posts")
    .select("*")
    .eq("tenant_id", cfg.tenantId)
    .in("id", ids)
    .order("id");
  if (result.error) throw new Error("Draft storage unavailable");
  const before = result.data ?? [];
  const revisions = input.change.operation === "save" ? input.change.drafts : input.change.posts;
  for (const item of revisions) {
    const current = before.find((p) => p.id === item.id);
    if (
      (!current && item.revision !== 0) ||
      (current && current.revision !== item.revision) ||
      (current && !["draft", "scheduled", "cancelled", "needs_review"].includes(current.state))
    )
      throw new Error("Post changed or is already being published; refresh its history");
  }
  let connection: { organizationId: string; version: number; origin: string } | null = null;
  if (input.change.operation !== "cancel") {
    const client = await tenantPostizClient(db);
    connection = {
      organizationId: client.organizationId,
      version: client.credentialVersion,
      origin: client.origin,
    };
    const drafts =
      input.change.operation === "save" ? input.change.drafts : before.map((p) => p.draft);
    const channels = await client.channels();
    for (const draft of drafts) {
      if (
        !channels.some(
          (c) => c.id === draft.channelId && c.identifier === "linkedin-page" && !c.disabled,
        )
      )
        throw new Error("An active LinkedIn company page from this workspace is required");
      if (
        input.change.operation === "schedule" &&
        Date.parse(draft.scheduledAt) <= Date.now() + 60000
      )
        throw new Error("Choose a publication time at least one minute ahead");
      if (draft.mediaId) {
        const media = await db
          .from("media_assets")
          .select("id,content_hash")
          .eq("tenant_id", cfg.tenantId)
          .eq("id", draft.mediaId)
          .single();
        if (media.error || !media.data)
          throw new Error("The image is unavailable in this workspace");
      }
    }
  }
  const facts = {
    version: 1,
    ...input,
    tenantId: cfg.tenantId,
    configUpdatedAt: cfg.updatedAt,
    before,
    connection,
  };
  return {
    ...facts,
    digest: socialDigest(facts),
    consequences:
      input.change.operation === "schedule"
        ? "Approve these exact posts, images, LinkedIn pages and times. The worker will submit each due post to Postiz for public publication. Acceptance does not prove publication."
        : input.change.operation === "cancel"
          ? "Cancel these posts before dispatch. Posts already submitted to Postiz cannot be cancelled here."
          : "Save these drafts and invalidate earlier publication approval. This does not publish.",
  };
}
export async function proposeSocialChange(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = socialProposalSchema.parse(raw);
  const preview = await previewSocialChange(db, {
    operationId: input.operationId,
    change: input.change,
  });
  if (preview.digest !== input.digest) throw new Error("The preview changed; review it again");
  const { consequences, ...payload } = preview;
  return proposeAction(db, {
    actionType: "social_marketing_change",
    title: `Social Marketing: ${input.change.operation}`,
    description: consequences,
    payload,
    proposedBy: actorEmail,
    sourceContext: "admin_ai",
    dedupeKey: `social:${preview.tenantId}:${input.operationId}:${preview.digest}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}
export async function executeSocialChange(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
  actionId?: string,
) {
  const payload = socialProposalSchema.passthrough().parse(raw);
  if (payload.tenantId !== tenantIdForDatabase(db)) throw new Error("Approval workspace mismatch");
  const prior = await db
    .from("social_operation_receipts")
    .select("*")
    .eq("tenant_id", tenantIdForDatabase(db)!)
    .eq("operation_key", payload.operationId)
    .maybeSingle();
  if (prior.error) throw new Error("Social receipt storage unavailable");
  if (prior.data) {
    const replay = await callSocialRpc(db, "execute_social_command", {
      p_operation_key: payload.operationId,
      p_change: payload.change,
      p_config_updated_at: payload.configUpdatedAt,
      p_actor_email: actorEmail,
      p_action_id: actionId ?? null,
    });
    if (replay.error) throw new Error("Operation identity conflict");
    return replay.data;
  }
  const fresh = await previewSocialChange(db, {
    operationId: payload.operationId,
    change: payload.change,
  });
  if (fresh.digest !== payload.digest)
    throw new Error("Content, connection or configuration changed; approve a fresh preview");
  if (["schedule", "reconcile"].includes(payload.change.operation) && !actionId)
    throw new Error("Publication scheduling requires the shared human approval queue");
  if (payload.change.operation === "reconcile" && "providerReceipt" in fresh) {
    const observed = fresh.providerReceipt;
    const state =
      observed.state === "PUBLISHED" && observed.releaseURL
        ? "published"
        : observed.state === "ERROR"
          ? "failed"
          : "submitted";
    const result = await callSocialRpc(db, "record_social_publication", {
      p_attempt_id: payload.change.attemptId,
      p_state: state,
      p_provider_post_id: observed.id,
      p_release_url: state === "published" ? observed.releaseURL : null,
      p_reason: "Exact provider receipt associated after human review",
    });
    if (result.error) throw new Error("Receipt association failed; no post was resubmitted");
    return result.data;
  }
  const result = await callSocialRpc(db, "execute_social_command", {
    p_operation_key: payload.operationId,
    p_change: payload.change,
    p_config_updated_at: fresh.configUpdatedAt,
    p_actor_email: actorEmail,
    p_action_id: actionId ?? null,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
/** Source excerpts are preserved verbatim. No model spend or invented claims. */
export async function prepareSocialWeek(db: SupabaseClient, raw: unknown) {
  const input = socialWeeklySchema.parse(raw);
  const cfg = await socialConfiguration(db);
  const fragments = input.source.excerpt
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (fragments.length < 3)
    throw new Error("Supply three source-backed paragraphs, separated by blank lines");
  const start = Date.parse(input.weekStart);
  if (start < Date.now()) throw new Error("Choose a future week start");
  const settings = cfg.config.moduleSettings?.["social-marketing"] ?? {};
  return {
    brandGuidance: settings.brandGuidance ?? "",
    drafts: fragments.slice(0, 3).map((excerpt, i) => ({
      id: randomUUID(),
      revision: 0,
      title: `${input.source.title} ${i + 1}`,
      content: `${excerpt}\n\n${input.source.url}`.slice(0, 3000),
      channelId: input.channelId,
      scheduledAt: new Date(start + i * 2 * 86400000).toISOString(),
      timeZone: input.timeZone,
      sources: [input.source],
      mediaId: null,
    })),
    publicationApproved: false,
  };
}
