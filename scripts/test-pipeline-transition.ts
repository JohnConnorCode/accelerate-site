import { proposeAction } from "../src/lib/revenue-os/actions";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import type { SupabaseClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  transitionOpportunity,
  createOpportunity,
  reorderOpportunities,
  transitionStatusFromError,
  applyPipelineEffect,
} from "../src/lib/revenue-os/pipeline";

type Row = Record<string, unknown>;

import { AuthorizedMemorySupabase as MemorySupabase } from "./lib/autonomy-fixture";
const rows = (db: MemorySupabase, table: string) => db.rows(table);
const memorySupabase = (seed: Record<string, Row[]>) => new MemorySupabase(seed);

/**
 * Admin-defined pipeline board rows. transitionOpportunity() resolves every
 * stage through loadPipelineStages() (kanban_columns, board_key="pipeline"),
 * never through a static list, so the fixture must carry the board the rules
 * run against. Roles/probabilities mirror DEFAULT_STAGE_META in
 * src/lib/revenue-os/types.ts. Rows carry no tenant_id, matching the
 * tenant-agnostic opportunity seeds in this file.
 */
function pipelineBoardSeed(): Row[] {
  const stages: Array<{
    key: string;
    label: string;
    probability: number;
    role: "open" | "won" | "lost";
  }> = [
    { key: "new", label: "New", probability: 10, role: "open" },
    { key: "contacted", label: "Contacted", probability: 20, role: "open" },
    { key: "qualified", label: "Qualified", probability: 40, role: "open" },
    { key: "meeting", label: "Meeting", probability: 55, role: "open" },
    { key: "proposal", label: "Proposal", probability: 70, role: "open" },
    { key: "negotiation", label: "Negotiation", probability: 85, role: "open" },
    { key: "won", label: "Won", probability: 100, role: "won" },
    { key: "lost", label: "Lost", probability: 0, role: "lost" },
    { key: "nurture", label: "Nurture", probability: 10, role: "open" },
  ];
  return stages.map((stage, index) => ({
    id: `col-${stage.key}`,
    board_key: "pipeline",
    column_key: stage.key,
    label: stage.label,
    is_default: stage.key === "new",
    sort_order: index,
    metadata: { role: stage.role, probability: stage.probability },
  }));
}

async function run() {
  const pipelineRoute = readFileSync(
    new URL("../src/app/api/admin/revenue-os/pipeline/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    pipelineRoute,
    /createOpportunity\(/,
    "Pipeline API must use the canonical creation service.",
  );
  assert.match(
    pipelineRoute,
    /updateOpportunityDetails\(/,
    "Pipeline API must use the canonical detail-update service.",
  );
  assert.doesNotMatch(
    pipelineRoute,
    /from\("opportunities"\)\.insert\(/,
    "Pipeline API must not create opportunities directly.",
  );
  assert.doesNotMatch(
    pipelineRoute,
    /from\("opportunities"\)\.update\(/,
    "Pipeline API must not update opportunities directly.",
  );

  const db = memorySupabase({
    opportunities: [
      {
        id: "o1",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 7500,
        loss_reason: null,
      },
      {
        id: "o2",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 2500,
        loss_reason: null,
      },
      {
        id: "o3",
        stage: "lost",
        probability: 0,
        won_value: 0,
        estimated_value: 0,
        loss_reason: "legacy-close",
      },
      {
        id: "o4",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 2000,
        loss_reason: null,
      },
      {
        id: "o5",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 1250,
        loss_reason: null,
      },
    ],
    stage_events: [],
    audit_log: [],
    kanban_columns: pipelineBoardSeed(),
  });

  const lostTransition = await transitionOpportunity(db.client, {
    id: "o1",
    to: "lost",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Qualification path stale",
    lossReason: "Duplicate lead source",
  });
  assert.equal(lostTransition.stage, "lost");
  assert.equal(lostTransition.closed_at, lostTransition.last_activity_at);
  assert.equal(rows(db, "stage_events").length, 1);
  assert.equal(rows(db, "stage_events")[0]?.from_stage, "qualified");
  assert.equal(rows(db, "stage_events")[0]?.to_stage, "lost");
  assert.equal(rows(db, "stage_events")[0]?.actor_email, "founder@example.com");
  assert.equal(
    (rows(db, "stage_events")[0]?.metadata as { loss_reason?: string } | undefined)?.loss_reason,
    "Duplicate lead source",
  );
  const stageAudits = rows(db, "audit_log").filter(
    (row) => row.action === "opportunity.stage_changed",
  );
  assert.equal(stageAudits.length, 1);
  assert.equal(
    (stageAudits[0] as { action?: string } | undefined)?.action,
    "opportunity.stage_changed",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db.client, {
        id: "o2",
        to: "lost",
        actorEmail: "founder@example.com",
        source: "test",
      }),
    /loss reason is required/i,
    "Lost transitions require lossReason.",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db.client, {
        id: "o3",
        to: "contacted",
        actorEmail: "founder@example.com",
        source: "test",
        reason: "Reopen blocked intentionally",
      }),
    /Reopen policy/,
    "Terminal reopen defaults to blocked.",
  );

  await assert.rejects(
    () =>
      transitionOpportunity(db.client, {
        id: "o3",
        to: "contacted",
        actorEmail: "founder@example.com",
        source: "test",
        allowTerminalReopen: true,
      }),
    /reason is required/i,
    "Reopen must include a reason.",
  );

  const reopened = await transitionOpportunity(db.client, {
    id: "o3",
    to: "contacted",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Operator chose explicit loss correction",
    allowTerminalReopen: true,
  });
  assert.equal(reopened.stage, "contacted");
  assert.equal(rows(db, "stage_events").at(-1)?.to_stage, "contacted");

  const legacyInput = await transitionOpportunity(db.client, {
    id: "o4",
    to: "booked",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Calendly lead captured",
  });
  assert.equal(legacyInput.stage, "meeting");
  assert.equal(rows(db, "stage_events").at(-1)?.to_stage, "meeting");

  // Role-based moves replaced the old hand-curated adjacency graph: any move
  // between two recognized stages is structurally allowed (see canTransition
  // in pipeline-stage-resolver.ts). A direct open→won close succeeds and
  // derives won_value from the estimate when none was recorded.
  const directClose = await transitionOpportunity(db.client, {
    id: "o4",
    to: "won",
    actorEmail: "founder@example.com",
    source: "test",
    reason: "Operator closed a fast-moving deal",
  });
  assert.equal(directClose.stage, "won");
  assert.equal(directClose.won_value, 2000);
  assert.equal(rows(db, "stage_events").at(-1)?.to_stage, "won");

  const staleDb = memorySupabase({
    opportunities: [
      {
        id: "o6",
        stage: "qualified",
        probability: 40,
        won_value: 0,
        estimated_value: 1500,
        loss_reason: null,
      },
    ],
    stage_events: [],
    audit_log: [],
    kanban_columns: pipelineBoardSeed(),
  });

  const staleTransport = staleDb.client as SupabaseClient;
  const staleClient = {
    ...staleTransport,
    rpc: (name: string, args: Record<string, unknown>) => {
      if (name === "apply_pipeline_action") staleDb.rows("opportunities")[0]!.stage = "won";
      return staleTransport.rpc(name, args);
    },
  } as SupabaseClient;
  await assert.rejects(
    () =>
      transitionOpportunity(staleClient, {
        id: "o6",
        to: "meeting",
        actorEmail: "founder@example.com",
        source: "test",
        reason: "Concurrent editor changed the stage",
      }),
    /changed while you were editing/i,
    "Optimistic lock check should reject stale edits.",
  );
  assert.equal(rows(staleDb, "stage_events").length, 0, "No stage event on stale transition.");

  await assert.rejects(
    () =>
      transitionOpportunity(db.client, {
        id: "o2",
        to: "not_a_stage",
        actorEmail: "founder@example.com",
        source: "test",
      }),
    /unknown stage/i,
    "Unknown stage inputs must be rejected.",
  );

  assert.equal(
    transitionStatusFromError(
      new Error("The opportunity changed while you were editing it. Refresh and try again."),
    ),
    409,
    "Transition failures for optimistic concurrency map to 409.",
  );
  assert.equal(
    transitionStatusFromError(new Error("Cannot move an opportunity from qualified to won")),
    400,
    "Other transition failures map to 400 for bad request.",
  );

  const beforeCalls = db.rpcCalls.length;
  const proposed = await proposeAction(db.client, {
    actionType: "transition_opportunity",
    title: "Reviewed programmatic transition",
    payload: { opportunityId: "o5", stage: "meeting", reason: "Exact reviewed move" },
    sourceContext: "ai",
    proposedBy: "founder@example.com",
  });
  const programmatic = (await approveAndExecuteAction(
    db.client,
    String(proposed.id),
    "founder@example.com",
  )) as Row;
  assert.equal(programmatic.stage, "meeting");
  assert.equal(
    db.rpcCalls.slice(beforeCalls).filter((call) => call.name === "apply_pipeline_action").length,
    1,
    "Programmatic approval reaches the same pipeline effect as actual booking UI",
  );
  await assert.rejects(
    () => applyPipelineEffect(db.client, "transition_opportunity", {}, "system", null),
    /Bound tenant system context required/,
    "Caller text cannot supply service provenance",
  );
  const created = await createOpportunity(db.client, {
    actorEmail: "founder@example.com",
    name: "New client",
    email: "new-client@example.test",
    estimatedValue: 100,
  });
  assert.equal(created.stage, "new");
  assert.ok(
    rows(db, "action_queue").some(
      (a) => a.action_type === "create_opportunity" && a.status === "executed",
    ),
  );
  const reordered = await reorderOpportunities(db.client, "founder@example.com", [
    { id: created.id, column_key: "new", sort_order: 20 },
  ]);
  assert.equal(reordered.affected, 1);
  assert.equal(rows(db, "opportunities").find((o) => o.id === created.id)?.stage, "new");
  await assert.rejects(
    () =>
      reorderOpportunities(db.client, "founder@example.com", [
        { id: created.id, column_key: "won", sort_order: 40 },
      ]),
    /changed|unavailable/,
  );
  assert.equal(rows(db, "opportunities").find((o) => o.id === created.id)?.sort_order, 20);
  console.log(
    JSON.stringify({
      checks: [
        "creation and reorder share the approved pipeline executor",
        "reorder cannot change stage",
        "loss reason is required for lost",
        "reopen policy blocks by default",
        "reopen requires reason",
        "terminal reopen is explicitly allowed with reason",
        "legacy stage input is canonicalized",
        "role-based direct close is allowed and derives won_value",
        "optimistic concurrency is detected",
        "unknown input stage is rejected",
        "transition error mapping returns 409 for stale writes",
      ],
    }),
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
