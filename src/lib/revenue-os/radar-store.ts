import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { callRadarStoreRpc, tenantIdForDatabase } from "@/lib/supabase/server";
import { isModuleEnabled } from "./modules";
import { proposeAction } from "./actions";
import { getEntityType, registerEntityType } from "./entity-registry";
import {
  RADAR_TRANSITIONS,
  radarStoreChangeSchema,
  radarStorePreviewSchema,
  radarStoreProposalSchema,
  radarStoreReadSchema,
  type RadarStoreChange,
} from "./radar-store-contract";

const radarEntityTypes = [
  {
    typeKey: "radar_source_version",
    label: "Radar source version",
    backingTable: "radar_source_versions",
    readableColumns: ["source_id", "version", "title", "verification", "revision", "created_at"],
  },
  {
    typeKey: "radar_opportunity",
    label: "Radar growth opportunity",
    backingTable: "radar_opportunities",
    readableColumns: [
      "title",
      "kind",
      "state",
      "review_lane",
      "contact_id",
      "company_id",
      "revision",
      "updated_at",
    ],
  },
  {
    typeKey: "radar_asset",
    label: "Radar draft asset",
    backingTable: "radar_assets",
    readableColumns: ["opportunity_id", "kind", "title", "state", "created_at"],
  },
  {
    typeKey: "radar_outcome",
    label: "Radar reported outcome",
    backingTable: "radar_outcomes",
    readableColumns: ["opportunity_id", "kind", "verification", "source_version_id", "created_at"],
  },
] as const;
async function ensureEntityTypes(db: SupabaseClient, tenantId: string) {
  const results = await Promise.allSettled(
    radarEntityTypes.map((type) => getEntityType(db, tenantId, type.typeKey)),
  );
  for (let index = 0; index < results.length; index++) {
    const result = results[index]!;
    const type = radarEntityTypes[index]!;
    if (result.status === "rejected") throw new Error("Radar entity registry is unavailable");
    if (
      result.value &&
      (result.value.backingTable !== type.backingTable || result.value.isDisabled)
    )
      throw new Error("Radar entity declaration is conflicting or disabled");
  }
  for (let index = 0; index < results.length; index++) {
    const result = results[index]!;
    const type = radarEntityTypes[index]!;
    if (result.status === "fulfilled" && !result.value)
      await registerEntityType(db, {
        ...type,
        tenantId,
        readableColumns: [...type.readableColumns],
      });
  }
}

const opportunityColumns =
  "id,title,summary,recommended_action,kind,state,review_lane,contact_id,company_id,revision,evidence_revision,created_at,updated_at";
const versionColumns =
  "id,source_id,version,version_hash,content_hash,title,author,published_at,verification,verification_note,revision,created_at";
const receiptColumns =
  "id,operation_key,operation,entity_id,before_state,after_state,actor_email,created_at";
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}
function normalizeChange(change: RadarStoreChange): RadarStoreChange {
  if (change.operation !== "ingest_source") return change;
  const url = new URL(change.url);
  url.hash = "";
  // Preserve query identity and order; campaign stripping could merge different documents.
  return { ...change, url: url.toString(), publishedAt: change.publishedAt ?? null };
}
async function configuration(db: SupabaseClient, requireEnabled = true) {
  const tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Radar store requires a tenant-bound database");
  const { data, error } = await db
    .from("tenants")
    .select("config,status")
    .eq("id", tenantId)
    .single();
  if (error || data?.status !== "active") throw new Error("Radar workspace is unavailable");
  if (requireEnabled && !isModuleEnabled("opportunity-radar", data.config))
    throw new Error("Radar is disabled");
  return { tenantId, config: data.config as Record<string, unknown> };
}
async function opportunity(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("radar_opportunities")
    .select(opportunityColumns)
    .eq("tenant_id", tenantIdForDatabase(db)!)
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Radar opportunity unavailable");
  return data;
}
async function sourceVersions(db: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) return [];
  if (unique.length > 20) throw new Error("Radar context exceeds twenty source versions");
  const { data, error } = await db
    .from("radar_source_versions")
    .select(versionColumns)
    .eq("tenant_id", tenantIdForDatabase(db)!)
    .in("id", unique)
    .order("id")
    .limit(20);
  if (error || data?.length !== unique.length)
    throw new Error("A source version is missing or belongs to another workspace");
  return data;
}
async function currentLinks(db: SupabaseClient, opp: { id: string; evidence_revision: number }) {
  const { data, error } = await db
    .from("radar_evidence_links")
    .select("id,source_version_id,evidence_id,observation,opportunity_revision")
    .eq("tenant_id", tenantIdForDatabase(db)!)
    .eq("opportunity_id", opp.id)
    .eq("opportunity_revision", opp.evidence_revision)
    .order("id")
    .limit(11);
  if (error || !data?.length || data.length > 10)
    throw new Error("Opportunity citations are unavailable or exceed their bound");
  return data;
}
const snapshotSchema = z
  .object({
    id: z.uuid(),
    revision: z.number().int().positive(),
    verification: z.enum(["supplied", "verified", "retracted"]),
  })
  .strict();
const payloadSchema = z
  .object({
    version: z.literal(1),
    tenantId: z.uuid(),
    operationId: z.uuid(),
    change: radarStoreChangeSchema,
    configRevision: z.string().regex(/^[a-f0-9]{64}$/),
    sources: z.array(snapshotSchema).max(20),
    before: z.record(z.string(), z.unknown()).nullable(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export async function previewRadarStoreChange(db: SupabaseClient, raw: unknown) {
  const input = radarStorePreviewSchema.parse(raw);
  const change = normalizeChange(input.change);
  const { tenantId, config } = await configuration(db);
  let before: Record<string, unknown> | null = null;
  const sourceIds: string[] = [];
  if ("opportunityId" in change) {
    const opp = await opportunity(db, change.opportunityId);
    if (opp.revision !== change.expectedRevision)
      throw new Error("Stale opportunity revision; read current state first");
    before = opp;
    const links = await currentLinks(db, opp);
    sourceIds.push(...links.map((link) => link.source_version_id));
    if (
      change.operation === "transition_opportunity" &&
      !RADAR_TRANSITIONS[opp.state as keyof typeof RADAR_TRANSITIONS]?.includes(change.state)
    )
      throw new Error("Invalid Radar lifecycle transition");
    if (
      ["update_opportunity", "replace_citations"].includes(change.operation) &&
      ["completed", "dismissed", "declined"].includes(opp.state)
    )
      throw new Error("Terminal opportunity is retained as history");
    if (
      change.operation === "add_asset" &&
      change.sourceVersionIds.some((id) => !sourceIds.includes(id))
    )
      throw new Error("Asset must cite current opportunity evidence");
  }
  if ("citations" in change) {
    sourceIds.push(...change.citations.map((citation) => citation.sourceVersionId));
    const evidenceIds = [
      ...new Set(
        change.citations.flatMap((citation) => (citation.evidenceId ? [citation.evidenceId] : [])),
      ),
    ];
    if (evidenceIds.length) {
      const result = await db
        .from("evidence")
        .select("id,claim_id")
        .eq("tenant_id", tenantId)
        .in("id", evidenceIds)
        .limit(10);
      if (result.error || result.data?.length !== evidenceIds.length)
        throw new Error("Canonical evidence is missing or belongs to another workspace");
    }
  }
  if ("sourceVersionId" in change) sourceIds.push(change.sourceVersionId);
  const versions = await sourceVersions(db, sourceIds);
  if (change.operation === "review_source") {
    before = versions[0]!;
    if (before.revision !== change.expectedRevision)
      throw new Error("Stale source revision; read current state first");
  } else if (versions.some((version) => version.verification === "retracted")) {
    // Citation replacement must be able to repair an opportunity with old retracted evidence.
    const replacementIds =
      "citations" in change ? change.citations.map((citation) => citation.sourceVersionId) : [];
    if (
      (change.operation !== "replace_citations" &&
        !(
          change.operation === "transition_opportunity" &&
          ["draft", "needs_review", "dismissed", "declined", "no_response"].includes(change.state)
        )) ||
      versions.some(
        (version) => replacementIds.includes(version.id) && version.verification === "retracted",
      )
    )
      throw new Error("Retracted sources require a reviewed citation replacement");
  }
  if (
    change.operation === "transition_opportunity" &&
    ["approved", "in_progress", "completed"].includes(change.state) &&
    versions.some((version) => version.verification !== "verified")
  )
    throw new Error("Review every source before advancing this opportunity");
  const fields: { contactId?: string | null; companyId?: string | null } =
    change.operation === "create_opportunity"
      ? change
      : change.operation === "update_opportunity"
        ? change.patch
        : {};
  for (const [key, table] of [
    ["contactId", "contacts"],
    ["companyId", "companies"],
  ] as const) {
    const id = fields[key];
    if (!id) continue;
    const result = await db
      .from(table)
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (result.error || !result.data)
      throw new Error("Canonical CRM reference is unavailable in this workspace");
  }
  const facts = {
    version: 1 as const,
    tenantId,
    operationId: input.operationId,
    change,
    configRevision: digest(config),
    sources: versions.map((version) => ({
      id: version.id,
      revision: version.revision,
      verification: version.verification,
    })),
    before,
  };
  return {
    ...facts,
    digest: digest(facts),
    requiresHumanApproval: true,
    consequences:
      "Save the exact source, draft, review or reported outcome shown. This does not fetch sources, rank public affairs, send, publish, verify independent recognition or approve external actions.",
  };
}

export async function proposeRadarStoreChange(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const input = radarStoreProposalSchema.parse(raw);
  const preview = await previewRadarStoreChange(db, {
    operationId: input.operationId,
    change: input.change,
  });
  if (preview.digest !== input.digest)
    throw new Error("Radar preview changed; review it again before proposing");
  const { requiresHumanApproval: _approval, consequences, ...payload } = preview;
  void _approval;
  return proposeAction(db, {
    actionType: "update_radar_store",
    title: `Radar ${preview.change.operation.replaceAll("_", " ")}: ${("title" in preview.change ? preview.change.title : String(preview.before?.title ?? "record")).slice(0, 120)}`,
    description: consequences,
    payload,
    sourceContext: "admin_ai",
    entityType: "radar_opportunity",
    ...("opportunityId" in preview.change ? { entityId: preview.change.opportunityId } : {}),
    dedupeKey: `radar-store:${preview.tenantId}:${preview.operationId}:${preview.digest}`,
    proposedBy: actorEmail,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
}

export async function executeRadarStoreChange(
  db: SupabaseClient,
  raw: unknown,
  actorEmail: string,
) {
  const payload = payloadSchema.parse(raw);
  const { digest: expectedDigest, ...facts } = payload;
  if (payload.tenantId !== tenantIdForDatabase(db) || digest(facts) !== expectedDigest)
    throw new Error("Radar approval does not match its tenant and exact preview");
  const prior = await db
    .from("radar_store_receipts")
    .select("id")
    .eq("tenant_id", payload.tenantId)
    .eq("operation_key", payload.operationId)
    .maybeSingle();
  if (prior.error) throw new Error("Radar receipt storage unavailable; verify the migration");
  if (!prior.data) {
    const fresh = await previewRadarStoreChange(db, {
      operationId: payload.operationId,
      change: payload.change,
    });
    if (fresh.digest !== expectedDigest)
      throw new Error("Radar facts changed; preview and approve again");
  }
  const { config } = await configuration(db, !prior.data);
  if (!prior.data) {
    if (digest(config) !== payload.configRevision)
      throw new Error("Radar configuration changed before dispatch");
    await ensureEntityTypes(db, payload.tenantId);
  }
  const result = await callRadarStoreRpc(db, {
    p_operation_key: payload.operationId,
    p_change: payload.change,
    p_expected_config: config,
    p_expected_sources: payload.sources,
    p_actor_email: actorEmail,
  });
  if (result.error) throw new Error(`Radar command refused: ${result.error.message}`);
  const receipt = result.data as {
    replayed: boolean;
    receipt: {
      id: string;
      operation: string;
      entity_id: string;
      after_state: Record<string, unknown>;
    };
  };
  return receipt;
}

export async function readRadarStore(db: SupabaseClient, raw: unknown) {
  const input = radarStoreReadSchema.parse(raw);
  const { tenantId } = await configuration(db, false);
  if (input.operationId) {
    const result = await db
      .from("radar_store_receipts")
      .select(receiptColumns)
      .eq("tenant_id", tenantId)
      .eq("operation_key", input.operationId)
      .maybeSingle();
    if (result.error) throw new Error("Radar receipts unavailable");
    return { receipt: result.data ?? null, externalEffects: false };
  }
  if (input.sourceVersionId || input.assetId) {
    const source = Boolean(input.sourceVersionId);
    const result = await db
      .from(source ? "radar_source_versions" : "radar_assets")
      .select(
        source
          ? `${versionColumns},body_text`
          : "id,opportunity_id,kind,title,state,body_text,created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("id", input.sourceVersionId ?? input.assetId!)
      .single();
    if (result.error || !result.data) throw new Error("Radar source or asset unavailable");
    const { body_text: body, ...metadata } = result.data;
    const characters = Array.from(String(body));
    const end = Math.min(characters.length, input.offset + 2000);
    const sourceIds = source
      ? [metadata.id]
      : await db
          .from("radar_asset_sources")
          .select("source_version_id")
          .eq("tenant_id", tenantId)
          .eq("asset_id", metadata.id)
          .limit(11);
    let versions;
    if (Array.isArray(sourceIds)) versions = await sourceVersions(db, sourceIds);
    else {
      if (sourceIds.error || !sourceIds.data?.length || sourceIds.data.length > 10)
        throw new Error("Asset evidence is incomplete");
      versions = await sourceVersions(
        db,
        sourceIds.data.map((row) => row.source_version_id),
      );
    }
    const sources = await db
      .from("radar_sources")
      .select("id,canonical_url")
      .eq("tenant_id", tenantId)
      .in(
        "id",
        versions.map((version) => version.source_id),
      )
      .limit(20);
    if (sources.error) throw new Error("Source reference unavailable");
    return {
      record: metadata,
      text: characters.slice(input.offset, end).join(""),
      offset: input.offset,
      nextOffset: end < characters.length ? end : null,
      truncated: end < characters.length,
      sourceVersions: versions,
      sources: sources.data,
      externalEffects: false,
    };
  }
  if (input.opportunityId) {
    const opp = await opportunity(db, input.opportunityId);
    const links = await currentLinks(db, opp);
    const versions = await sourceVersions(
      db,
      links.map((link) => link.source_version_id),
    );
    const results = await Promise.all([
      db
        .from("radar_sources")
        .select("id,canonical_url")
        .eq("tenant_id", tenantId)
        .in(
          "id",
          versions.map((version) => version.source_id),
        )
        .limit(20),
      db
        .from("radar_assets")
        .select("id,kind,title,state,created_at")
        .eq("tenant_id", tenantId)
        .eq("opportunity_id", opp.id)
        .order("created_at", { ascending: false })
        .limit(input.limit + 1),
      db
        .from("radar_outcomes")
        .select("id,kind,description,source_version_id,verification,created_at")
        .eq("tenant_id", tenantId)
        .eq("opportunity_id", opp.id)
        .order("created_at", { ascending: false })
        .limit(input.limit + 1),
      db
        .from("radar_store_receipts")
        .select(receiptColumns)
        .eq("tenant_id", tenantId)
        .eq("entity_id", opp.id)
        .order("created_at", { ascending: false })
        .limit(input.limit + 1),
    ]);
    if (results.some((result) => result.error))
      throw new Error("Radar context is incomplete; no partial packet was returned");
    return {
      opportunity: opp,
      citations: links,
      sourceVersions: versions,
      sources: results[0]!.data,
      assets: results[1]!.data!.slice(0, input.limit),
      outcomes: results[2]!.data!.slice(0, input.limit),
      history: results[3]!.data!.slice(0, input.limit),
      truncated: results.slice(1).some((result) => result.data!.length > input.limit),
      externalEffects: false,
    };
  }
  const results = await Promise.all([
    db
      .from("radar_opportunities")
      .select(opportunityColumns)
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(input.limit + 1),
    db
      .from("radar_source_versions")
      .select(versionColumns)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(input.limit + 1),
  ]);
  if (results.some((result) => result.error))
    throw new Error("Radar store unavailable; verify the migration");
  return {
    opportunities: results[0]!.data!.slice(0, input.limit),
    sourceVersions: results[1]!.data!.slice(0, input.limit),
    truncated: results.some((result) => result.data!.length > input.limit),
    externalEffects: false,
  };
}
