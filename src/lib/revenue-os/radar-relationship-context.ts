import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantIdForDatabase } from "@/lib/supabase/server";
import { readEntityLinksById, getEntityType } from "./entity-registry";
import { readContactConversationContext } from "./conversations";
import { readContactIdentityReviewState } from "./identity-review";
import { readRadarRelationshipEvidence } from "./radar-relationship-evidence";
import { isModuleEnabled } from "./modules";
import {
  radarRelationshipSchema,
  radarRelationshipReadSchema,
  radarRelationshipEdge,
  radarRelationshipPaths,
  type RadarRelationshipPathInput,
} from "./radar-relationship-contract";

/** Neutral canonical contact context. No people ranking, guessed identities or sending. */
export async function getRadarRelationshipContext(
  db: SupabaseClient,
  raw: unknown,
  now = new Date(),
) {
  const input = radarRelationshipReadSchema.parse(raw),
    tenantId = tenantIdForDatabase(db);
  if (!tenantId) throw new Error("Radar relationship context needs an explicit workspace");
  const tenant = await db.from("tenants").select("status,config").eq("id", tenantId).single();
  if (tenant.error || tenant.data?.status !== "active")
    throw new Error("Relationship workspace unavailable");
  const targetRead = await db
    .from("contacts")
    .select("id,full_name,communication_status,company_id")
    .eq("tenant_id", tenantId)
    .eq("id", input.contactId)
    .single();
  if (targetRead.error || !targetRead.data) throw new Error("Canonical contact unavailable");
  const reads = await Promise.allSettled([
    db
      .from("radar_current_relationships")
      .select(
        "id,link_id,state,assertion,edge_snapshot,evidence_snapshot,valid_from,valid_until,reason,created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("source_id", input.contactId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(input.limit + 1),
    db
      .from("radar_current_relationships")
      .select(
        "id,link_id,state,assertion,edge_snapshot,evidence_snapshot,valid_from,valid_until,reason,created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("target_id", input.contactId)
      .order("created_at", { ascending: false })
      .order("id")
      .limit(input.limit + 1),
    readContactConversationContext(db, input.contactId),
  ] as const);
  const a = reads[0],
    b = reads[1],
    history = reads[2];
  if (
    a.status !== "fulfilled" ||
    b.status !== "fulfilled" ||
    history.status !== "fulfilled" ||
    a.value.error ||
    b.value.error
  )
    throw new Error("Relationship context incomplete; retry before preparing another ask");
  const all = [
    ...new Map(
      [...(a.value.data ?? []), ...(b.value.data ?? [])].map((row) => [row.id, row]),
    ).values(),
  ];
  const rows = all
    .sort(
      (a, b) =>
        String(b.created_at).localeCompare(String(a.created_at)) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, input.limit);
  const truncated =
    all.length > input.limit ||
    (a.value.data?.length ?? 0) > input.limit ||
    (b.value.data?.length ?? 0) > input.limit;
  const declarations = await Promise.allSettled(
    ["contact", "company", "radar_source_version"].map((type) => getEntityType(db, tenantId, type)),
  );
  if (declarations.some((result) => result.status === "rejected"))
    throw new Error("Canonical relationship registry unavailable");
  const usableTypes = new Set(
    ["contact", "company", "radar_source_version"].filter((type, index) => {
      const result = declarations[index];
      const table =
        type === "contact"
          ? "contacts"
          : type === "company"
            ? "companies"
            : "radar_source_versions";
      return (
        result?.status === "fulfilled" &&
        result.value &&
        !result.value.isDisabled &&
        result.value.backingTable === table &&
        result.value.idColumn === "id"
      );
    }),
  );
  const links = await readEntityLinksById(
    db,
    tenantId,
    rows.map((row) => row.link_id),
  );
  const linkMap = new Map(links.map((link) => [link.id, link]));
  const parsed = rows.map((row) => ({
    row,
    assertion: radarRelationshipSchema.parse(row.assertion),
  }));
  const fromIds = [
    ...new Set(
      parsed.flatMap(({ assertion }) =>
        assertion.kind === "introduction_offer" ? [assertion.fromContactId] : [],
      ),
    ),
  ];
  const contactsRead = fromIds.length
    ? await db
        .from("contacts")
        .select("id,full_name,communication_status")
        .eq("tenant_id", tenantId)
        .in("id", fromIds)
        .limit(20)
    : { data: [], error: null };
  if (contactsRead.error) throw new Error("Introducing contact context unavailable");
  const contacts = new Map((contactsRead.data ?? []).map((contact) => [contact.id, contact]));
  const identity = await readContactIdentityReviewState(db, [input.contactId, ...fromIds]);
  const pending = new Set(identity.pendingContactIds);
  const offers: RadarRelationshipPathInput["offers"] = [];
  const publicContactPaths: NonNullable<RadarRelationshipPathInput["publicContactPaths"]> = [];
  const assertions = [];
  const eligible = parsed.filter(({ row, assertion }) => {
    const expected = radarRelationshipEdge(assertion),
      link = linkMap.get(row.link_id);
    return (
      link &&
      usableTypes.has(expected.sourceType) &&
      usableTypes.has(expected.targetType) &&
      Object.entries(expected).every(([key, value]) => link[key as keyof typeof link] === value)
    );
  });
  // Four bounded evidence reads at once, with no unbounded fan-out or provider calls.
  const evidenceReads = new Map<
    string,
    PromiseSettledResult<Awaited<ReturnType<typeof readRadarRelationshipEvidence>>>
  >();
  for (let offset = 0; offset < eligible.length; offset += 4) {
    const batch = eligible.slice(offset, offset + 4);
    const results = await Promise.allSettled(
      batch.map(({ assertion }) => readRadarRelationshipEvidence(db, assertion)),
    );
    for (const [index, result] of results.entries())
      evidenceReads.set(batch[index]!.row.id, result);
  }
  for (const { row, assertion } of parsed) {
    let currentEvidence = false,
      evidenceReason =
        "Canonical link or entity type was removed, changed or disabled; review its current identity";
    const read = evidenceReads.get(row.id);
    if (read?.status === "fulfilled") {
      const cited = read.value,
        old = row.evidence_snapshot as Record<string, unknown>;
      currentEvidence =
        Object.entries(cited.snapshot).every(([key, value]) => old[key] === value) &&
        cited.text.includes(assertion.evidence.quotation);
      evidenceReason = currentEvidence
        ? "Current cited evidence; assertion remains human-reviewed"
        : "Evidence or author identity changed since review";
    } else if (read?.status === "rejected") {
      console.warn("Radar relationship evidence unavailable; current path withheld");
      evidenceReason = "Evidence is unavailable, retracted or its author identity is unresolved";
    }
    assertions.push({ ...row, currentEvidence, evidenceReason });
    if (assertion.kind === "introduction_offer" && assertion.toContactId === input.contactId) {
      const from = contacts.get(assertion.fromContactId);
      offers.push({
        id: row.link_id,
        fromContactId: assertion.fromContactId,
        fromName: String(from?.full_name ?? "Unavailable contact"),
        communicationStatus: String(from?.communication_status ?? "unknown"),
        identityReviewPending: pending.has(assertion.fromContactId) || !from,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        currentEvidence,
        explicitOffer: true,
        revoked: row.state === "revoked",
      });
    }
    if (assertion.kind === "business_contact_path")
      publicContactPaths.push({
        id: row.link_id,
        contactId: assertion.contactId,
        contactUrl: assertion.contactUrl,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        currentEvidence,
        revoked: row.state === "revoked",
      });
  }
  const target = targetRead.data;
  const choices = radarRelationshipPaths(
    {
      target: {
        id: target.id,
        communicationStatus: String(target.communication_status ?? "unknown"),
        identityReviewPending: pending.has(target.id),
      },
      priorConversationCount: history.value.conversations.length,
      historyComplete: history.value.complete && identity.complete && !truncated,
      offers,
      publicContactPaths,
    },
    now,
  );
  const enabled = isModuleEnabled("opportunity-radar", tenant.data.config);
  return {
    contact: target,
    history: history.value,
    assertions,
    ...choices,
    paths: enabled ? choices.paths : [],
    enabled,
    truncated,
    limit: input.limit,
    interpretation:
      "Read the prior messages, earlier asks, current restrictions and exact evidence before preparing a draft. These neutral review paths do not establish consent, commitments, personal relationships or outreach authorization.",
  };
}
