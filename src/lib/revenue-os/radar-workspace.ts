import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { getModuleSettings, isModuleEnabled } from "./modules";
import { readRadarStore, previewRadarStoreChange, proposeRadarStoreChange } from "./radar-store";
import { getRadarSelection, previewRadarAssessment, proposeRadarAssessment } from "./radar-ranking";
import { readRadarModelReceipts, prepareRadarBrief } from "./radar-model";
import { radarCandidateFromEvidence } from "./radar-ranking-contract";
import {
  radarWorkspaceReadSchema,
  radarOpportunityBriefSchema,
  radarWorkspaceCommandSchema,
  type RadarWorkspaceData,
  type RadarOpportunityView,
  type RadarSourceView,
} from "./radar-workspace-contract";
export async function readRadarWorkspace(
  db: SupabaseClient,
  raw: unknown,
): Promise<RadarWorkspaceData> {
  const input = radarWorkspaceReadSchema.parse(raw),
    tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Radar requires a workspace");
  const tenant = await db.from("tenants").select("name,status,config").eq("id", tenantId).single();
  if (tenant.error || tenant.data?.status !== "active")
    throw new Error("Radar workspace unavailable");
  const enabled = isModuleEnabled("opportunity-radar", tenant.data.config);
  const profile = getModuleSettings("opportunity-radar", tenant.data.config.moduleSettings);
  const reads = await Promise.allSettled([
    readRadarStore(
      db,
      input.opportunityId ? { opportunityId: input.opportunityId } : { limit: 20 },
    ),
    enabled && !input.opportunityId ? getRadarSelection(db, {}) : Promise.resolve(null),
    readRadarModelReceipts(db),
  ] as const);
  if (reads[0].status !== "fulfilled")
    throw new Error("Radar evidence could not be loaded. Check installation and retry.");
  const store = reads[0].value,
    warnings: string[] = [];
  const selection = reads[1].status === "fulfilled" ? reads[1].value : null;
  if (reads[1].status === "rejected")
    warnings.push("Selection could not be loaded. Retained records are shown below.");
  const modelStatus = reads[2].status === "fulfilled" ? reads[2].value : null;
  const modelMode = String(profile.modelMode ?? "off");
  const modelAvailable =
    enabled &&
    modelMode !== "off" &&
    Boolean(
      modelStatus?.models.some((m) => m.id === profile.preferredModel && m.availableForRadar),
    ) &&
    Number(profile.maxModelCallsPerDay) > 0;
  const model = {
    mode: modelMode,
    available: modelAvailable,
    reason: !enabled
      ? "Radar is turned off"
      : modelMode === "off"
        ? "AI drafting is off. Manual research and drafts cost no model credits."
        : modelAvailable
          ? "Uses your configured model and enforced budget. Live quota and pricing are checked before each request."
          : "AI drafting needs an evaluated model and an enabled call allowance in Radar settings.",
  };
  if (!modelStatus)
    warnings.push("Model status is unavailable. Research and manual drafts remain available.");
  const opportunityView = (o: Record<string, unknown>): RadarOpportunityView => ({
    id: String(o.id),
    title: String(o.title),
    summary: String(o.summary),
    recommended_action: String(o.recommended_action),
    kind: String(o.kind),
    state: String(o.state),
    revision: Number(o.revision),
    evidence_revision: Number(o.evidence_revision),
    contact_id: typeof o.contact_id === "string" ? o.contact_id : null,
    company_id: typeof o.company_id === "string" ? o.company_id : null,
  });
  const sourceView = (
    v: Record<string, unknown>,
    urls: Array<{ id: string; canonical_url: string }>,
  ): RadarSourceView => ({
    id: String(v.id),
    source_id: String(v.source_id),
    title: String(v.title),
    version: Number(v.version),
    revision: Number(v.revision),
    verification: v.verification as RadarSourceView["verification"],
    canonicalUrl: urls.find((s) => s.id === v.source_id)?.canonical_url ?? null,
    published_at: typeof v.published_at === "string" ? v.published_at : null,
  });
  let packet: RadarWorkspaceData["packet"] = null;
  let opportunities: RadarOpportunityView[] = [],
    sources: RadarSourceView[] = [];
  if ("opportunity" in store && store.opportunity) {
    const o = opportunityView(store.opportunity);
    opportunities = [o];
    sources = store.sourceVersions!.map((v) => sourceView(v, store.sources ?? []));
    const extra = await Promise.allSettled([
      o.contact_id
        ? db
            .from("contacts")
            .select("id,full_name,communication_status")
            .eq("tenant_id", tenantId)
            .eq("id", o.contact_id)
            .single()
        : Promise.resolve({ data: null, error: null }),
      db
        .from("radar_current_assessments")
        .select("opportunity_revision,assessment,source_snapshots,created_at")
        .eq("tenant_id", tenantId)
        .eq("opportunity_id", o.id)
        .maybeSingle(),
    ] as const);
    const contact =
      extra[0].status === "fulfilled" && !extra[0].value.error ? extra[0].value.data : null;
    if (o.contact_id && !contact)
      warnings.push(
        "Linked contact restrictions are unavailable; do not assume outreach permission.",
      );
    const assessmentRow =
      extra[1].status === "fulfilled" && !extra[1].value.error ? extra[1].value.data : null;
    const candidate = radarCandidateFromEvidence(
      o,
      assessmentRow,
      (store.citations ?? []).map((c) => c.source_version_id),
      store.sourceVersions ?? [],
    );
    const expired = Boolean(
      candidate.assessment && Date.parse(candidate.assessment.expiresAt) <= Date.now(),
    );
    packet = {
      opportunity: o,
      citations: (store.citations ?? []).map((c) => ({
        source_version_id: c.source_version_id,
        observation: c.observation,
        evidence_id: c.evidence_id ?? null,
      })),
      sources,
      assets: store.assets ?? [],
      outcomes: store.outcomes ?? [],
      history: store.history ?? [],
      contact: contact
        ? {
            id: contact.id,
            name: contact.full_name,
            communicationStatus: contact.communication_status ?? "unknown",
          }
        : null,
      assessment: candidate.assessment,
      assessmentCurrent: Boolean(candidate.assessment && !candidate.deferral && !expired),
      assessmentReason: candidate.deferral ?? (expired ? "Assessment expired; review again" : null),
      truncated: store.truncated,
    };
  } else if ("opportunities" in store) {
    opportunities = store.opportunities!.map(opportunityView);
    sources = store.sourceVersions!.map((v) => sourceView(v, []));
  }
  return {
    enabled,
    organization: String(profile.organization || tenant.data.name),
    model,
    selection,
    candidateTitles:
      selection?.candidates ?? opportunities.map((o) => ({ id: o.id, title: o.title })),
    opportunities,
    sources,
    packet,
    warnings,
    truncated: Boolean(store.truncated || selection?.truncated),
  };
}
export async function dispatchRadarWorkspaceCommand(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const command = radarWorkspaceCommandSchema.parse(raw);
  switch (command.kind) {
    case "prepare_brief":
      return prepareRadarOpportunityBrief(db, command.input);
    case "read_record":
      return readRadarStore(db, command.input);
    case "store_preview":
      return previewRadarStoreChange(db, command.input);
    case "store_propose":
      return proposeRadarStoreChange(db, command.input, actorEmail);
    case "assessment_preview":
      return previewRadarAssessment(db, command.input);
    case "assessment_propose":
      return proposeRadarAssessment(db, command.input, actorEmail);
  }
}

export async function prepareRadarOpportunityBrief(
  db: SupabaseClient,
  raw: unknown,
  workItemId?: string,
) {
  const input = radarOpportunityBriefSchema.parse(raw);
  const packet = await readRadarStore(db, { opportunityId: input.opportunityId });
  if (!("opportunity" in packet) || packet.opportunity?.revision !== input.expectedRevision)
    throw new Error("Opportunity changed; refresh before drafting");
  const ids = [...new Set(input.sourceVersionIds)];
  if (
    ids.length !== input.sourceVersionIds.length ||
    ids.some(
      (id) => !packet.sourceVersions?.some((v) => v.id === id && v.verification !== "retracted"),
    )
  )
    throw new Error("Choose current, non-retracted source versions");
  const r = await db
    .from("radar_source_versions")
    .select("id,source_id,body_text")
    .eq("tenant_id", tenantIdForDatabase(db)!)
    .in("id", ids)
    .limit(5);
  if (r.error || r.data?.length !== ids.length) throw new Error("Draft source text unavailable");
  const sources = r.data.map((v) => ({
    id: v.id,
    url: packet.sources?.find((s) => s.id === v.source_id)?.canonical_url ?? "",
    text: v.body_text.slice(0, 3000),
  }));
  const result = await prepareRadarBrief(
    db,
    { operationId: input.operationId, sources },
    workItemId,
  );
  const draft = "result" in result ? result.result : undefined;
  return {
    ...result,
    bodyText: draft
      ? draft.observations.map((o) => `${o.text} [${o.sourceIds.join(", ")}]`).join("\n\n") +
        "\n\nUnknowns\n" +
        draft.unknowns.map((x) => `- ${x}`).join("\n")
      : null,
    sourceVersionIds: ids,
    sourceTextLimit: 3000,
  };
}
