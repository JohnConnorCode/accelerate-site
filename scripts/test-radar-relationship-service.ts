import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  previewRadarRelationship,
  proposeRadarRelationship,
  executeRadarRelationship,
} from "../src/lib/revenue-os/radar-relationships";
import { getRadarRelationshipContext } from "../src/lib/revenue-os/radar-relationship-context";
import { radarRelationshipEdge } from "../src/lib/revenue-os/radar-relationship-contract";
async function main() {
  const tenant = randomUUID(),
    from = randomUUID(),
    target = randomUUID(),
    message = randomUUID(),
    conversation = randomUUID(),
    link = randomUUID(),
    review = randomUUID();
  const body = "I can introduce you to the workshop coordinator.";
  const change = {
    operation: "review" as const,
    operationId: randomUUID(),
    expectedReviewId: null,
    relationship: {
      kind: "introduction_offer" as const,
      fromContactId: from,
      toContactId: target,
      offer: "Introduce the coordinator",
      evidence: { kind: "message" as const, messageId: message, quotation: body },
    },
    validFrom: new Date(Date.now() - 1000).toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    reason: "Confirm the exact offer and canonical target",
  };
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, status: "active", config: { modules: { "opportunity-radar": true } } }],
    contacts: [from, target].map((id, i) => ({
      id,
      tenant_id: tenant,
      full_name: "Same Name",
      primary_email: i ? "coordinator@example.test" : "sender@example.test",
      alternate_emails: [],
      communication_status: "active",
    })),
    conversations: [
      {
        id: conversation,
        tenant_id: tenant,
        contact_id: from,
        subject: "Workshop",
        status: "open",
      },
    ],
    message_evidence_context: [
      {
        id: message,
        tenant_id: tenant,
        conversation_id: conversation,
        direction: "inbound",
        sender_email: "sender@example.test",
        status: "received",
        body_excerpt: body,
        body_hash: createHash("sha256").update(body).digest("hex"),
        created_at: new Date().toISOString(),
      },
    ],
    entity_types: ["contact", "company"].map((type) => ({
      id: randomUUID(),
      tenant_id: tenant,
      type_key: type,
      backing_table: type === "contact" ? "contacts" : "companies",
      id_column: "id",
      is_disabled: false,
    })),
    radar_current_relationships: [],
    radar_relationship_reviews: [],
    entity_links: [],
    action_queue: [],
    audit_log: [],
  });
  const db = bindTenantDatabase(mem.client, tenant, true);
  const p = await previewRadarRelationship(db, change);
  assert.equal(p.requiresHumanApproval, true);
  assert.equal(mem.tables.radar_relationship_reviews!.length, 0);
  await assert.rejects(
    () =>
      previewRadarRelationship(db, {
        ...change,
        relationship: { ...change.relationship, fromContactId: target },
      }),
    /distinct|conversation/,
  );
  await assert.rejects(
    () => proposeRadarRelationship(db, { change, digest: "a".repeat(64) }, "owner@example.test"),
    /changed/,
  );
  const queued = await proposeRadarRelationship(
    db,
    { change, digest: p.digest },
    "owner@example.test",
  );
  assert.ok(queued.id);
  assert.equal(mem.tables.radar_relationship_reviews!.length, 0);
  const payload = mem.tables.action_queue![0]!.payload;
  mem.rpc("review_radar_relationship", () => ({ replayed: false, review: { id: review } }));
  assert.equal(
    (await executeRadarRelationship(db, payload, "owner@example.test")).review.id,
    review,
  );
  mem.tables.message_evidence_context![0]!.body_hash = "b".repeat(64);
  await assert.rejects(
    () => executeRadarRelationship(db, payload, "owner@example.test"),
    /changed/,
  );
  mem.tables.message_evidence_context![0]!.body_hash = p.evidence.contentHash;
  const edge = radarRelationshipEdge(change.relationship);
  mem.tables.entity_links!.push({
    id: link,
    tenant_id: tenant,
    source_type: edge.sourceType,
    source_id: edge.sourceId,
    target_type: edge.targetType,
    target_id: edge.targetId,
    link_type: edge.linkType,
    metadata: {},
  });
  mem.tables.radar_current_relationships!.push({
    id: review,
    tenant_id: tenant,
    link_id: link,
    source_id: from,
    target_id: target,
    state: "reviewed",
    assertion: change.relationship,
    edge_snapshot: edge,
    evidence_snapshot: p.evidence,
    valid_from: change.validFrom,
    valid_until: change.validUntil,
    reason: change.reason,
    created_at: new Date().toISOString(),
  });
  let context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.paths[0]?.kind, "introduction_offer");
  assert.equal(context.outreachPermission, false);
  mem.tables.entity_types![0]!.is_disabled = true;
  context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.paths.length, 0);
  await assert.rejects(
    () => previewRadarRelationship(db, { ...change, expectedReviewId: review }),
    /disabled or conflicting/,
  );
  mem.tables.entity_types![0]!.is_disabled = false;
  mem.tables.contacts![1]!.communication_status = "unsubscribed";
  context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.paths.length, 0);
  mem.tables.contacts![1]!.communication_status = "active";
  mem.tables.action_queue!.push({
    id: randomUUID(),
    tenant_id: tenant,
    action_type: "identity_review",
    status: "pending",
    payload: { participant_email: "coordinator@example.test", candidates: [] },
  });
  context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.paths.length, 0);
  mem.tables.action_queue!.pop();
  mem.tables.entity_links = [];
  context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.paths.length, 0);
  assert.equal(context.assertions.length, 1);
  const revoke = {
    operation: "revoke",
    operationId: randomUUID(),
    relationshipId: link,
    expectedReviewId: review,
    reason: "Withdraw prior review",
  };
  assert.equal(
    (await previewRadarRelationship(db, revoke)).change.operation,
    "revoke",
    "Missing canonical link does not prevent revocation",
  );
  await assert.rejects(
    () =>
      getRadarRelationshipContext(bindTenantDatabase(mem.client, randomUUID(), true), {
        contactId: target,
      }),
    /workspace/,
  );
  mem.tables.tenants![0]!.config = { modules: { "opportunity-radar": false } };
  context = await getRadarRelationshipContext(db, { contactId: target });
  assert.equal(context.enabled, false);
  assert.equal(context.paths.length, 0);
  assert.equal(context.assertions.length, 1);
  await assert.rejects(() => previewRadarRelationship(db, revoke), /disabled/);
  console.log(
    "PASS: exact sourced preview/proposal, stale execution refusal, canonical offers, suppression, unresolved identity, merged edge history, revocation and cross-tenant/disabled reads.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
