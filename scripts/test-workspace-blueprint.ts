import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  BLUEPRINT_SCHEMA_VERSION,
  analyzeImpact,
  assertNoSecrets,
  buildReviewModel,
  classifyBlueprintImpact,
  collectBlueprintLiveContext,
  diffBlueprints,
  getLatestBlueprintVersion,
  listBlueprints,
  parseBlueprint,
  saveBlueprintVersion,
  getBlueprintVersion,
  listBlueprintVersions,
  summarizeApprovalGates,
  summarizePreflight,
  validateAgainstCapabilities,
  validateBlueprintAgainstLive,
  validateBlueprintStructure,
  type BlueprintLiveContext,
} from "../src/lib/revenue-os/workspace-blueprint";

// ---------------------------------------------------------------------------
// Minimal in-memory Supabase stub. It ONLY honors filters the caller adds
// explicitly (like RLS would enforce server-side), so a missing
// .eq("tenant_id", …) in the module leaks across tenants and fails the test.
// ---------------------------------------------------------------------------

type FakeRow = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private insertRows: FakeRow[] | null = null;
  private updatePatch: FakeRow | null = null;

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

  update(patch: FakeRow): this {
    this.updatePatch = { ...patch };
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderCol = column;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  private applyFilters(rows: FakeRow[]): FakeRow[] {
    return rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));
  }

  private run(): FakeRow[] {
    const table = (this.tables[this.table] ??= []);
    if (this.insertRows) {
      for (const row of this.insertRows) {
        if (this.table === "workspace_blueprints") {
          row.id ??= randomUUID();
          row.latest_version ??= 0;
        }
        row.created_at ??= new Date().toISOString();
        table.push(row);
      }
      return this.insertRows;
    }
    if (this.updatePatch) {
      const rows = this.applyFilters(table);
      for (const row of rows) Object.assign(row, this.updatePatch);
      return rows;
    }
    let rows = this.applyFilters(table);
    if (this.orderCol) {
      const column = this.orderCol;
      rows = [...rows].sort((a, b) => {
        const left = a[column];
        const right = b[column];
        if (left === right) return 0;
        if (left == null) return 1;
        if (right == null) return -1;
        return (left < right ? -1 : 1) * (this.orderAsc ? 1 : -1);
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }

  async single(): Promise<{ data: FakeRow | null; error: { message: string } | null }> {
    const rows = this.run();
    if (rows.length !== 1) return { data: null, error: { message: "expected one row" } };
    return { data: rows[0]!, error: null };
  }

  async maybeSingle(): Promise<{ data: FakeRow | null; error: null }> {
    return { data: this.run()[0] ?? null, error: null };
  }

  then<TResult1 = { data: FakeRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FakeRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.run(), error: null }).then(onfulfilled, onrejected);
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


// ---------------------------------------------------------------------------
// Fixture: spec §42 manufacturing acceptance scenario.
// ---------------------------------------------------------------------------

function manufacturingBlueprint(): Record<string, unknown> {
  const classified = (classification: string, extra: Record<string, unknown> = {}) => ({
    classification,
    evidence: [
      {
        kind: classification === "fact" ? "fact" : "inference",
        statement: "Deposit precedes production handoff",
        sources: ["founder interview 2026-09-01"],
        quote: "Once the deposit arrives, Teresa sends it to production.",
      },
    ],
    ...extra,
  });
  return {
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    businessSummary: "Custom manufacturing: sales, deposit, sampling, client review, production, QA, shipment, final payment.",
    evidenceRefs: [
      {
        kind: "fact",
        statement: "Client approves samples before bulk production",
        sources: ["meeting transcript Sep 3"],
        quote: "After we finish samples, we send them to the customer for approval.",
      },
    ],
    assumptions: ["Deposits are required before production for new clients"],
    unresolvedQuestions: ["Who approves discounts over 10%?"],
    navigation: [
      { label: "Sales", targetType: "board", targetKey: "sales_pipeline" },
      { label: "Production", targetType: "board", targetKey: "production" },
      { label: "Money", targetType: "module", targetKey: "invoicing" },
    ],
    entities: [
      {
        ...classified("recommendation", {
          key: "production_order",
          label: "Production Order",
          description: "Custom manufacturing order from deposit to delivery",
          reuseLevel: 4,
          confidence: "high",
          unresolvedQuestions: [],
        }),
      },
    ],
    relationships: [],
    workTypes: [],
    boards: [
      {
        ...classified("recommendation", {
          key: "production",
          name: "Production",
          sourceType: "production_order",
          groupingField: "stage",
          columns: [
            { key: "sampling", label: "Sampling", lifecycleStates: ["sampling"] },
            { key: "client_review", label: "Client Review", lifecycleStates: ["client_review"] },
            { key: "production", label: "Production", lifecycleStates: ["production"] },
            { key: "qa", label: "QA", lifecycleStates: ["qa"] },
            { key: "shipping", label: "Shipping", lifecycleStates: ["shipping"] },
            { key: "delivered", label: "Delivered", lifecycleStates: ["delivered"] },
          ],
          cardFields: ["customer", "due_date"],
        }),
      },
      {
        ...classified("recommendation", {
          key: "sales_pipeline",
          name: "Sales Pipeline",
          sourceType: "opportunity",
          groupingField: "stage",
          columns: [
            { key: "new", label: "New", lifecycleStates: ["new"] },
            { key: "proposal", label: "Proposal", lifecycleStates: ["proposal"] },
            { key: "won", label: "Won", lifecycleStates: ["won"] },
          ],
          cardFields: ["value"],
        }),
      },
    ],
    views: [],
    dashboards: [],
    workflows: [
      {
        ...classified("recommendation", {
          key: "won_opportunity_onboarding",
          name: "Won opportunity to production onboarding",
          trigger: { kind: "record_transition", ref: "opportunity.stage -> won" },
          steps: [
            { key: "create_project", kind: "deterministic", description: "Create production order", capabilityKey: "orders.create" },
            { key: "draft_welcome", kind: "ai_judgment", description: "Draft welcome email", capabilityKey: "email.draft" },
            { key: "send_welcome", kind: "action", description: "Send welcome email after approval", capabilityKey: "email.send" },
          ],
          requiredIntegrations: ["drive"],
          failureBehavior: "Retry deterministic steps twice; queue approval expiry after 7 days.",
        }),
      },
    ],
    triggers: [],
    coworkers: [
      {
        ...classified("recommendation", {
          key: "operations",
          name: "Operations",
          purpose: "Keep production orders moving and escalate stuck client reviews",
          workKinds: ["review_stuck_order"],
          requiredCapabilities: ["orders.read"],
          relevantEntities: ["production_order"],
          autonomyPolicy: "ask_until_trusted",
          escalation: "Escalate client reviews waiting more than 3 days",
        }),
      },
    ],
    skills: [],
    attentionRules: [
      {
        ...classified("inference", {
          key: "stuck_client_review",
          entityType: "production_order",
          condition: "stage = client_review AND waiting > 3 days",
          severity: "work",
        }),
      },
    ],
    reports: [],
    integrationRequirements: [{ capability: "drive", reason: "Automatic project folders", requiredFor: ["won_opportunity_onboarding"] }],
    permissionPolicies: [],
    autonomyPolicies: [],
    installedAppRecommendations: [],
    migrationPlan: { behavior: "Existing records retain current state", retainExistingState: true },
  };
}

function liveContext(): BlueprintLiveContext {
  return {
    capabilities: [
      { key: "orders.create", available: true, policy: "automatic" },
      { key: "orders.read", available: true, policy: "automatic" },
      { key: "email.draft", available: true, policy: "automatic" },
      { key: "email.send", available: true, policy: "approval_required" },
      { key: "drive", available: false, policy: null },
    ],
    modules: ["invoicing"],
    entityTypes: ["contact", "company", "opportunity", "production_order", "invoice"],
    routes: ["/admin/invoicing"],
  };
}

async function main() {
  // 1. Valid manufacturing blueprint parses; preflight counts match.
  const blueprint = parseBlueprint(manufacturingBlueprint());
  assert.equal(blueprint.schemaVersion, BLUEPRINT_SCHEMA_VERSION);
  const preflight = summarizePreflight(blueprint);
  assert.equal(preflight.boards, 2);
  assert.equal(preflight.workflows, 1);
  assert.equal(preflight.newEntityTypes, 1);
  assert.equal(preflight.destructiveOperations, 0);

  // 2. Classification enforced: a fact without a quote fails with field errors.
  const badFact = manufacturingBlueprint() as { evidenceRefs: Array<Record<string, unknown>> };
  badFact.evidenceRefs = [{ kind: "fact", statement: "Unquoted claim", sources: ["vibes"] }];
  const structural = validateBlueprintStructure(badFact);
  assert.equal(structural.ok, false);
  assert.ok(structural.issues.some((issue) => issue.includes("direct source quote")));

  // 3. Capability validation: blocked, approval, and ready paths.
  const validation = validateAgainstCapabilities(blueprint, liveContext());
  assert.ok(
    validation.blocked.some((item) => item.kind === "unavailable_capability" && item.key === "drive"),
    "disconnected Drive must surface as blocked",
  );
  assert.ok(
    validation.approvals.some((item) => item.key === "email.send"),
    "approval-gated send must surface as approval",
  );
  assert.ok(validation.ready.includes("workflow:won_opportunity_onboarding/step:create_project:orders.create"));

  // 4. Unknown capability fails closed instead of being approximated.
  const unknown = parseBlueprint({
    ...manufacturingBlueprint(),
    workflows: [
      {
        classification: "recommendation",
        evidence: [],
        key: "mystery",
        name: "Mystery",
        trigger: { kind: "manual", ref: "operator" },
        steps: [{ key: "s1", kind: "action", description: "Do magic", capabilityKey: "teleport.freight" }],
        requiredIntegrations: [],
        failureBehavior: "Fail loudly.",
      },
    ],
  });
  const unknownValidation = validateAgainstCapabilities(unknown, liveContext());
  assert.ok(unknownValidation.blocked.some((item) => item.kind === "unknown_capability"));

  // 5. Unknown board source and unregistered navigation targets rejected.
  const badBoard = parseBlueprint({
    ...manufacturingBlueprint(),
    boards: [
      {
        classification: "recommendation",
        evidence: [],
        key: "ghost",
        name: "Ghost",
        sourceType: "teleporter",
        groupingField: "stage",
        columns: [{ key: "c1", label: "C1", lifecycleStates: ["c1"] }],
        cardFields: [],
      },
    ],
    navigation: [{ label: "Nope", targetType: "module", targetKey: "teleportation" }],
  });
  const boardValidation = validateAgainstCapabilities(badBoard, liveContext());
  assert.ok(boardValidation.blocked.some((item) => item.kind === "unknown_entity" && item.key === "teleporter"));
  assert.ok(boardValidation.blocked.some((item) => item.kind === "unknown_navigation_target"));

  // 6. Secrets guard: credential-shaped keys refused before persistence.
  // Strict schemas refuse unknown keys and the secrets guard refuses
  // credential-shaped keys: either way the document never persists.
  assert.throws(
    () =>
      parseBlueprint({
        ...manufacturingBlueprint(),
        integrationRequirements: [
          { capability: "stripe", reason: "x", requiredFor: ["w"], api_key: "sk-live" },
        ],
      }),
    /secret|Unrecognized key/i,
  );
  assert.throws(() => assertNoSecrets({ nested: { client_secret: "abc" } }), /secret/i);

  // 7. Diff + impact: vendor-sampling revision touches boards/workflows/views.
  const revised = parseBlueprint({
    ...manufacturingBlueprint(),
    boards: (manufacturingBlueprint().boards as Array<Record<string, unknown>>).map((board) =>
      board["key"] === "production"
        ? {
            ...(board as object),
            columns: [
              { key: "vendor_sampling", label: "Vendor Sampling", lifecycleStates: ["vendor_sampling"] },
              { key: "internal_qa", label: "Internal QA", lifecycleStates: ["internal_qa"] },
              ...((board["columns"] as unknown[])?.slice(1) ?? []),
            ],
          }
        : board,
    ),
  });
  const diff = diffBlueprints(blueprint, revised);
  assert.deepEqual(diff.added, []);
  assert.deepEqual(diff.removed, []);
  assert.ok(diff.changed.includes("boards"));
  const impact = analyzeImpact(blueprint, revised);
  assert.equal(impact.requiresMigration, false);
  assert.deepEqual(impact.affectedBoards, []);

  const removed = parseBlueprint({ ...manufacturingBlueprint(), entities: [] });
  const removalImpact = analyzeImpact(blueprint, removed);
  assert.equal(removalImpact.requiresMigration, true);
  assert.ok(removalImpact.notes.some((note) => note.includes("production_order")));

  // 8. Versioned persistence: append-only, parent-linked, tenant-isolated.
  const db = fakeSupabase();
  const client = db as unknown as SupabaseClient;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const first = await saveBlueprintVersion(client, {
    tenantId: tenantA,
    document: manufacturingBlueprint(),
    changeSummary: "Initial setup",
    createdBy: "founder@example.com",
  });
  assert.equal(first.version.version, 1);
  assert.equal(first.version.parent_version, null);

  const second = await saveBlueprintVersion(client, {
    tenantId: tenantA,
    blueprintId: first.blueprintId,
    document: manufacturingBlueprint(),
    changeSummary: "Added vendor sampling stage",
    createdBy: "founder@example.com",
  });
  assert.equal(second.version.version, 2);
  assert.equal(second.version.parent_version, 1);

  const history = await listBlueprintVersions(client, {
    tenantId: tenantA,
    blueprintId: first.blueprintId,
  });
  assert.equal(history.length, 2);
  assert.equal(history[0]!.version, 2);

  const original = await getBlueprintVersion(client, {
    tenantId: tenantA,
    blueprintId: first.blueprintId,
    version: 1,
  });
  assert.equal(original.change_summary, "Initial setup");

  const latest = await getLatestBlueprintVersion(client, {
    tenantId: tenantA,
    blueprintId: first.blueprintId,
  });
  assert.equal(latest.version, 2);
  await assert.rejects(
    getLatestBlueprintVersion(client, { tenantId: tenantA, blueprintId: randomUUID() }),
    /not found/,
  );

  const foreign = await listBlueprintVersions(client, {
    tenantId: tenantB,
    blueprintId: first.blueprintId,
  });
  assert.equal(foreign.length, 0);
  await assert.rejects(
    getBlueprintVersion(client, {
      tenantId: tenantB,
      blueprintId: first.blueprintId,
      version: 1,
    }),
    /not found/,
  );

  // 9. Input guards fail closed.
  await assert.rejects(
    saveBlueprintVersion(client, {
      tenantId: "not-a-uuid",
      document: manufacturingBlueprint(),
      changeSummary: "x",
    }),
    /UUID/,
  );
  await assert.rejects(
    saveBlueprintVersion(client, {
      tenantId: tenantA,
      document: manufacturingBlueprint(),
      changeSummary: "   ",
    }),
    /changeSummary/,
  );
  await assert.rejects(
    saveBlueprintVersion(client, {
      tenantId: tenantA,
      document: { schemaVersion: "bogus" },
      changeSummary: "x",
    }),
    /Invalid WorkspaceBlueprint/,
  );

  // 10. Live-context adapter: context assembled from real registries.
  const live = fakeSupabase();
  const liveClient = live as unknown as SupabaseClient;
  live.tables.tenants = [
    { id: tenantA, config: { modules: { proposals: false } }, status: "active" },
    { id: tenantB, config: {}, status: "suspended" },
  ];
  // Capability rows are tenant-scoped in production by RLS inside the shared
  // listWorkspaceCapabilities service; the adapter maps them verbatim.
  live.tables.workspace_capabilities = [
    { capability_key: "orders.create", available: true, policy: "automatic" },
    { capability_key: "orders.read", available: true, policy: "automatic" },
    { capability_key: "email.draft", available: true, policy: "automatic" },
    { capability_key: "email.send", available: true, policy: "approval_required" },
    { capability_key: "drive", available: false, policy: null },
  ];
  live.tables.entity_types = [
    { tenant_id: tenantA, type_key: "production_order", is_disabled: false },
    { tenant_id: tenantA, type_key: "retired_type", is_disabled: true },
    { tenant_id: tenantB, type_key: "b_secret_type", is_disabled: false },
  ];

  const context = await collectBlueprintLiveContext(liveClient, tenantA);
  assert.ok(context.modules.includes("core-pipeline"), "core modules always enabled");
  assert.ok(!context.modules.includes("proposals"), "explicit module opt-out honored");
  assert.ok(!context.routes.includes("/admin/proposals"), "disabled module routes excluded");
  assert.ok(context.routes.length > 0, "active module routes collected");
  assert.ok(context.entityTypes.includes("production_order"), "registered type included");
  assert.ok(context.entityTypes.includes("contact"), "canonical core keys included");
  assert.ok(context.entityTypes.includes("opportunity"), "canonical core keys included");
  assert.ok(!context.entityTypes.includes("retired_type"), "disabled types excluded");
  assert.ok(!context.entityTypes.includes("b_secret_type"), "other-tenant types excluded");
  assert.deepEqual([...context.entityTypes].sort(), context.entityTypes);
  const driveCap = context.capabilities.find((entry) => entry.key === "drive");
  assert.equal(driveCap?.available, false);

  const liveResult = await validateBlueprintAgainstLive(liveClient, tenantA, manufacturingBlueprint());
  assert.ok(
    liveResult.validation.ready.includes("board:production"),
    "registered production_order board validates live",
  );
  assert.ok(
    liveResult.validation.ready.includes("board:sales_pipeline"),
    "core opportunity board validates live",
  );
  assert.ok(
    liveResult.validation.blocked.some((item) => item.key === "drive"),
    "disconnected Drive blocks live",
  );
  assert.ok(
    liveResult.validation.approvals.some((item) => item.key === "email.send"),
    "approval-gated send surfaces live",
  );
  assert.equal(liveResult.preflight.workflows, 1);

  await assert.rejects(collectBlueprintLiveContext(liveClient, tenantB), /not active/);
  await assert.rejects(collectBlueprintLiveContext(liveClient, randomUUID()), /unavailable/);

  // 11. Impact classification follows the authority ladder (§26).
  const impacts = classifyBlueprintImpact(blueprint);
  const levelOf = (ref: string) => impacts.find((item) => item.ref === ref)?.level;
  assert.equal(levelOf("navigation:Sales"), "low_risk");
  assert.equal(levelOf("entity:production_order"), "structural");
  assert.equal(levelOf("board:production"), "structural");
  assert.equal(levelOf("workflow:won_opportunity_onboarding"), "structural");
  assert.equal(levelOf("coworker:operations"), "structural");
  assert.equal(levelOf("integration:drive"), "external_authority");
  const gates = summarizeApprovalGates(blueprint);
  assert.ok(gates.blueprintLevel.some((item) => item.ref === "navigation:Sales"));
  assert.ok(gates.explicitWorkspaceChange.some((item) => item.ref === "board:production"));
  assert.ok(gates.externalAuthority.some((item) => item.ref === "integration:drive"));
  assert.equal(
    gates.blueprintLevel.length + gates.explicitWorkspaceChange.length + gates.externalAuthority.length,
    impacts.length,
    "every item lands in exactly one gate",
  );

  // 12. Review model projects validation state per section.
  const review = buildReviewModel(blueprint, validation);
  assert.equal(review.businessSummary, blueprint.businessSummary);
  assert.ok(review.boards.some((board) => board.ref === "board:production" && board.status === "ready"));
  assert.ok(review.workflows.some((flow) => flow.status === "approval"), "email.send gates the workflow");
  assert.ok(
    review.integrations.some((item) => item.ref === "integration:drive" && item.status === "blocked"),
  );
  assert.ok(review.questions.length === 2, "unresolved question plus assumption surface");
  assert.equal(review.blockedCount, validation.blocked.length);
  assert.equal(review.preflight.boards, 2);

  // 13. Blueprint listing is tenant-scoped and ordered.
  const store = fakeSupabase();
  const storeClient = store as unknown as SupabaseClient;
  store.tables.workspace_blueprints = [
    { id: randomUUID(), tenant_id: tenantA, title: "A", status: "draft", latest_version: 1, updated_at: "2026-09-02T00:00:00.000Z" },
    { id: randomUUID(), tenant_id: tenantA, title: "B", status: "draft", latest_version: 1, updated_at: "2026-09-03T00:00:00.000Z" },
    { id: randomUUID(), tenant_id: tenantB, title: "Foreign", status: "draft", latest_version: 1, updated_at: "2026-09-04T00:00:00.000Z" },
  ];
  const listed = await listBlueprints(storeClient, tenantA);
  assert.equal(listed.length, 2);
  assert.equal(listed[0]!.title, "B", "newest first");
  assert.ok(listed.every((row) => row.id && row.status === "draft"));

  console.log("test:workspace-blueprint passed (13 groups)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
