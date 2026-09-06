import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { readRadarRelationshipEvidence } from "../src/lib/revenue-os/radar-relationship-evidence";
import type { RadarRelationship } from "../src/lib/revenue-os/radar-relationship-contract";
async function main() {
  const tenant = randomUUID(),
    foreign = randomUUID(),
    from = randomUUID(),
    to = randomUUID(),
    message = randomUUID(),
    conversation = randomUUID(),
    version = randomUUID(),
    source = randomUUID();
  const body = "I can introduce you to the workshop coordinator.";
  const hash = createHash("sha256").update(body).digest("hex");
  const mem = new AuthorizedMemorySupabase({
    contacts: [
      {
        id: from,
        tenant_id: tenant,
        full_name: "Sam Example",
        primary_email: "sam@example.test",
        alternate_emails: [],
      },
      {
        id: to,
        tenant_id: tenant,
        full_name: "Sam Example",
        primary_email: "coordinator@example.test",
        alternate_emails: [],
      },
    ],
    conversations: [
      { id: conversation, tenant_id: tenant, contact_id: from, subject: "Workshop introduction" },
    ],
    message_evidence_context: [
      {
        id: message,
        tenant_id: tenant,
        conversation_id: conversation,
        direction: "inbound",
        sender_email: "sam@example.test",
        status: "received",
        body_excerpt: body,
        body_hash: hash,
        created_at: new Date().toISOString(),
      },
    ],
    radar_source_versions: [
      {
        id: version,
        tenant_id: tenant,
        source_id: source,
        title: "Workshop article",
        body_text: body,
        content_hash: hash,
        revision: 1,
        verification: "verified",
      },
    ],
    radar_sources: [
      { id: source, tenant_id: tenant, canonical_url: "https://example.test/workshop" },
    ],
  });
  const db = bindTenantDatabase(mem.client, tenant, true);
  const offer: RadarRelationship = {
    kind: "introduction_offer",
    fromContactId: from,
    toContactId: to,
    offer: "Introduce the workshop coordinator",
    evidence: { kind: "message", messageId: message, quotation: body },
  };
  const evidence = await readRadarRelationshipEvidence(db, offer);
  assert.equal(evidence.snapshot.contactId, from);
  assert.equal(evidence.conversationId, conversation);
  await assert.rejects(
    () => readRadarRelationshipEvidence(db, { ...offer, fromContactId: to }),
    /linked to the canonical contact/,
    "Same names never authorize a different canonical ID",
  );
  await assert.rejects(
    () => readRadarRelationshipEvidence(bindTenantDatabase(mem.client, foreign, true), offer),
    /unavailable/,
  );
  mem.tables.contacts!.push({
    id: randomUUID(),
    tenant_id: tenant,
    full_name: "Another person",
    primary_email: "sam@example.test",
    alternate_emails: [],
  });
  await assert.rejects(
    () => readRadarRelationshipEvidence(db, offer),
    /Ambiguous contact identity/,
  );
  mem.tables.contacts!.pop();
  mem.tables.message_evidence_context![0]!.direction = "outbound";
  await assert.rejects(() => readRadarRelationshipEvidence(db, offer), /received inbound/);
  const authored: RadarRelationship = {
    kind: "authorship",
    contactId: from,
    sourceVersionId: version,
    evidence: { kind: "source", sourceVersionId: version, quotation: body },
  };
  assert.equal((await readRadarRelationshipEvidence(db, authored)).snapshot.revision, 1);
  mem.tables.radar_source_versions![0]!.verification = "retracted";
  await assert.rejects(() => readRadarRelationshipEvidence(db, authored), /Review the source/);
  console.log(
    "PASS: bounded source/message references, same-name identity refusal, duplicate sender identity, inbound-only offers, source retraction and tenant isolation.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
