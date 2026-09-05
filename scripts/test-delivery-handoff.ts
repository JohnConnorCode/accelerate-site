import assert from "node:assert/strict";
import {
  createHandoffFromOpportunity,
  createOnboardingTemplateVersion,
  getActiveTemplate,
} from "../src/lib/revenue-os/delivery-handoff";
import { loadOpportunityRecord } from "../src/lib/revenue-os/records";
import { MemorySupabase } from "./lib/memory-supabase";

const TENANT = "tenant-a";
const FOREIGN = "tenant-b";
const ACTOR = "founder@example.com";

function stageSeed(mem: MemorySupabase) {
  const stages = [
    ["new", "New", "open", 10],
    ["contacted", "Contacted", "open", 20],
    ["won", "Won", "won", 100],
    ["lost", "Lost", "lost", 0],
  ] as const;
  mem.tables.kanban_columns = stages.map(([key, label, role, probability], index) => ({
    board_key: "pipeline",
    tenant_id: TENANT,
    column_key: key,
    label,
    sort_order: index,
    metadata: { role, probability },
  }));
}

function crmSeed(mem: MemorySupabase) {
  mem.tables.contacts = [
    { id: "c1", tenant_id: TENANT, full_name: "Ana Owner", primary_email: "ana@example.com" },
  ];
  mem.tables.companies = [{ id: "co1", tenant_id: TENANT, name: "Acme Co" }];
  mem.tables.opportunities = [
    {
      id: "o-won",
      tenant_id: TENANT,
      stage: "won",
      name: "Acme rollout",
      estimated_value: 12000,
      contact_id: "c1",
      company_id: "co1",
      email: "ana@example.com",
    },
    {
      id: "o-open",
      tenant_id: TENANT,
      stage: "qualified",
      name: "Beta trial",
      estimated_value: 3000,
      contact_id: "c1",
      company_id: "co1",
      email: "ana@example.com",
    },
  ];
}

async function main() {
  const mem = new MemorySupabase({
    onboarding_templates: [],
    clients: [],
    tasks: [],
    audit_log: [],
    activities: [],
  });
  stageSeed(mem);
  crmSeed(mem);
  const db = mem.client as never;

  // 1. Non-won opportunities refuse; missing ones fail closed.
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-open",
        actorEmail: ACTOR,
      }),
    /won/,
    "handoff requires a canonically won stage",
  );
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-missing",
        actorEmail: ACTOR,
      }),
    /not found/,
  );
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: FOREIGN,
        opportunityId: "o-won",
        actorEmail: ACTOR,
      }),
    /not found/,
    "cross-tenant opportunities must not resolve",
  );

  // 2. Full handoff: one client, three commitments, receipt, no second identity.
  const first = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won",
    actorEmail: ACTOR,
  });
  assert.equal(first.created, true);
  assert.equal(first.client.business_name, "Acme Co");
  assert.equal(first.client.contact_email, "ana@example.com");
  assert.equal(first.milestones.length, 3);
  assert.equal(first.remainder.length, 0);
  assert.equal(first.replayed, false);
  assert.equal(first.receipt.template_key, "default");
  assert.equal(
    mem.rows("tasks").filter((r) => String(r.dedupe_key ?? "").startsWith("handoff:")).length,
    3,
    "one deduplicated task per milestone",
  );
  assert.ok(
    mem.rows("audit_log").some((r) => r.action === "engagement.handed_off"),
    "handoff must leave an audit receipt",
  );
  assert.ok(
    mem.rows("activities").some((r) => r.activity_type === "engagement_handoff"),
    "handoff must leave an activity receipt",
  );

  // 3. Replay: same engagement, nothing duplicated, reported honestly.
  const replay = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won",
    actorEmail: ACTOR,
  });
  assert.equal(replay.created, false);
  assert.equal(replay.client.id, first.client.id, "replay returns the same engagement");
  assert.equal(replay.replayed, true);
  assert.equal(
    mem.rows("clients").filter((r) => r.opportunity_id === "o-won").length,
    1,
    "no second identity on replay",
  );
  assert.equal(
    mem.rows("tasks").filter((r) => String(r.dedupe_key ?? "").startsWith("handoff:")).length,
    3,
    "no duplicate commitments on replay",
  );

  // 4. Partial handoff preserves completed work and names the remainder.
  mem.tables.opportunities!.push({
    id: "o-won-2",
    tenant_id: TENANT,
    stage: "won",
    name: "Beta rollout",
    estimated_value: 5000,
    contact_id: "c1",
    company_id: "co1",
    email: "ana@example.com",
  });
  const partial = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won-2",
    actorEmail: ACTOR,
    milestoneKeys: ["kickoff"],
  });
  assert.deepEqual(partial.remainder.sort(), ["access", "first-win"]);
  assert.equal(partial.milestones.length, 1);
  const resumed = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won-2",
    actorEmail: ACTOR,
  });
  assert.equal(resumed.remainder.length, 0, "replay fills exactly the remainder");
  assert.equal(resumed.replayed, false, "new work means it is not a pure replay");
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-won-2",
        actorEmail: ACTOR,
        milestoneKeys: ["not-a-milestone"],
      }),
    /Unknown milestone keys/,
  );

  // 5. Template versions supersede without mutating history.
  const v2 = await createOnboardingTemplateVersion(db, {
    tenantId: TENANT,
    milestones: [{ key: "kickoff", title: "Kickoff call" }],
    actorEmail: ACTOR,
  });
  assert.equal(v2.version, 2);
  assert.equal(
    mem.rows("onboarding_templates").filter((r) => r.active).length,
    1,
    "exactly one active version per key",
  );
  const active = await getActiveTemplate(db, TENANT);
  assert.equal(active.version, 2);
  assert.equal(active.milestones.length, 1);

  // 6. The record workspace exposes engagement status, next milestone,
  // and blockers without a second fetch path.
  const withEngagement = await loadOpportunityRecord(db, "o-won");
  assert.ok(withEngagement?.engagement, "handed-off record carries its engagement");
  assert.equal(withEngagement?.engagement?.business_name, "Acme Co");
  assert.equal(withEngagement?.engagement?.next_milestone?.key, "kickoff");
  assert.deepEqual(withEngagement?.engagement?.blockers, []);
  const withoutEngagement = await loadOpportunityRecord(db, "o-open");
  assert.equal(withoutEngagement?.engagement, null, "unhanded record stands alone");

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "won-gate",
        "full-handoff",
        "idempotent-replay",
        "partial-remainder",
        "template-versioning",
        "record-exposure",
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
