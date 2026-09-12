#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLUEPRINT_SCHEMA_VERSION, parseBlueprint } from "../src/lib/revenue-os/workspace-blueprint";
import {
  generateWorkspaceOperations,
  planWorkspaceOperations,
} from "../src/lib/revenue-os/workspace-architect-generated-operations";

type FakeRow = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private insertRows: FakeRow[] | null = null;
  constructor(
    private tables: Record<string, FakeRow[]>,
    private table: string,
  ) {}
  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }
  select(): this {
    return this;
  }
  insert(rows: FakeRow | FakeRow[]): this {
    this.insertRows = (Array.isArray(rows) ? rows : [rows]).map((row) => ({ ...row }));
    return this;
  }
  order(): this {
    return this;
  }
  limit(): this {
    return this;
  }
  private applyFilters(rows: FakeRow[]): FakeRow[] {
    return rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }
  private run(): FakeRow[] {
    const table = (this.tables[this.table] ??= []);
    if (this.insertRows) {
      for (const row of this.insertRows) {
        row.id ??= randomUUID();
        row.created_at ??= new Date().toISOString();
        // Emulate the two unique indexes this module relies on for
        // idempotent replay / no-duplicate generation.
        if (this.table === "workspace_generated_operations") {
          const dupeRequestKey = table.some(
            (existing) =>
              existing.tenant_id === row.tenant_id && existing.request_key === row.request_key,
          );
          const dupeVersion = table.some(
            (existing) =>
              existing.tenant_id === row.tenant_id &&
              existing.blueprint_id === row.blueprint_id &&
              existing.version === row.version,
          );
          if (dupeRequestKey || dupeVersion) {
            throw Object.assign(new Error("duplicate key"), { code: "23505" });
          }
        }
        if (this.table === "kanban_columns") {
          const dupe = table.some(
            (existing) =>
              existing.tenant_id === row.tenant_id &&
              existing.board_key === row.board_key &&
              existing.column_key === row.column_key,
          );
          if (dupe) throw Object.assign(new Error("duplicate key"), { code: "23505" });
        }
        table.push(row);
      }
      return this.insertRows;
    }
    return this.applyFilters(table);
  }
  async single(): Promise<{ data: FakeRow | null; error: { message: string; code?: string } | null }> {
    try {
      const rows = this.run();
      if (rows.length !== 1) return { data: null, error: { message: "expected one row" } };
      return { data: rows[0]!, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message, code: (error as { code?: string }).code } };
    }
  }
  async maybeSingle(): Promise<{ data: FakeRow | null; error: { message: string; code?: string } | null }> {
    try {
      return { data: this.run()[0] ?? null, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message, code: (error as { code?: string }).code } };
    }
  }
  then<TResult1 = { data: FakeRow[]; error: { message: string; code?: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: FakeRow[]; error: { message: string; code?: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      return Promise.resolve({ data: this.run(), error: null }).then(onfulfilled, onrejected);
    } catch (error) {
      return Promise.resolve({
        data: [],
        error: { message: (error as Error).message, code: (error as { code?: string }).code },
      }).then(onfulfilled, onrejected);
    }
  }
}

function fakeSupabase() {
  const tables: Record<string, FakeRow[]> = {};
  return {
    tables,
    from(table: string): FakeQuery {
      return new FakeQuery(tables, table);
    },
  };
}

const classified = {
  classification: "recommendation" as const,
  evidence: [
    { kind: "inference" as const, statement: "Won jobs need a welcome sequence", sources: ["founder interview"] },
  ],
};

function sampleBlueprint(extra: Record<string, unknown> = {}) {
  return parseBlueprint({
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    businessSummary: "A roofing business tracks jobs through a sales pipeline and runs a welcome sequence on won deals.",
    navigation: [{ label: "Pipeline", targetType: "board", targetKey: "won_jobs" }],
    boards: [
      {
        ...classified,
        key: "won_jobs",
        name: "Won Jobs",
        sourceType: "opportunity",
        groupingField: "stage",
        columns: [
          { key: "scheduled", label: "Scheduled", lifecycleStates: ["won"] },
          { key: "in_progress", label: "In progress", lifecycleStates: ["won"] },
        ],
        cardFields: ["company_name"],
      },
      {
        ...classified,
        key: "collections_cases",
        name: "Collections Cases",
        sourceType: "collections_case",
        groupingField: "status",
        columns: [{ key: "open", label: "Open", lifecycleStates: ["open"] }],
        cardFields: [],
      },
    ],
    views: [
      {
        ...classified,
        key: "hot_leads",
        name: "Hot leads",
        sourceType: "opportunity",
        filters: [{ field: "stage", op: "eq", value: "qualified" }],
        sort: ["-created_at"],
        columns: ["company_name", "stage"],
      },
    ],
    workflows: [
      {
        ...classified,
        key: "won_welcome",
        name: "Won welcome",
        trigger: { kind: "record_transition", ref: "opportunity.stage -> won" },
        steps: [
          { key: "draft_welcome", kind: "ai_judgment", description: "Draft welcome email", capabilityKey: "email.draft" },
          { key: "send_welcome", kind: "action", description: "Send welcome email", capabilityKey: "email.send" },
        ],
        requiredIntegrations: [],
        failureBehavior: "Stop and surface the failure.",
      },
    ],
    coworkers: [
      {
        ...classified,
        key: "sales_coworker",
        name: "Sales Coworker",
        purpose: "Follow up on won jobs and stale proposals.",
        workKinds: ["follow_up"],
        requiredCapabilities: ["email.draft", "email.send"],
        relevantEntities: ["opportunity"],
        autonomyPolicy: "ask_until_trusted",
        escalation: "Escalate to the founder if no reply after 5 business days.",
      },
      {
        ...classified,
        key: "sms_coworker",
        name: "SMS Coworker",
        purpose: "Text customers about job status.",
        workKinds: ["notify"],
        requiredCapabilities: ["sms.send"],
        relevantEntities: ["opportunity"],
        autonomyPolicy: "always_ask",
        escalation: "Escalate if delivery fails.",
      },
    ],
    ...extra,
  });
}

function liveContext(overrides: Record<string, unknown> = {}) {
  return {
    capabilities: [
      { key: "email.draft", available: true, policy: "automatic" as const },
      { key: "email.send", available: true, policy: "approval_required" as const },
    ],
    modules: ["core-pipeline"],
    entityTypes: ["opportunity", "contact"],
    routes: ["/admin/pipeline"],
    ...overrides,
  };
}

async function main() {
  // ---------------------------------------------------------------------
  // AC1: a fictional business context produces a coherent workspace
  // proposal with boards/views/navigation.
  // ---------------------------------------------------------------------
  const blueprint = sampleBlueprint();
  const plan = planWorkspaceOperations(blueprint, liveContext());

  assert.equal(plan.navigation.length, 1);
  assert.equal(plan.navigation[0]!.status, "ready");

  const wonJobsBoard = plan.boards.find((b) => b.blueprintBoardKey === "won_jobs")!;
  assert.equal(wonJobsBoard.status, "ready");
  assert.equal(wonJobsBoard.targetBoardKey, "pipeline", "opportunity boards reuse the pipeline board");

  const collectionsBoard = plan.boards.find((b) => b.blueprintBoardKey === "collections_cases")!;
  assert.equal(
    collectionsBoard.status,
    "blocked",
    "an unregistered entity type is blocked, never guessed as a new board",
  );

  const hotLeadsView = plan.views.find((v) => v.ref === "view:hot_leads")!;
  assert.equal(hotLeadsView.status, "ready");
  assert.deepEqual(hotLeadsView.columns, ["company_name", "stage"]);

  // A board whose entity type IS registered but has no Kanban board mapping
  // must become "unsupported" + a Custom App Brief, never the Feature
  // Board's Task lifecycle.
  const noBoardMapping = planWorkspaceOperations(
    blueprint,
    liveContext({ entityTypes: ["opportunity", "contact", "collections_case"] }),
  );
  const unsupportedBoard = noBoardMapping.boards.find((b) => b.blueprintBoardKey === "collections_cases")!;
  assert.equal(unsupportedBoard.status, "unsupported");
  assert.equal(unsupportedBoard.targetBoardKey, null);
  assert.ok(
    noBoardMapping.customAppBriefs.some((brief) => brief.missingKey === "board_lifecycle:collections_case"),
    "unsupported board lifecycle becomes a Custom App Brief, not a forced Task board",
  );
  assert.ok(
    noBoardMapping.customAppBriefs.every((brief) => !/feature board|task lifecycle/i.test(brief.title)),
  );

  // ---------------------------------------------------------------------
  // AC2: generated workflows and Coworker recommendations reference
  // existing capabilities and the existing approval path.
  // ---------------------------------------------------------------------
  const workflow = plan.workflows.find((w) => w.key === "won_welcome")!;
  assert.equal(workflow.status, "ready");
  assert.equal(workflow.approvalRequired, true, "email.send is approval_required in the live context");
  assert.deepEqual(
    workflow.steps.map((s) => s.capabilityKey),
    ["email.draft", "email.send"],
  );

  const salesCoworker = plan.coworkers.find((c) => c.key === "sales_coworker")!;
  assert.equal(salesCoworker.status, "ready");
  assert.equal(salesCoworker.missingCapabilities.length, 0);

  const smsCoworker = plan.coworkers.find((c) => c.key === "sms_coworker")!;
  assert.equal(smsCoworker.status, "blocked");
  assert.deepEqual(smsCoworker.missingCapabilities, ["sms.send"], "missing capabilities are cited, never guessed");

  // ---------------------------------------------------------------------
  // Full apply against a fake database: idempotent generation, existing
  // approval path reused, unknown capability never silently dropped.
  // ---------------------------------------------------------------------
  const db = fakeSupabase();
  const client = db as unknown as SupabaseClient;
  const tenantId = randomUUID();
  const blueprintId = randomUUID();
  db.tables.workspace_blueprints = [
    { id: blueprintId, tenant_id: tenantId, status: "applied", latest_version: 1 },
  ];
  db.tables.workspace_blueprint_versions = [
    { tenant_id: tenantId, blueprint_id: blueprintId, version: 1, document: blueprint },
  ];
  db.tables.workspace_generated_operations = [];
  db.tables.kanban_columns = [];
  db.tables.action_queue = [];

  const proposedActionTypes: string[] = [];
  const adapters = {
    collectContext: async () => liveContext(),
    proposeAction: async (
      _client: SupabaseClient,
      proposal: { actionType: string; dedupeKey?: string },
    ) => {
      proposedActionTypes.push(proposal.actionType);
      db.tables.action_queue!.push({ id: randomUUID(), ...proposal });
      return { id: randomUUID() };
    },
  };

  // A draft/backlog Blueprint cannot generate operations (mirrors apply's
  // approved-only gate; there is no auto-apply-from-chat shortcut).
  const draftDb = fakeSupabase();
  draftDb.tables.workspace_blueprints = [
    { id: blueprintId, tenant_id: tenantId, status: "draft", latest_version: 1 },
  ];
  await assert.rejects(
    generateWorkspaceOperations(
      draftDb as unknown as SupabaseClient,
      { tenantId, blueprintId, version: 1, requestKey: randomUUID(), actorEmail: "founder@example.com" },
      adapters,
    ),
    /approved or applied/,
  );

  const requestKey = randomUUID();
  const first = await generateWorkspaceOperations(
    client,
    { tenantId, blueprintId, version: 1, requestKey, actorEmail: "founder@example.com" },
    adapters,
  );
  assert.equal(first.replayed, false);
  assert.ok(proposedActionTypes.includes("generate_workspace_workflow"));
  assert.ok(proposedActionTypes.includes("recommend_workspace_coworker"));
  assert.equal(proposedActionTypes.length, 2, "one workflow + one ready coworker; blocked coworker is not proposed");

  const pipelineColumns = db.tables.kanban_columns.filter(
    (row) => row.board_key === "pipeline" && row.tenant_id === tenantId,
  );
  assert.equal(pipelineColumns.length, 2, "won_jobs board columns were created on the existing pipeline board");
  for (const column of pipelineColumns) {
    const metadata = column.metadata as { lifecycleStates?: string[] };
    assert.ok(Array.isArray(metadata.lifecycleStates), "column metadata documents lifecycle states");
  }
  // No collections_case board columns exist anywhere — the unmapped board
  // was never forced onto any existing board.
  assert.equal(db.tables.kanban_columns.filter((row) => row.board_key === "features").length, 0);

  // ---------------------------------------------------------------------
  // AC3: Today/board projections keep authoritative lifecycle state.
  // Generation never writes anything to the canonical opportunity/stage
  // tables; the added kanban_columns rows are presentational metadata only.
  // ---------------------------------------------------------------------
  assert.equal(db.tables.opportunities, undefined, "generation never touches canonical entity tables");
  assert.equal(db.tables.stage_events, undefined, "generation never invents stage history");
  for (const column of pipelineColumns) {
    assert.notEqual(
      (column.metadata as { role?: string }).role,
      "won",
      "generated columns never claim the authoritative won/lost role a real pipeline column owns",
    );
  }

  // ---------------------------------------------------------------------
  // Idempotent replay: regenerating the same approved version — even under
  // a fresh request key — must not duplicate boards or workflow/Coworker
  // proposals.
  // ---------------------------------------------------------------------
  const second = await generateWorkspaceOperations(
    client,
    { tenantId, blueprintId, version: 1, requestKey: randomUUID(), actorEmail: "founder@example.com" },
    adapters,
  );
  assert.equal(second.replayed, true);
  assert.equal(proposedActionTypes.length, 2, "replay must not create new action_queue proposals");
  assert.equal(
    db.tables.kanban_columns.filter((row) => row.board_key === "pipeline" && row.tenant_id === tenantId).length,
    2,
    "replay must not duplicate board columns",
  );

  const sameRequestReplay = await generateWorkspaceOperations(
    client,
    { tenantId, blueprintId, version: 1, requestKey, actorEmail: "founder@example.com" },
    adapters,
  );
  assert.equal(sameRequestReplay.replayed, true);
  assert.deepEqual(sameRequestReplay.receipt, first.receipt);

  console.log("test:workspace-architect-generated-operations passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
