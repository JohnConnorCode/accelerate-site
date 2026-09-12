import assert from "node:assert/strict";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import {
  createHandoffFromOpportunity,
  createOnboardingTemplateVersion,
  getActiveTemplate,
} from "../src/lib/revenue-os/delivery-handoff";
import { loadOpportunityRecord } from "../src/lib/revenue-os/records";
import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";

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
  mem.tables.proposals = [
    {
      id: "prop-acme",
      tenant_id: TENANT,
      opportunity_id: "o-won",
      title: "Acme rollout proposal",
      version: 2,
      status: "accepted",
    },
    {
      id: "prop-other",
      tenant_id: TENANT,
      opportunity_id: "o-open",
      title: "Beta proposal",
      version: 1,
      status: "draft",
    },
  ];
}

async function main() {
  const mem = new MemorySupabase({
    tenants: [{ id: TENANT, status: "active", config: { modules: { clients: true } } }],
    onboarding_templates: [],
    clients: [],
    tasks: [],
    audit_log: [],
    activities: [],
  });
  stageSeed(mem);
  crmSeed(mem);
  const db = bindTenantDatabase(mem.client as never, TENANT, true);
  mem.rpc("publish_onboarding_template", (args) => {
    const versions = mem
      .rows("onboarding_templates")
      .filter((r) => r.tenant_id === TENANT && r.template_key === args.p_key);
    const version = Math.max(0, ...versions.map((r) => Number(r.version))) + 1;
    for (const row of versions) row.active = false;
    mem.tables.onboarding_templates!.push({
      tenant_id: TENANT,
      template_key: args.p_key,
      version,
      active: true,
      milestones: args.p_milestones,
    });
    return { key: args.p_key, version, milestones: args.p_milestones };
  });

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
    /matching tenant-bound/,
    "cross-tenant opportunities must not resolve",
  );

  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-won",
        actorEmail: ACTOR,
        milestoneKeys: ["missing"],
      }),
    /Unknown milestone/,
  );
  assert.equal(mem.rows("clients").length, 0, "invalid milestone selection creates no engagement");
  mem.tables.tenants![0]!.config = { modules: { clients: false } };
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-won",
        actorEmail: ACTOR,
      }),
    /unavailable/,
  );
  mem.tables.tenants![0]!.config = { modules: { clients: true } };
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

  // 2b. An originating proposal is validated and carried on the receipt so
  // delivery stays traceable to the sold scope. Foreign or missing proposals
  // fail closed — the handoff never guesses an id. A separate won opportunity
  // keeps the proposal-linked receipt from being overwritten by the replay
  // checks below.
  mem.tables.opportunities!.push({
    id: "o-won-3",
    tenant_id: TENANT,
    stage: "won",
    name: "Proposal-linked rollout",
    estimated_value: 8000,
    contact_id: "c1",
    company_id: "co1",
    email: "ana@example.com",
  });
  mem.tables.proposals!.push({
    id: "prop-won3",
    tenant_id: TENANT,
    opportunity_id: "o-won-3",
    title: "Proposal-linked rollout proposal",
    version: 1,
    status: "accepted",
  });
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-won-3",
        actorEmail: ACTOR,
        proposalId: "prop-other",
      }),
    /does not belong to this opportunity/,
    "a proposal from another opportunity must be refused",
  );
  await assert.rejects(
    () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-won-3",
        actorEmail: ACTOR,
        proposalId: "prop-missing",
      }),
    /was not found/,
    "a nonexistent proposal must be refused",
  );
  const proposalLinked = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won-3",
    actorEmail: ACTOR,
    proposalId: "prop-won3",
  });
  assert.equal(proposalLinked.receipt.proposal_id, "prop-won3");
  assert.ok(
    mem
      .rows("audit_log")
      .some(
        (r) =>
          r.action === "engagement.handed_off" &&
          (String(
            (r.after_state as Record<string, unknown> | null | undefined)?.proposal_id ?? "",
          ) === "prop-won3" ||
            String(
              (r.metadata as { receipt?: Record<string, unknown> } | null | undefined)?.receipt
                ?.proposal_id ?? "",
            ) === "prop-won3"),
      ),
    "handoff audit must reference the originating proposal",
  );

  // 3. Replay: same engagement, nothing duplicated, reported honestly.
  const linkedReplay = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won-3",
    actorEmail: ACTOR,
  });
  assert.equal(
    linkedReplay.receipt.proposal_id,
    "prop-won3",
    "omitting a proposal on replay preserves the confirmed source",
  );
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
    mem
      .rows("tasks")
      .filter(
        (r) =>
          String(r.dedupe_key ?? "").startsWith(`handoff:${first.client.id}:`) ||
          String(r.dedupe_key ?? "").startsWith("handoff:"),
      )
      .filter((r) => String(r.opportunity_id ?? "") === "o-won").length,
    3,
    "no duplicate commitments on replay for the same engagement",
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

  const countBeforeCompletion = mem.rows("tasks").length;
  const completedTask = mem
    .rows("tasks")
    .find((t) => t.dedupe_key === `handoff:${first.client.id}:kickoff`)!;
  completedTask.status = "completed";
  await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won",
    actorEmail: ACTOR,
  });
  assert.equal(
    mem.rows("tasks").length,
    countBeforeCompletion,
    "completed commitments are never re-created",
  );
  mem.tables.opportunities!.push({ ...mem.tables.opportunities![0], id: "o-concurrent" });
  const beforeConcurrent = mem.rows("tasks").length;
  const parallel = await Promise.all(
    Array.from({ length: 4 }, () =>
      createHandoffFromOpportunity(db, {
        tenantId: TENANT,
        opportunityId: "o-concurrent",
        actorEmail: ACTOR,
      }),
    ),
  );
  assert.equal(
    new Set(parallel.map((x) => x.client.id)).size,
    1,
    "concurrent handoffs converge on one engagement",
  );
  assert.equal(
    mem.rows("tasks").length,
    beforeConcurrent + 3,
    "concurrent requests create one task per milestone",
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
  const pinned = await createHandoffFromOpportunity(db, {
    tenantId: TENANT,
    opportunityId: "o-won",
    actorEmail: ACTOR,
  });
  assert.equal(
    pinned.receipt.template_version,
    1,
    "publishing a template does not rewrite in-flight scope",
  );
  assert.equal(pinned.milestones.length, 3);

  // 6. The record workspace exposes engagement status, next milestone,
  // and blockers without a second fetch path, and surfaces the exact
  // handoff receipt (template, version, replay, remainder, proposal).
  const withEngagement = await loadOpportunityRecord(db, "o-won-3");
  assert.ok(withEngagement?.engagement, "handed-off record carries its engagement");
  assert.equal(
    withEngagement?.engagement?.business_name,
    "Acme Co",
    "engagement business name follows the canonical company",
  );
  assert.equal(withEngagement?.engagement?.next_milestone?.key, "kickoff");
  assert.deepEqual(withEngagement?.engagement?.blockers, []);
  assert.ok(withEngagement?.engagement?.receipt, "engagement must expose its handoff receipt");
  assert.equal(withEngagement?.engagement?.receipt?.template_key, "default");
  assert.equal(withEngagement?.engagement?.receipt?.proposal_id, "prop-won3");
  assert.equal(
    withEngagement?.engagement?.receipt?.remainder.length,
    0,
    "receipt must expose the bounded remainder",
  );
  const withoutEngagement = await loadOpportunityRecord(db, "o-open");
  assert.equal(withoutEngagement?.engagement, null, "unhanded record stands alone");

  console.log(
    JSON.stringify({
      result: "passed",
      checks: [
        "won-gate",
        "full-handoff",
        "proposal-gate",
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
