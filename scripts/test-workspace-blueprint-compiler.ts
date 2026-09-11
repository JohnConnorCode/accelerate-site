#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BLUEPRINT_SCHEMA_VERSION,
  parseBlueprint,
} from "../src/lib/revenue-os/workspace-blueprint";
import {
  applyApprovedBlueprint,
  approveBlueprint,
  compileBlueprintPlan,
} from "../src/lib/revenue-os/workspace-blueprint-compiler";

type FakeRow = Record<string, unknown>;

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
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
        table.push(row);
      }
      return this.insertRows;
    }
    if (this.updatePatch) {
      const rows = this.applyFilters(table);
      for (const row of rows) Object.assign(row, this.updatePatch);
      return rows;
    }
    return this.applyFilters(table);
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
    onfulfilled?:
      ((value: { data: FakeRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
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

const classified = {
  classification: "recommendation" as const,
  evidence: [
    {
      kind: "inference" as const,
      statement: "Welcome email follows a won job",
      sources: ["founder interview"],
    },
  ],
};

function sampleBlueprint(extra: Record<string, unknown> = {}) {
  return parseBlueprint({
    schemaVersion: BLUEPRINT_SCHEMA_VERSION,
    businessSummary: "Won jobs start a welcome sequence using existing mail tools.",
    navigation: [{ label: "Money", targetType: "module", targetKey: "invoicing" }],
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
    ...extra,
  });
}

function liveContext(overrides: Partial<Parameters<typeof compileBlueprintPlan>[1]> = {}) {
  return {
    capabilities: [
      { key: "email.draft", available: true, policy: "automatic" as const },
      { key: "email.send", available: true, policy: "approval_required" as const },
    ],
    modules: ["core-pipeline", "stripe-invoicing"],
    entityTypes: ["opportunity", "contact"],
    routes: ["/admin/pipeline", "/admin/invoicing"],
    ...overrides,
  };
}

async function main() {
  const blueprint = sampleBlueprint();

  const resolved = compileBlueprintPlan(blueprint, liveContext());
  assert.equal(resolved.canApply, true);
  assert.ok(resolved.ready.some((item) => item.key === "email.draft"));
  assert.ok(resolved.approvals.some((item) => item.key === "email.send"));
  assert.equal(resolved.customAppBriefs.length, 0);
  assert.ok(resolved.moduleTargets.includes("stripe-invoicing"));

  const unknown = compileBlueprintPlan(
    sampleBlueprint({
      workflows: [
        {
          ...classified,
          key: "mystery",
          name: "Mystery",
          trigger: { kind: "manual", ref: "operator" },
          steps: [
            {
              key: "teleport",
              kind: "action",
              description: "Do magic",
              capabilityKey: "teleport.freight",
            },
          ],
          requiredIntegrations: [],
          failureBehavior: "Fail loudly.",
        },
      ],
    }),
    liveContext(),
  );
  assert.equal(
    unknown.canApply,
    true,
    "unsupported requirements escalate instead of blocking apply",
  );
  assert.equal(unknown.customAppBriefs.length, 1);
  assert.equal(unknown.customAppBriefs[0]!.missingKey, "teleport.freight");
  assert.match(unknown.customAppBriefs[0]!.boundary, /existing/i);

  const blocked = compileBlueprintPlan(
    blueprint,
    liveContext({
      capabilities: [
        { key: "email.draft", available: true, policy: "automatic" },
        { key: "email.send", available: false, policy: null },
      ],
    }),
  );
  assert.equal(blocked.canApply, false);
  assert.ok(blocked.blocked.some((item) => item.key === "email.send"));

  const db = fakeSupabase();
  const client = db as unknown as SupabaseClient;
  const tenantId = randomUUID();
  const blueprintId = randomUUID();
  db.tables.workspace_blueprints = [
    {
      id: blueprintId,
      tenant_id: tenantId,
      title: "Welcome",
      status: "draft",
      latest_version: 1,
    },
  ];
  db.tables.workspace_blueprint_versions = [
    {
      tenant_id: tenantId,
      blueprint_id: blueprintId,
      version: 1,
      parent_version: null,
      document: blueprint,
      change_summary: "Initial",
    },
  ];
  db.tables.workspace_blueprint_applies = [];
  db.tables.tenants = [{ id: tenantId, config: { modules: {} }, status: "active" }];
  db.tables.workspace_capabilities = liveContext().capabilities.map((capability) => ({
    capability_key: capability.key,
    available: capability.available,
    policy: capability.policy,
  }));
  db.tables.entity_types = [];

  await assert.rejects(
    applyApprovedBlueprint(client, {
      tenantId,
      blueprintId,
      version: 1,
      requestKey: randomUUID(),
      actorEmail: "founder@example.com",
    }),
    /approved/,
  );

  const approved = await approveBlueprint(client, {
    tenantId,
    blueprintId,
    version: 1,
    actorEmail: "founder@example.com",
  });
  assert.equal(approved.status, "approved");

  const proposed: Array<{ actionType: string; dedupeKey?: string }> = [];
  const enabled: string[] = [];
  const adapters = {
    collectContext: async () => liveContext(),
    proposeAction: async (
      _db: SupabaseClient,
      input: { actionType: string; dedupeKey?: string },
    ) => {
      proposed.push(input);
      return { id: randomUUID() };
    },
    enableModule: async (_db: SupabaseClient, moduleId: string) => {
      enabled.push(moduleId);
    },
  };

  const requestKey = randomUUID();
  const first = await applyApprovedBlueprint(
    client,
    {
      tenantId,
      blueprintId,
      version: 1,
      requestKey,
      actorEmail: "founder@example.com",
    },
    adapters,
  );
  assert.equal(first.replayed, false);
  assert.ok(first.receipt.approvals.some((item) => item.key === "email.send"));
  assert.equal(proposed.length, 1);
  assert.equal(proposed[0]!.actionType, "apply_blueprint_step");
  assert.ok(proposed[0]!.dedupeKey?.includes(blueprintId));
  assert.ok(enabled.includes("stripe-invoicing"));
  assert.equal((db.tables.workspace_blueprints[0] as { status: string }).status, "applied");

  const second = await applyApprovedBlueprint(
    client,
    {
      tenantId,
      blueprintId,
      version: 1,
      requestKey,
      actorEmail: "founder@example.com",
    },
    adapters,
  );
  assert.equal(second.replayed, true);
  assert.equal(proposed.length, 1, "idempotent replay must not duplicate approval proposals");
  assert.equal(enabled.length, 1, "idempotent replay must not re-enable modules");

  const blockedDb = fakeSupabase();
  blockedDb.tables.workspace_blueprints = [
    {
      id: blueprintId,
      tenant_id: tenantId,
      title: "Welcome",
      status: "approved",
      latest_version: 1,
    },
  ];
  blockedDb.tables.workspace_blueprint_versions = [
    {
      tenant_id: tenantId,
      blueprint_id: blueprintId,
      version: 1,
      document: blueprint,
    },
  ];
  blockedDb.tables.workspace_blueprint_applies = [];
  await assert.rejects(
    applyApprovedBlueprint(
      blockedDb as unknown as SupabaseClient,
      {
        tenantId,
        blueprintId,
        version: 1,
        requestKey: randomUUID(),
        actorEmail: "founder@example.com",
      },
      {
        ...adapters,
        collectContext: async () =>
          liveContext({
            capabilities: [
              { key: "email.draft", available: true, policy: "automatic" },
              { key: "email.send", available: false, policy: null },
            ],
          }),
      },
    ),
    /blocked/,
  );

  console.log("test:workspace-blueprint-compiler passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
