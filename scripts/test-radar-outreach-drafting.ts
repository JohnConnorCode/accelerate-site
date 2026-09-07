import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import { seedRadar } from "../src/lib/admin/demo/radar-fixtures";
import { prepareRadarOutreachDraft } from "../src/lib/revenue-os/radar-outreach-drafting";
import { readRadarIntroductionConsents } from "../src/lib/revenue-os/radar-outreach-context";
async function main() {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("No provider request is allowed");
  };
  try {
    for (const name of ["superdebate", "northline-roofing"] as const) {
      const tenant = randomUUID(),
        seed = seedRadar(DEMO_SCENARIOS[name]),
        owned = (v: object) => ({ ...v, tenant_id: tenant });
      const mem = new AuthorizedMemorySupabase({
        tenants: [
          { id: tenant, status: "active", config: { modules: { "opportunity-radar": true } } },
        ],
        radar_sources: seed.sources.map((v) =>
          owned({ id: v.source_id, canonical_url: v.canonicalUrl }),
        ),
        radar_source_versions: seed.sources.map(owned),
        radar_opportunities: seed.opportunities.map(owned),
        radar_evidence_links: seed.opportunities.flatMap((o) =>
          seed.citations[o.id]!.flatMap((c) =>
            c.links.map((l) =>
              owned({ ...l, opportunity_id: o.id, opportunity_revision: c.revision }),
            ),
          ),
        ),
        contacts: DEMO_SCENARIOS[name].people.map((p, i) =>
          owned({
            id: p.id,
            full_name: p.name,
            primary_email: `person${i}@example.test`,
            alternate_emails: [],
            communication_status: "active",
          }),
        ),
        radar_current_relationships: [],
        entity_types: [],
        entity_links: [],
        conversations: [],
        message_evidence_context: [],
        claims: [],
      });
      const db = bindTenantDatabase(mem.client, tenant, true),
        opportunity = seed.opportunities[0]!;
      const request = {
        operationId: randomUUID(),
        opportunityId: opportunity.id,
        expectedRevision: opportunity.revision,
        purpose: "partnership",
        sourceVersionIds: [seed.sources[0]!.id],
        usefulContribution: "We can contribute a practical workshop outline.",
        exactAsk: "Would you like to review the outline?",
      };
      const prepared = await prepareRadarOutreachDraft(db, request);
      assert.equal(prepared.saved, false);
      assert.equal(prepared.sendingAuthorized, false);
      assert.equal(prepared.generation, null);
      assert.equal(prepared.saveChange.kind, "outreach_draft");
      assert.equal(prepared.quality.blockers.length, 0);
      assert.equal(
        (await prepareRadarOutreachDraft(db, { ...request, useModel: true })).generation?.status,
        "deferred",
      );
      await assert.rejects(
        prepareRadarOutreachDraft(db, { ...request, expectedRevision: 100 }),
        /changed/,
      );
      await assert.rejects(
        prepareRadarOutreachDraft(db, { ...request, sourceVersionIds: [randomUUID()] }),
        /linked/,
      );
      await assert.rejects(
        prepareRadarOutreachDraft(db, { ...request, approvedClaimIds: [randomUUID()] }),
        /approved fact/,
      );
      const people = mem.tables.contacts!;
      const participants = people.slice(0, 2).map((p) => {
        assert.equal(typeof p.id, "string");
        assert.equal(typeof p.primary_email, "string");
        return { contact_id: p.id as string, email: p.primary_email as string, outcome: "linked" };
      });
      const conversation = randomUUID();
      mem.tables.conversations!.push(
        owned({
          id: conversation,
          contact_id: participants[0]!.contact_id,
          subject: "Specific introduction",
          metadata: {
            association: { contract: "revenue-os-conversation-association.v1", participants },
          },
        }),
      );
      const consents = participants.map((p) => {
        const messageId = randomUUID(),
          quotation = "Yes, please introduce me to the other workshop participant.";
        mem.tables.message_evidence_context!.push(
          owned({
            id: messageId,
            conversation_id: conversation,
            direction: "inbound",
            status: "received",
            sender_email: p.email,
            body_excerpt: quotation,
            body_hash: createHash("sha256").update(quotation).digest("hex"),
            created_at: new Date().toISOString(),
          }),
        );
        return {
          contactId: p.contact_id,
          messageId,
          quotation,
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        };
      });
      const ids: [string, string] = [participants[0]!.contact_id, participants[1]!.contact_id];
      assert.equal(
        (await readRadarIntroductionConsents(db, ids, consents)).requiresHumanMeaningReview,
        true,
      );
      await assert.rejects(
        readRadarIntroductionConsents(db, ids, [consents[0], consents[0]]),
        /Both exact/,
      );
      await assert.rejects(
        readRadarIntroductionConsents(
          db,
          ids,
          consents.map((c) => ({ ...c, quotation: "An invented agreement" })),
        ),
        /does not match/,
      );
      await assert.rejects(
        readRadarIntroductionConsents(
          db,
          ids,
          consents.map((c) => ({ ...c, validUntil: "2020-01-01T00:00:00.000Z" })),
        ),
        /current/,
      );
      mem.tables.contacts![0]!.communication_status = "suppressed";
      await assert.rejects(prepareRadarOutreachDraft(db, request), /suppressed/);
      console.log(
        `${name}: canonical context, provider-free drafting, budget-off deferral, stale/missing facts, two-party source consent and suppression passed`,
      );
    }
  } finally {
    globalThis.fetch = original;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
