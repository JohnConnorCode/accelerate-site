import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRadarAssessmentRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { readRadarStore } from "./radar-store";
import { proposeAction } from "./actions";
import { isModuleEnabled } from "./modules";
import { RADAR_PROFILE_DEFAULTS } from "./radar-profile-contract";
import {
  RADAR_FACTORS,
  hasPublicAffairsSignals,
  radarAssessmentSchema,
  radarAssessmentPreviewSchema,
  radarAssessmentProposalSchema,
  radarSelectionSchema,
  selectRadarCandidates,
  type RadarSelectionCandidate,
} from "./radar-ranking-contract";
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, canonical(x)]),
    );
  return v;
}
function digest(v: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(v)))
    .digest("hex");
}
const snapshotsSchema = z
  .array(
    z
      .object({
        id: z.uuid(),
        revision: z.number().int().positive(),
        verification: z.enum(["supplied", "verified", "retracted"]),
      })
      .strict(),
  )
  .min(1)
  .max(10);
const factsSchema = radarAssessmentPreviewSchema
  .extend({
    version: z.literal(1),
    tenantId: z.uuid(),
    currentAssessmentId: z.uuid().nullable(),
    sources: snapshotsSchema,
    configRevision: z.string().length(64),
  })
  .strict();
const payloadSchema = factsSchema.extend({ digest: z.string().length(64) }).strict();
async function configFor(db: SupabaseClient, enabled = true) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Radar needs an explicit tenant database");
  const r = await db.from("tenants").select("status,config").eq("id", tenantId).single();
  if (r.error || r.data?.status !== "active") throw new Error("Radar workspace unavailable");
  if (enabled && !isModuleEnabled("opportunity-radar", r.data.config))
    throw new Error("Radar is disabled");
  return { tenantId, config: r.data.config as Record<string, unknown> };
}
export async function previewRadarAssessment(db: SupabaseClient, raw: unknown, now = new Date()) {
  const input = radarAssessmentPreviewSchema.parse(raw);
  const { tenantId, config } = await configFor(db);
  const packet = await readRadarStore(db, { opportunityId: input.opportunityId });
  if (!("opportunity" in packet) || !packet.opportunity || !packet.sourceVersions)
    throw new Error("Radar opportunity context unavailable");
  const opp = packet.opportunity;
  if (opp.revision !== input.expectedRevision)
    throw new Error("Radar opportunity changed; read current revision");
  if (["completed", "dismissed", "declined", "no_response"].includes(opp.state))
    throw new Error("Terminal opportunity cannot be assessed");
  const sources = snapshotsSchema.parse(
    packet.sourceVersions.map((v) => ({
      id: v.id,
      revision: v.revision,
      verification: v.verification,
    })),
  );
  const ids = new Set(sources.map((v) => v.id));
  for (const key of RADAR_FACTORS)
    if (input.assessment.estimates[key].sourceVersionIds.some((id) => !ids.has(id)))
      throw new Error("Assessment must cite current opportunity evidence");
  const expiry = Date.parse(input.assessment.expiresAt);
  if (expiry <= now.getTime() || expiry > now.getTime() + 30 * 86400000)
    throw new Error("Assessment expiry must be within thirty days");
  const previous = await db
    .from("radar_current_assessments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("opportunity_id", opp.id)
    .maybeSingle();
  if (previous.error) throw new Error("Radar assessments unavailable; verify the migration");
  if (input.assessment.classification === "business") {
    if (sources.some((s) => s.verification !== "verified"))
      throw new Error("Review every source before a business assessment");
    const content = await db
      .from("radar_source_versions")
      .select("id,title,body_text")
      .eq("tenant_id", tenantId)
      .in("id", [...ids])
      .limit(10);
    if (content.error || content.data?.length !== ids.size)
      throw new Error("Source classification context incomplete");
    if (
      hasPublicAffairsSignals(
        JSON.stringify([
          opp.title,
          opp.summary,
          opp.recommended_action,
          input.assessment,
          packet.citations,
          content.data,
        ]),
      )
    )
      throw new Error("Public affairs signals require neutral manual review");
  }
  const facts = factsSchema.parse({
    version: 1,
    ...input,
    tenantId,
    currentAssessmentId: previous.data?.id ?? null,
    sources,
    configRevision: digest(config),
  });
  return {
    ...facts,
    digest: digest(facts),
    requiresHumanApproval: true,
    interpretation: "Operator estimates; no independent recognition or probability is established",
  };
}
export async function proposeRadarAssessment(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const input = radarAssessmentProposalSchema.parse(raw);
  const { digest: expected, ...request } = input;
  const preview = await previewRadarAssessment(db, request);
  if (preview.digest !== expected)
    throw new Error("Assessment preview changed; review the current packet");
  const payload = payloadSchema.strip().parse(preview);
  return proposeAction(db, {
    actionType: "review_radar_assessment",
    title: `Review Radar assessment: ${input.assessment.topicKey}`,
    description:
      "Saves the exact operator estimates and subject classification. It does not send, publish, or turn judgments into source facts.",
    payload,
    entityType: "radar_opportunity",
    entityId: input.opportunityId,
    sourceContext: "admin_ai",
    proposedBy: actorEmail,
    dedupeKey: `radar-assessment:${preview.tenantId}:${input.operationId}:${expected}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}
export async function executeRadarAssessment(db: SupabaseClient, raw: unknown, actorEmail: string) {
  const payload = payloadSchema.parse(raw);
  const { digest: expected, ...facts } = payload;
  if (tenantIdForDatabase(db) !== payload.tenantId || digest(facts) !== expected)
    throw new Error("Assessment approval does not match its tenant and exact inputs");
  const prior = await db
    .from("radar_assessments")
    .select("id")
    .eq("tenant_id", payload.tenantId)
    .eq("operation_key", payload.operationId)
    .maybeSingle();
  if (prior.error) throw new Error("Radar assessment receipt unavailable");
  if (!prior.data) {
    const fresh = await previewRadarAssessment(db, {
      operationId: payload.operationId,
      opportunityId: payload.opportunityId,
      expectedRevision: payload.expectedRevision,
      assessment: payload.assessment,
    });
    if (fresh.digest !== expected)
      throw new Error("Radar assessment facts changed; preview and approve again");
  }
  const { config } = await configFor(db, !prior.data);
  if (!prior.data && digest(config) !== payload.configRevision)
    throw new Error("Radar configuration changed before dispatch");
  const result = await callRadarAssessmentRpc(db, {
    p_operation_key: payload.operationId,
    p_opportunity_id: payload.opportunityId,
    p_expected_revision: payload.expectedRevision,
    p_expected_assessment_id: payload.currentAssessmentId,
    p_assessment: payload.assessment,
    p_expected_sources: payload.sources,
    p_expected_config: config,
    p_actor_email: actorEmail,
  });
  if (result.error) throw new Error(`Radar assessment refused: ${result.error.message}`);
  return result.data;
}
export async function getRadarSelection(db: SupabaseClient, raw: unknown, now = new Date()) {
  const input = radarSelectionSchema.parse(raw);
  const { tenantId, config } = await configFor(db);
  const settings =
    (config.moduleSettings as Record<string, Record<string, unknown>> | undefined)?.[
      "opportunity-radar"
    ] ?? {};
  const limit = z
    .number()
    .int()
    .min(1)
    .max(10)
    .parse(settings.dailyShortlist ?? RADAR_PROFILE_DEFAULTS.dailyShortlist);
  const result = await db
    .from("radar_opportunities")
    .select("id,title,state,revision,evidence_revision,updated_at")
    .eq("tenant_id", tenantId)
    .in("state", ["draft", "researched", "needs_review", "approved", "in_progress"])
    .order("updated_at", { ascending: false })
    .order("id")
    .limit(51);
  if (result.error) throw new Error("Radar candidates unavailable");
  const opportunities = result.data!.slice(0, 50);
  const ids = opportunities.map((o) => o.id);
  if (!ids.length)
    return {
      ...selectRadarCandidates([], input, limit, now),
      candidates: [],
      candidateLimit: 50,
      truncated: false,
    };
  const reads = await Promise.allSettled([
    db
      .from("radar_current_assessments")
      .select("id,opportunity_id,opportunity_revision,assessment,source_snapshots,created_at")
      .eq("tenant_id", tenantId)
      .in("opportunity_id", ids)
      .limit(50),
    db
      .from("radar_current_evidence_links")
      .select("opportunity_id,opportunity_revision,source_version_id")
      .eq("tenant_id", tenantId)
      .in("opportunity_id", ids)
      .limit(1001),
  ] as const);
  if (reads.some((r) => r.status === "rejected" || r.value.error))
    throw new Error("Radar selection context incomplete");
  const assessments = reads[0].status === "fulfilled" ? reads[0].value.data! : [];
  const links = reads[1].status === "fulfilled" ? reads[1].value.data! : [];
  if (links.length > 1000)
    throw new Error(
      "Radar citation history exceeds selection context; use a smaller candidate window",
    );
  const currentLinks = links.filter((l) =>
    opportunities.some(
      (o) => o.id === l.opportunity_id && o.evidence_revision === l.opportunity_revision,
    ),
  );
  const sourceIds = [...new Set(currentLinks.map((l) => l.source_version_id))];
  const chunks = [];
  for (let i = 0; i < sourceIds.length; i += 100) chunks.push(sourceIds.slice(i, i + 100));
  const sourceResults = await Promise.allSettled(
    chunks.map((chunk) =>
      db
        .from("radar_source_versions")
        .select("id,revision,verification")
        .eq("tenant_id", tenantId)
        .in("id", chunk)
        .limit(100),
    ),
  );
  if (sourceResults.some((r) => r.status === "rejected" || r.value.error))
    throw new Error("Radar source review status unavailable");
  const sources = sourceResults.flatMap((r) => (r.status === "fulfilled" ? r.value.data! : []));
  const candidates: RadarSelectionCandidate[] = opportunities.map((opp) => {
    const row = assessments.find((a) => a.opportunity_id === opp.id);
    let deferral: string | null = null;
    let assessment = null;
    if (["completed", "dismissed", "declined", "no_response"].includes(opp.state))
      deferral = "Terminal opportunity";
    if (row) {
      const parsed = radarAssessmentSchema.safeParse(row.assessment),
        snaps = snapshotsSchema.safeParse(row.source_snapshots);
      if (!parsed.success || !snaps.success)
        deferral = "Assessment contract unavailable; review again";
      else {
        assessment = parsed.data;
        if (row.opportunity_revision !== opp.revision)
          deferral = "Opportunity changed since assessment";
        const linked = currentLinks
          .filter((l) => l.opportunity_id === opp.id)
          .map((l) => l.source_version_id)
          .sort();
        if (
          digest(linked) !== digest(snaps.data.map((s) => s.id).sort()) ||
          snaps.data.some((s) => {
            const v = sources.find((v) => v.id === s.id);
            return (
              !v ||
              v.revision !== s.revision ||
              v.verification !== s.verification ||
              (assessment!.classification === "business" && v.verification !== "verified")
            );
          })
        )
          deferral = "Evidence changed or is unavailable; review again";
      }
    }
    return { id: opp.id, assessment, reviewedAt: row?.created_at ?? null, deferral };
  });
  return {
    ...selectRadarCandidates(candidates, input, limit, now),
    candidates: opportunities.map((o) => ({ id: o.id, title: o.title })),
    candidateLimit: 50,
    truncated: result.data!.length > 50,
    asOf: now.toISOString(),
  };
}
