#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEMO_BLUEPRINT_DETAIL } from "../src/lib/admin/demo/blueprint-fixture";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BLUEPRINT_SCHEMA_VERSION,
  parseBlueprint,
} from "../src/lib/revenue-os/workspace-blueprint";
import {
  generateWorkspaceOperations,
  getGeneratedWorkspaceOperations,
  planWorkspaceOperations,
} from "../src/lib/revenue-os/workspace-architect-generated-operations";

type FakeRow = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
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
  private applyFilters(rows: FakeRow[]): FakeRow[] {
    return rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }
  private run(): FakeRow[] {
    const table = (this.tables[this.table] ??= []);
    return this.applyFilters(table);
  }
  async single(): Promise<{
    data: FakeRow | null;
    error: { message: string; code?: string } | null;
  }> {
    try {
      const rows = this.run();
      if (rows.length !== 1) return { data: null, error: { message: "expected one row" } };
      return { data: rows[0]!, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: (error as Error).message, code: (error as { code?: string }).code },
      };
    }
  }
  async maybeSingle(): Promise<{
    data: FakeRow | null;
    error: { message: string; code?: string } | null;
  }> {
    try {
      return { data: this.run()[0] ?? null, error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: (error as Error).message, code: (error as { code?: string }).code },
      };
    }
  }
  then<
    TResult1 = { data: FakeRow[]; error: { message: string; code?: string } | null },
    TResult2 = never,
  >(
    onfulfilled?:
      | ((value: {
          data: FakeRow[];
          error: { message: string; code?: string } | null;
        }) => TResult1 | PromiseLike<TResult1>)
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
    {
      kind: "inference" as const,
      statement: "Won jobs need a welcome sequence",
      sources: ["founder interview"],
    },
  ],
};

function sampleBlueprint(extra: Record<string, unknown> = {}) {
  return parseBlueprint({
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    businessSummary:
      "A roofing business tracks jobs through a sales pipeline and runs a welcome sequence on won deals.",
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
          {
            key: "draft_welcome",
            kind: "ai_judgment",
            description: "Draft welcome email",
            capabilityKey: "email.draft",
          },
          {
            key: "send_welcome",
            kind: "action",
            description: "Send welcome email",
            capabilityKey: "email.send",
          },
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

async function verifyDemoGeneration() {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const storage = new Map<string, string>();
  let escaped = 0;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      fetch: async () => {
        escaped++;
        throw new Error("Escaped fictional request");
      },
      open: () => null,
      dispatchEvent: () => true,
      location: { origin: "https://demo.example", reload: () => {} },
    },
  });
  const path = `/api/admin/blueprints/${DEMO_BLUEPRINT_DETAIL.blueprintId}`;
  const json = async (url: string, body?: unknown) => {
    const response = await window.fetch(
      url,
      body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) },
    );
    return { status: response.status, data: await response.json() };
  };
  try {
    for (const scenario of Object.keys(DEMO_SCENARIOS) as Array<keyof typeof DEMO_SCENARIOS>) {
      let runtime = installAdminDemoRuntime(scenario);
      try {
        assert.equal(
          (await json(path)).data.generation.state,
          "not_generated",
          "saved setup stays scoped to its scenario",
        );
        const stageSnapshot = async () => {
          const result = (await json("/api/admin/revenue-os/pipeline")).data;
          return result.opportunities.map((row: { id: string; stage: string }) => ({
            id: row.id,
            stage: row.stage,
          }));
        };
        const before = await stageSnapshot();
        assert.equal(
          (await json(`${path}/generate-operations`, { version: 1, requestKey: "first" })).status,
          409,
        );
        assert.equal((await json(`${path}/approve`, { version: 1 })).status, 200);
        const first = await json(`${path}/generate-operations`, {
          version: 1,
          requestKey: "first",
        });
        assert.equal(first.status, 200);
        assert.equal(first.data.replayed, false);
        assert.ok(first.data.simulated);
        assert.ok(first.data.receipt.auditId);
        assert.deepEqual(
          first.data.receipt.boards.find(
            (board: { targetBoardKey: string }) => board.targetBoardKey === "pipeline",
          ).columnsCreated,
          ["quote_review"],
        );
        assert.ok(
          first.data.receipt.workflows.every(
            (workflow: { actionId: null }) => workflow.actionId === null,
          ),
        );
        const columns = (await json("/api/admin/kanban/columns?board_key=pipeline")).data.columns;
        assert.equal(
          new Set(columns.map((column: { column_key: string }) => column.column_key)).size,
          columns.length,
        );
        for (const requestKey of ["first", "alias"]) {
          const replay = await json(`${path}/generate-operations`, { version: 1, requestKey });
          assert.equal(replay.data.replayed, true);
          assert.deepEqual(replay.data.receipt, first.data.receipt);
        }
        runtime.restore();
        runtime = installAdminDemoRuntime(scenario);
        assert.deepEqual((await json(path)).data.generation.receipt, first.data.receipt);
        const stableColumns = (rows: Array<Record<string, unknown>>) =>
          rows.map((row) => ({
            id: row.id,
            column_key: row.column_key,
            label: row.label,
            metadata: row.metadata,
            sort_order: row.sort_order,
            is_default: row.is_default,
          }));
        assert.deepEqual(
          stableColumns((await json("/api/admin/kanban/columns?board_key=pipeline")).data.columns),
          stableColumns(columns),
        );
        const detail = (await json(path)).data;
        const edit = await json("/api/admin/blueprints", {
          blueprintId: detail.blueprintId,
          document: {
            ...detail.document,
            businessSummary: "The fictional team reviews won jobs before preparing welcome emails.",
          },
          changeSummary: "Review process",
        });
        assert.equal(edit.status, 201);
        assert.equal((await json(path)).data.status, "draft");
        assert.equal(
          (await json(`${path}/generate-operations`, { version: 2, requestKey: "new" })).status,
          409,
        );
        assert.equal((await json(`${path}/approve`, { version: 2 })).status, 200);
        assert.equal(
          (await json(`${path}/generate-operations`, { version: 2, requestKey: "alias" })).status,
          409,
        );
        assert.equal(
          (await json(`${path}/generate-operations`, { version: 1, requestKey: "stale" })).status,
          409,
        );
        const next = await json(`${path}/generate-operations`, { version: 2, requestKey: "new" });
        assert.equal(next.status, 200);
        assert.ok(
          next.data.receipt.boards.every(
            (board: { columnsCreated: string[] }) => board.columnsCreated.length === 0,
          ),
        );
        assert.deepEqual(
          await stageSnapshot(),
          before,
          "setup leaves authoritative business stages unchanged",
        );
      } finally {
        runtime.restore();
      }
    }
    assert.equal(escaped, 0, "fictional setup never reaches a database or provider");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
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
  assert.equal(
    wonJobsBoard.targetBoardKey,
    "pipeline",
    "opportunity boards reuse the pipeline board",
  );

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
  const unsupportedBoard = noBoardMapping.boards.find(
    (b) => b.blueprintBoardKey === "collections_cases",
  )!;
  assert.equal(unsupportedBoard.status, "unsupported");
  assert.equal(unsupportedBoard.targetBoardKey, null);
  assert.ok(
    noBoardMapping.customAppBriefs.some(
      (brief) => brief.missingKey === "board_lifecycle:collections_case",
    ),
    "unsupported board lifecycle becomes a Custom App Brief, not a forced Task board",
  );
  assert.ok(
    noBoardMapping.customAppBriefs.every(
      (brief) => !/feature board|task lifecycle/i.test(brief.title),
    ),
  );

  // ---------------------------------------------------------------------
  // AC2: generated workflows and Coworker recommendations reference
  // existing capabilities and the existing approval path.
  // ---------------------------------------------------------------------
  const workflow = plan.workflows.find((w) => w.key === "won_welcome")!;
  assert.equal(workflow.status, "ready");
  assert.equal(
    workflow.approvalRequired,
    true,
    "email.send is approval_required in the live context",
  );
  assert.deepEqual(
    workflow.steps.map((s) => s.capabilityKey),
    ["email.draft", "email.send"],
  );

  const salesCoworker = plan.coworkers.find((c) => c.key === "sales_coworker")!;
  assert.equal(salesCoworker.status, "ready");
  assert.equal(salesCoworker.missingCapabilities.length, 0);

  const smsCoworker = plan.coworkers.find((c) => c.key === "sms_coworker")!;
  assert.equal(smsCoworker.status, "blocked");
  assert.deepEqual(
    smsCoworker.missingCapabilities,
    ["sms.send"],
    "missing capabilities are cited, never guessed",
  );

  // ---------------------------------------------------------------------
  // Application boundary: approval checks and one atomic RPC, followed
  // by audit-backed reads. Real transaction proof runs in native PostgreSQL.
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

  const adapters = {
    collectContext: async () => liveContext(),
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
      {
        tenantId,
        blueprintId,
        version: 1,
        requestKey: randomUUID(),
        actorEmail: "founder@example.com",
      },
      adapters,
    ),
    /approved or applied/,
  );

  await assert.rejects(
    generateWorkspaceOperations(
      client,
      {
        tenantId,
        blueprintId,
        version: 2,
        requestKey: randomUUID(),
        actorEmail: "founder@example.com",
      },
      adapters,
    ),
    /current approved Blueprint version/,
  );

  const requestKey = randomUUID();
  const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  const receipt = {
    auditId: randomUUID(),
    blueprintId,
    version: 1,
    navigation: plan.navigation,
    views: plan.views,
    boards: plan.boards.map((board) => ({ ...board, columnsCreated: [] })),
    workflows: plan.workflows.map((workflow) => ({ ...workflow, actionId: null })),
    coworkers: plan.coworkers.map((coworker) => ({ ...coworker, actionId: null })),
    customAppBriefs: plan.customAppBriefs,
  };
  const rpcClient = Object.assign(db, {
    rpc: async (name: string, input: Record<string, unknown>) => {
      calls.push({ name, input });
      return { data: { replayed: false, receipt }, error: null };
    },
  }) as unknown as SupabaseClient;
  const input = {
    tenantId,
    blueprintId,
    version: 1,
    requestKey,
    actorEmail: "fictional@example.test",
  };
  assert.deepEqual(
    (await generateWorkspaceOperations(rpcClient, input, adapters)).receipt,
    receipt,
  );
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.name, "generate_workspace_operations");
  assert.equal(call.input.p_tenant_id, tenantId);
  assert.equal(call.input.p_blueprint_id, blueprintId);
  assert.equal(call.input.p_request_key, requestKey);
  assert.deepEqual(call.input.p_document, blueprint);
  assert.deepEqual(call.input.p_plan, plan);
  assert.equal(
    db.tables.kanban_columns.length,
    0,
    "application does not perform non-transactional column writes",
  );
  assert.equal(
    db.tables.workspace_generated_operations.length,
    0,
    "application does not write receipts outside RPC",
  );
  assert.equal(db.tables.audit_log?.length ?? 0, 0, "application does not write audit outside RPC");
  assert.equal(
    db.tables.action_queue.length,
    0,
    "recommendations do not enqueue unregistered actions",
  );
  const failureClient = Object.assign(db, {
    rpc: async () => ({ data: null, error: { message: "private forced audit failure" } }),
  }) as unknown as SupabaseClient;
  await assert.rejects(
    generateWorkspaceOperations(failureClient, input, adapters),
    (error: Error) => {
      assert.equal(
        error.message,
        "Operating setup was not saved. Check the connection, then retry.",
      );
      assert.ok(!error.message.includes("private"));
      return true;
    },
  );
  const legacyClient = Object.assign(db, {
    rpc: async () => ({ data: null, error: { message: "generation_reconciliation_required" } }),
  }) as unknown as SupabaseClient;
  await assert.rejects(
    generateWorkspaceOperations(legacyClient, input, adapters),
    /maintainer reconciliation/,
  );
  const unverifiedClient = Object.assign(db, {
    rpc: async () => ({ data: { replayed: false, receipt: { blueprintId } }, error: null }),
  }) as unknown as SupabaseClient;
  await assert.rejects(
    generateWorkspaceOperations(unverifiedClient, input, adapters),
    /could not be verified/,
  );
  await assert.rejects(
    generateWorkspaceOperations(client, { ...input, requestKey: "x".repeat(181) }, adapters),
    /1 to 180/,
  );
  const readInput = { tenantId, blueprintId, version: 1 };
  assert.deepEqual(await getGeneratedWorkspaceOperations(client, readInput), {
    state: "not_generated",
    receipt: null,
  });
  const operationId = randomUUID();
  const savedRow = {
    id: operationId,
    tenant_id: tenantId,
    blueprint_id: blueprintId,
    version: 1,
    receipt,
    audit_id: receipt.auditId,
  };
  db.tables.workspace_generated_operations = [{ ...savedRow, audit_id: null }];
  assert.equal(
    (await getGeneratedWorkspaceOperations(client, readInput)).state,
    "reconciliation_required",
  );
  db.tables.workspace_generated_operations = [savedRow];
  assert.equal(
    (await getGeneratedWorkspaceOperations(client, readInput)).state,
    "reconciliation_required",
    "a foreign or missing audit cannot verify setup",
  );
  const auditRow = {
    id: receipt.auditId,
    tenant_id: tenantId,
    action: "workspace_operations.generated",
    entity_type: "workspace_blueprint",
    entity_id: blueprintId,
    metadata: { operationId },
  };
  db.tables.audit_log = [auditRow];
  assert.deepEqual(await getGeneratedWorkspaceOperations(client, readInput), {
    state: "saved",
    receipt,
  });
  for (const patch of [
    { tenant_id: randomUUID() },
    { action: "other.operation" },
    { entity_id: randomUUID() },
    { metadata: { operationId: randomUUID() } },
  ]) {
    db.tables.audit_log = [{ ...auditRow, ...patch }];
    assert.equal(
      (await getGeneratedWorkspaceOperations(client, readInput)).state,
      "reconciliation_required",
    );
  }
  db.tables.audit_log = [auditRow];
  db.tables.workspace_generated_operations = [
    { ...savedRow, receipt: { ...receipt, auditId: randomUUID() } },
  ];
  assert.equal(
    (await getGeneratedWorkspaceOperations(client, readInput)).state,
    "reconciliation_required",
    "receipt must match its audit link",
  );
  // Real rollback, replay, concurrency and role checks live in the native
  // PostgreSQL proof. This spy verifies the application transaction boundary.
  assert.deepEqual(
    DEMO_BLUEPRINT_DETAIL.operations,
    planWorkspaceOperations(
      parseBlueprint(DEMO_BLUEPRINT_DETAIL.document),
      liveContext({
        modules: ["core-pipeline", "stripe-invoicing"],
        routes: ["/admin/pipeline", "/admin/invoicing"],
      }),
    ),
    "the shared fictional proposal must match the real domain planner",
  );
  await verifyDemoGeneration();
  console.log("test:workspace-architect-generated-operations passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
