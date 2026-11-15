#!/usr/bin/env tsx
/**
 * command-board-graph-adapters acceptance battery (AC1-AC3, local).
 *
 * In-memory Supabase with a fresh fixture per section and the non-ambient
 * tenant binding used by real clients. Two tenants share colliding record ids
 * so every adapter must carry its own explicit tenant filter. Covers the
 * claimed registry and fail-closed role check (AC1), route/tool/MCP/demo
 * parity with caps and cursors (AC2), and tenant isolation plus disabled
 * modules (AC3).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import {
  getTenantRequestContext,
  runWithTenantRequestContext,
  type TenantActorContext,
} from "../src/lib/tenancy/context";
import { COMMAND_BOARD_MODES } from "../src/lib/revenue-os/command-board-modes";
import {
  boardNodeId,
  type CommandBoardSnapshot,
} from "../src/lib/revenue-os/command-board-contract";
import {
  GRAPH_ADAPTERS,
  GraphInputError,
  readWorkspaceGraph,
} from "../src/lib/revenue-os/graph-adapters";
import {
  GRAPH_ADAPTER_NAMES,
  GRAPH_MAX_EDGES,
  GRAPH_MAX_NODES,
  GRAPH_PROJECTIONS,
  assembleWorkspaceGraph,
  keysetPage,
  isOpenGraphRow,
  workspaceGraphInputFromQuery,
  type WorkspaceGraph,
  type WorkspaceGraphNode,
} from "../src/lib/revenue-os/graph-adapter-contract";
import {
  GRAPH_ADAPTER_TO_MODULE_MAP,
  REVENUE_OS_MODULES,
  isGraphAdapterModuleEnabled,
} from "../src/lib/revenue-os/modules";
import {
  authorizeGraphSource,
  type RecordPermissionPrincipal,
} from "../src/lib/revenue-os/record-permissions";
import { buildRecordPermissionReference } from "../src/lib/revenue-os/record-permission-reference";
import {
  executeRegisteredRevenueTool,
  listRevenueAiCapabilities,
} from "../src/lib/revenue-os/ai-tools";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { listTasks } from "../src/lib/revenue-os/tasks";
import { listContacts } from "../src/lib/revenue-os/records";
import { listActions } from "../src/lib/revenue-os/actions";
import { installAdminDemoRuntime } from "../src/lib/admin/demo/runtime";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";

const id = (prefix: string, n: number) =>
  `00000000-0000-4000-${prefix}-${String(n).padStart(12, "0")}`;
const TENANT_A = id("a000", 1);
const TENANT_B = id("b000", 1);
const USER = {
  admin: id("c000", 1),
  member: id("c000", 2),
  revoked: id("c000", 3),
  invited: id("c000", 4),
  adminB: id("c000", 5),
};
// Colliding ids: the same UUID exists in both tenants.
const C1 = id("8001", 1);
const C2 = id("8001", 2);
const C_B_ONLY = id("8001", 9);
const CO1 = id("8002", 1);
const O1 = id("8003", 1);
const T1 = id("8004", 1);
const T2 = id("8004", 2);
const A_PENDING = id("8005", 1);
const A_EXPIRED = id("8005", 2);
const A_INVOICE = id("8005", 3);
const A_OTHER = id("8005", 4);
const V1 = id("8006", 1);
const K1 = id("8007", 1);
const OB1 = id("8008", 1);

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();
const plugins = { "receivables-collections": true, "stripe-invoicing": true };

const checks: string[] = [];
const check = (name: string) => checks.push(name);

function tenantRows(tenant: string, label: string): Record<string, Row[]> {
  return {
    contacts: [
      {
        id: C1,
        tenant_id: tenant,
        full_name: `${label} Customer`,
        primary_email: `customer@${label.toLowerCase()}.example`,
        lifecycle_stage: "customer",
        company_id: CO1,
        updated_at: "2026-11-01T00:00:00Z",
      },
      ...(tenant === TENANT_A
        ? [
            {
              id: C2,
              tenant_id: tenant,
              full_name: "Second Contact",
              primary_email: "second@a.example",
              lifecycle_stage: "lead",
              company_id: null,
              updated_at: "2026-11-02T00:00:00Z",
            },
          ]
        : [
            {
              id: C_B_ONLY,
              tenant_id: tenant,
              full_name: "Only In B",
              primary_email: "only@b.example",
              lifecycle_stage: "lead",
              company_id: null,
              updated_at: "2026-11-02T00:00:00Z",
            },
          ]),
    ],
    companies: [{ id: CO1, tenant_id: tenant, name: `${label} Co`, domain: `${label}.example` }],
    opportunities: [
      {
        id: O1,
        tenant_id: tenant,
        name: `${label} Deal`,
        stage: "proposal",
        contact_id: C1,
        company_id: CO1,
      },
    ],
    tasks: [
      {
        id: T1,
        tenant_id: tenant,
        title: `${label} follow up`,
        status: "pending",
        due_date: "2026-11-20",
        related_type: "contact",
        related_id: C1,
        opportunity_id: null,
        contact_id: null,
        created_at: "2026-11-01T00:00:00Z",
      },
      {
        id: T2,
        tenant_id: tenant,
        title: `${label} send proposal`,
        status: "completed",
        due_date: null,
        related_type: null,
        related_id: null,
        opportunity_id: O1,
        contact_id: null,
        created_at: "2026-11-02T00:00:00Z",
      },
    ],
    action_queue: [
      {
        id: A_PENDING,
        tenant_id: tenant,
        title: `${label} approve reply`,
        action_type: "send_gmail_reply",
        status: "pending",
        entity_type: "contact",
        entity_id: C1,
        expires_at: future,
        created_at: "2026-11-03T00:00:00Z",
        payload: {},
      },
      {
        id: A_EXPIRED,
        tenant_id: tenant,
        title: "Expired proposal",
        action_type: "update_task",
        status: "pending",
        entity_type: "task",
        entity_id: T1,
        expires_at: past,
        created_at: "2026-11-02T00:00:00Z",
        payload: {},
      },
      {
        id: A_INVOICE,
        tenant_id: tenant,
        title: `${label} invoice draft`,
        action_type: "create_stripe_invoice_draft",
        status: "executed",
        entity_type: null,
        entity_id: null,
        expires_at: null,
        created_at: "2026-11-01T00:00:00Z",
        payload: { contactId: C1, lines: [{ description: "Work", amount: 100 }] },
      },
      {
        id: A_OTHER,
        tenant_id: tenant,
        title: "Executed task",
        action_type: "create_task",
        status: "executed",
        entity_type: "contact",
        entity_id: C1,
        expires_at: null,
        created_at: "2026-11-01T00:00:00Z",
        payload: {},
      },
    ],
    conversations: [
      {
        id: V1,
        tenant_id: tenant,
        channel: "gmail",
        subject: `${label} question`,
        status: "open",
        contact_id: C1,
        company_id: null,
        opportunity_id: O1,
        unread_count: 1,
        last_message_at: "2026-11-04T00:00:00Z",
        metadata: {},
      },
    ],
    collection_cases: [
      {
        id: K1,
        tenant_id: tenant,
        contact_id: C1,
        currency: "usd",
        status: "open",
        revision: 1,
        disputed: false,
        paused: false,
        updated_at: "2026-11-05T00:00:00Z",
        next_action: "Review overdue invoices",
      },
    ],
    collection_case_invoices: [
      { tenant_id: tenant, case_id: K1, creation_action_id: A_INVOICE, observation_id: OB1 },
    ],
    collection_observations: [
      {
        id: OB1,
        tenant_id: tenant,
        invoice_id: "in_fictional",
        remaining: 100,
        status: "open",
        due_date: "2026-10-01",
        observed_at: "2026-11-05T00:00:00Z",
      },
    ],
  };
}

function fixture(
  configA: Record<string, unknown> = { modules: plugins },
  extra: Record<string, Row[]> = {},
) {
  const a = tenantRows(TENANT_A, "Alpha");
  const b = tenantRows(TENANT_B, "Beta");
  const merged: Record<string, Row[]> = {};
  for (const table of new Set([...Object.keys(a), ...Object.keys(b)]))
    merged[table] = [...(a[table] ?? []), ...(b[table] ?? [])];
  return new MemorySupabase({
    ...merged,
    ...extra,
    tenants: [
      { id: TENANT_A, status: "active", config: configA },
      { id: TENANT_B, status: "active", config: { modules: plugins } },
    ],
    tenant_memberships: [
      {
        tenant_id: TENANT_A,
        user_id: USER.admin,
        invited_email: "admin@a.example",
        status: "active",
        role: "admin",
      },
      // Synthetic lesser role: the schema allows only admin today, so this proves fail-closed.
      {
        tenant_id: TENANT_A,
        user_id: USER.member,
        invited_email: "member@a.example",
        status: "active",
        role: "member",
      },
      {
        tenant_id: TENANT_A,
        user_id: USER.revoked,
        invited_email: "revoked@a.example",
        status: "revoked",
        role: "admin",
      },
      {
        tenant_id: TENANT_A,
        user_id: USER.invited,
        invited_email: "invited@a.example",
        status: "invited",
        role: "admin",
      },
      {
        tenant_id: TENANT_B,
        user_id: USER.adminB,
        invited_email: "admin@b.example",
        status: "active",
        role: "admin",
      },
    ],
    entity_links: [
      {
        id: id("8009", 1),
        tenant_id: TENANT_A,
        source_type: "contact",
        source_id: C1,
        target_type: "opportunity",
        target_id: O1,
        link_type: "champion",
        metadata: {},
      },
      // A foreign tenant's link naming tenant A's ids must never become an edge.
      {
        id: id("8009", 2),
        tenant_id: TENANT_B,
        source_type: "contact",
        source_id: C2,
        target_type: "company",
        target_id: CO1,
        link_type: "foreign_link",
        metadata: {},
      },
    ],
  });
}

const bound = (mem: MemorySupabase, tenant: string) =>
  bindTenantDatabaseForTest(mem.client as never, tenant) as SupabaseClient;
const member = (userId: string, email = "actor@example.test"): RecordPermissionPrincipal => ({
  kind: "workspace_member",
  email,
  userId,
});
const ids = (graph: WorkspaceGraph) => new Set(graph.nodes.map((node) => node.id));
const edgeKeys = (graph: WorkspaceGraph) =>
  new Set(graph.edges.map((edge) => `${edge.from} ${edge.relation} ${edge.to}`));
const source = (graph: WorkspaceGraph, name: string) =>
  graph.sources.find((receipt) => receipt.adapter === name)!;
const RECORD_TABLES = [
  "contacts",
  "companies",
  "opportunities",
  "tasks",
  "action_queue",
  "conversations",
  "collection_cases",
  "entity_links",
];

async function main() {
  // ---------------------------------------------------------------- AC1
  assert.deepEqual(
    GRAPH_ADAPTERS.map((adapter) => adapter.name),
    [...GRAPH_ADAPTER_NAMES],
    "one registry lists every adapter exactly once",
  );
  const owners = Object.fromEntries(
    GRAPH_ADAPTER_NAMES.map((name) => [name, GRAPH_ADAPTER_TO_MODULE_MAP.get(name)?.id]),
  );
  assert.deepEqual(owners, {
    contacts: "core-contacts",
    companies: "core-contacts",
    opportunities: "core-pipeline",
    tasks: "core-command",
    approvals: "core-command",
    conversations: "core-conversations",
    collection_cases: "receivables-collections",
    invoice_drafts: "stripe-invoicing",
  });
  for (const name of GRAPH_ADAPTER_NAMES)
    assert.equal(
      REVENUE_OS_MODULES.filter((mod) => mod.graphAdapterNames?.includes(name)).length,
      1,
      `${name} must be claimed by exactly one module`,
    );
  for (const adapter of GRAPH_ADAPTERS)
    assert.equal(
      adapter.project,
      GRAPH_PROJECTIONS[adapter.name],
      "the demo runtime reuses the live adapter's pure projection",
    );
  check("single-claimed-registry");

  assert.equal(isGraphAdapterModuleEnabled("unclaimed_source").enabled, false);
  {
    const mem = fixture();
    const refused = await authorizeGraphSource(bound(mem, TENANT_A), {
      principal: member(USER.admin),
      adapter: "unclaimed_source",
    });
    assert.equal(refused.allowed, false);
    assert.equal((refused as { code: string }).code, "entity_unknown");
    assert.throws(
      () => workspaceGraphInputFromQuery(new URLSearchParams("adapters=unclaimed_source")),
      ZodError,
    );
  }
  check("unclaimed-adapter-refused");

  {
    const reference = buildRecordPermissionReference();
    const committed = JSON.parse(
      readFileSync("docs/generated/record-permission-reference.json", "utf8"),
    );
    assert.deepEqual(committed, reference, "regenerate the record permission reference");
    assert.equal(reference.graphAdapterGrants.length, GRAPH_ADAPTER_NAMES.length);
  }
  check("permission-reference-lists-graph-grants");

  // Fail-closed roles: synthetic member, revoked and invited memberships.
  for (const [userId, code] of [
    [USER.member, "role_insufficient"],
    [USER.revoked, "membership_revoked"],
    [USER.invited, "membership_revoked"],
    [id("c000", 99), "membership_revoked"],
  ] as const) {
    const mem = fixture();
    const graph = await readWorkspaceGraph(bound(mem, TENANT_A), member(userId), {});
    assert.equal(graph.nodes.length, 0, `${code}: no nodes`);
    assert.equal(graph.edges.length, 0);
    assert.equal(graph.links.state, "skipped");
    for (const receipt of graph.sources) {
      assert.equal(receipt.state, "denied", `${receipt.adapter} must deny ${userId}`);
      assert.equal(receipt.reason, code);
    }
    for (const table of RECORD_TABLES)
      assert.ok(!mem.queryTables.includes(table), `${code}: ${table} must not be read`);
  }
  check("non-admin-member-revoked-invited-denied-zero-nodes");

  // ---------------------------------------------------------------- AC3
  {
    const mem = fixture();
    // Reads lazily create empty tables in the harness; compare seeded tables only.
    const seeded = Object.keys(mem.tables);
    const snapshot = () => JSON.stringify(seeded.map((table) => mem.tables[table]));
    const before = snapshot();
    const graph = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    assert.ok(graph.sources.every((receipt) => receipt.state === "ready"));
    const nodes = ids(graph);
    for (const expected of [
      `contact:${C1}`,
      `contact:${C2}`,
      `company:${CO1}`,
      `opportunity:${O1}`,
      `task:${T1}`,
      `task:${T2}`,
      `action_queue:${A_PENDING}`,
      `action_queue:${A_INVOICE}`,
      `conversation:${V1}`,
      `collection_case:${K1}`,
    ])
      assert.ok(nodes.has(expected), `missing ${expected}`);
    assert.ok(!nodes.has(`action_queue:${A_EXPIRED}`), "expired approvals stay out");
    assert.ok(!nodes.has(`action_queue:${A_OTHER}`), "executed non-invoice actions stay out");
    assert.ok(!nodes.has(`contact:${C_B_ONLY}`), "tenant B rows never appear");
    const contact = graph.nodes.find((node) => node.id === `contact:${C1}`)!;
    assert.equal(contact.label, "Alpha Customer", "colliding ids resolve to the bound tenant row");
    assert.ok(graph.nodes.every((node) => !/Beta|Only In B/.test(node.label)));
    const edges = edgeKeys(graph);
    for (const expected of [
      `opportunity:${O1} contact contact:${C1}`,
      `opportunity:${O1} company company:${CO1}`,
      `contact:${C1} works_at company:${CO1}`,
      `task:${T1} related contact:${C1}`,
      `task:${T2} opportunity opportunity:${O1}`,
      `action_queue:${A_PENDING} about contact:${C1}`,
      `conversation:${V1} contact contact:${C1}`,
      `conversation:${V1} opportunity opportunity:${O1}`,
      `collection_case:${K1} billing_contact contact:${C1}`,
      `collection_case:${K1} invoice action_queue:${A_INVOICE}`,
      `action_queue:${A_INVOICE} customer contact:${C1}`,
      `contact:${C1} champion opportunity:${O1}`,
    ])
      assert.ok(edges.has(expected), `missing edge ${expected}`);
    assert.ok(
      graph.edges.every((edge) => edge.relation !== "foreign_link"),
      "a tenant-B link naming tenant-A ids yields no edge",
    );
    assert.equal(graph.links.state, "ready");
    // Status is a display copy of the source read; nothing was written or swept.
    const pendingTask = graph.nodes.find((node) => node.id === `task:${T2}`)!;
    assert.equal(pendingTask.status, "completed");
    assert.equal(snapshot(), before, "a graph read never writes");
    assert.ok(
      Object.keys(mem.tables)
        .filter((table) => !seeded.includes(table))
        .every((table) => mem.tables[table]!.length === 0),
      "no rows were created anywhere",
    );
    assert.equal(
      mem.rows("action_queue").find((row) => row.id === A_EXPIRED)!.status,
      "pending",
      "the graph does not sweep expired proposals",
    );
    for (const node of graph.nodes) assert.equal(node.id, `${node.sourceType}:${node.sourceId}`);
  }
  check("tenant-a-colliding-ids-isolated");

  {
    const mem = fixture();
    const graph = await readWorkspaceGraph(bound(mem, TENANT_B), member(USER.adminB), {});
    const nodes = ids(graph);
    assert.ok(nodes.has(`contact:${C_B_ONLY}`));
    assert.ok(!nodes.has(`contact:${C2}`), "tenant A rows never appear for tenant B");
    assert.equal(graph.nodes.find((node) => node.id === `contact:${C1}`)!.label, "Beta Customer");
    assert.ok(graph.edges.every((edge) => edge.relation !== "champion"));
    // The tenant A admin has no membership in tenant B.
    const crossed = await readWorkspaceGraph(bound(mem, TENANT_B), member(USER.admin), {});
    assert.equal(crossed.nodes.length, 0);
    assert.ok(crossed.sources.every((receipt) => receipt.reason === "membership_revoked"));
  }
  check("tenant-b-isolated-and-no-cross-membership");

  {
    const mem = fixture();
    const graph = await readWorkspaceGraph(mem.client as never, member(USER.admin), {});
    assert.equal(graph.nodes.length, 0);
    assert.ok(graph.sources.every((receipt) => receipt.reason === "tenant_unknown_or_suspended"));
    for (const table of RECORD_TABLES)
      assert.ok(!mem.queryTables.includes(table), `unbound client must not read ${table}`);
    const suspended = fixture();
    suspended.tables.tenants![0]!.status = "suspended";
    const denied = await readWorkspaceGraph(bound(suspended, TENANT_A), member(USER.admin), {});
    assert.equal(denied.nodes.length, 0);
  }
  check("unbound-and-suspended-get-nothing");

  for (const [disabled, adapter] of [
    ["receivables-collections", "collection_cases"],
    ["stripe-invoicing", "invoice_drafts"],
  ] as const) {
    const mem = fixture({ modules: { ...plugins, [disabled]: false } });
    const graph = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    for (const receipt of graph.sources)
      assert.equal(
        receipt.state,
        receipt.adapter === adapter ? "module_disabled" : "ready",
        `${disabled} off must omit only ${adapter}`,
      );
    assert.ok(graph.nodes.every((node) => node.adapter !== adapter));
    assert.ok(graph.nodes.length > 0, "other adapters still contribute");
  }
  {
    // Core modules cannot be disabled by configuration.
    const mem = fixture({ modules: { ...plugins, "core-contacts": false } });
    const graph = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    assert.equal(source(graph, "contacts").state, "ready");
  }
  check("disabled-module-omits-only-its-adapter");

  {
    const mem = fixture();
    mem.fail("conversations", { message: "controlled outage" });
    const graph = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    assert.equal(source(graph, "conversations").state, "unavailable");
    assert.equal(source(graph, "conversations").reason, "source_read_failed");
    assert.ok(graph.nodes.every((node) => node.adapter !== "conversations"));
    assert.ok(graph.sources.filter((r) => r.state === "ready").length === 7);
    mem.recover("conversations");
    mem.fail("entity_links", { message: "controlled outage" });
    const degraded = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    assert.equal(degraded.links.state, "unavailable");
    assert.ok(degraded.nodes.length > 0);
    assert.equal(
      source(degraded, "conversations").state,
      "ready",
      "a retry after recovery reads again",
    );
    mem.recover("entity_links");
    // Reads are replay-safe: the same request returns the same graph.
    const first = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    const replay = await readWorkspaceGraph(bound(mem, TENANT_A), member(USER.admin), {});
    assert.deepEqual(replay, first);
    assert.equal(first.links.state, "ready");
  }
  check("failed-source-receipt-safe-retry-and-replay");

  // ---------------------------------------------------------------- AC2
  {
    const mem = fixture();
    const db = bound(mem, TENANT_A);
    const exact = await readWorkspaceGraph(db, member(USER.admin), {
      ids: [`contact:${C1}`, `opportunity:${O1}`],
    });
    assert.deepEqual([...ids(exact)].sort(), [`contact:${C1}`, `opportunity:${O1}`].sort());
    assert.ok(edgeKeys(exact).has(`opportunity:${O1} contact contact:${C1}`));

    const around = await readWorkspaceGraph(db, member(USER.admin), {
      relatedTo: `contact:${C1}`,
    });
    const near = ids(around);
    for (const expected of [
      `contact:${C1}`,
      `company:${CO1}`,
      `opportunity:${O1}`,
      `task:${T1}`,
      `action_queue:${A_PENDING}`,
      `action_queue:${A_INVOICE}`,
      `conversation:${V1}`,
      `collection_case:${K1}`,
    ])
      assert.ok(near.has(expected), `relatedTo must include ${expected}`);
    assert.ok(!near.has(`contact:${C2}`), "unrelated records stay out of a neighbourhood");
    assert.ok(!near.has(`task:${T2}`), "tasks of other records stay out");
    await assert.rejects(
      () => readWorkspaceGraph(db, member(USER.admin), { ids: ["contact:not-a-record"] }),
      GraphInputError,
    );
    await assert.rejects(
      () => readWorkspaceGraph(db, member(USER.admin), { limit: 201 }),
      ZodError,
    );
  }
  check("ids-and-relatedTo-windows");

  // open: true keeps work in progress through each owning service; nodes carry
  // the record's own date and attention signal and open the exact record.
  {
    const mem = fixture();
    mem.rows("opportunities").push({
      id: id("8003", 9),
      tenant_id: TENANT_A,
      name: "Alpha Lost Deal",
      stage: "lost",
      contact_id: C1,
      company_id: CO1,
    });
    mem.rows("conversations").push({
      id: id("8006", 9),
      tenant_id: TENANT_A,
      subject: "Alpha resolved thread",
      channel: "email",
      status: "resolved",
      unread_count: 0,
      contact_id: null,
      company_id: null,
      opportunity_id: null,
    });
    const db = bound(mem, TENANT_A);
    const adapters = ["tasks", "opportunities", "conversations", "approvals"] as const;
    const everything = await readWorkspaceGraph(db, member(USER.admin), {
      adapters: [...adapters],
    });
    const open = await readWorkspaceGraph(db, member(USER.admin), {
      adapters: [...adapters],
      open: true,
      links: false,
    });
    for (const closed of [
      `task:${T2}`,
      `opportunity:${id("8003", 9)}`,
      `conversation:${id("8006", 9)}`,
    ]) {
      assert.ok(ids(everything).has(closed), `${closed} is read without open`);
      assert.ok(!ids(open).has(closed), `${closed} is not open`);
    }
    assert.ok(
      open.nodes.every((node) =>
        isOpenGraphRow(node.adapter, { status: node.status, stage: node.status }),
      ),
    );
    assert.equal(open.links.state, "skipped", "links: false skips stored links");
    const task = open.nodes.find((node) => node.id === `task:${T1}`)!;
    assert.deepEqual(
      [task.dueAt, task.attention, task.href],
      ["2026-11-20", false, `/admin/work?task=${T1}`],
    );
    const approval = open.nodes.find((node) => node.id === `action_queue:${A_PENDING}`)!;
    assert.equal(approval.attention, true, "a pending approval asks for a person");
    const thread = open.nodes.find((node) => node.id === `conversation:${V1}`)!;
    assert.deepEqual([thread.attention, thread.href], [true, `/admin/conversations?thread=${V1}`]);
    assert.deepEqual(workspaceGraphInputFromQuery(new URLSearchParams("open=true&links=false")), {
      open: true,
      links: false,
    });
  }
  check("open-filter-and-node-signals");

  {
    const mem = fixture();
    const many = Array.from({ length: 260 }, (_, index) => ({
      id: id("9001", index + 1),
      tenant_id: TENANT_A,
      full_name: `Bulk ${index}`,
      primary_email: `bulk${index}@a.example`,
      company_id: null,
    }));
    mem.tables.contacts!.push(...many);
    mem.tables.companies!.push(
      ...Array.from({ length: 260 }, (_, index) => ({
        id: id("9002", index + 1),
        tenant_id: TENANT_A,
        name: `Company ${index}`,
      })),
    );
    mem.tables.tasks!.push(
      ...Array.from({ length: 260 }, (_, index) => ({
        id: id("9003", index + 1),
        tenant_id: TENANT_A,
        title: `Task ${index}`,
        status: "pending",
      })),
    );
    const db = bound(mem, TENANT_A);
    const defaults = await readWorkspaceGraph(db, member(USER.admin), { adapters: ["contacts"] });
    assert.equal(defaults.nodes.length, 50, "default 50 per adapter");
    assert.equal(source(defaults, "contacts").truncated, true);
    const first = await readWorkspaceGraph(db, member(USER.admin), {
      adapters: ["contacts"],
      limit: 200,
    });
    assert.equal(first.nodes.length, 200, "max 200 per adapter");
    const cursor = source(first, "contacts").nextCursor;
    assert.equal(cursor, first.nodes[199]!.sourceId);
    assert.equal(first.truncated.sources, true);
    const second = await readWorkspaceGraph(db, member(USER.admin), {
      adapters: ["contacts"],
      limit: 200,
      cursors: { contacts: cursor! },
    });
    assert.equal(second.nodes.length, 62);
    assert.equal(source(second, "contacts").truncated, false);
    assert.equal(source(second, "contacts").nextCursor, null);
    const seen = [...first.nodes, ...second.nodes].map((node) => node.sourceId);
    assert.equal(new Set(seen).size, 262, "keyset pages never overlap or skip");

    const capped = await readWorkspaceGraph(db, member(USER.admin), {
      adapters: ["contacts", "companies", "tasks"],
      limit: 200,
    });
    assert.equal(capped.nodes.length, GRAPH_MAX_NODES, "500 nodes per response");
    assert.equal(capped.truncated.nodes, true);

    const nodes: WorkspaceGraphNode[] = Array.from({ length: 60 }, (_, index) => ({
      id: `contact:${index}`,
      sourceType: "contact",
      sourceId: String(index),
      kind: "contact",
      adapter: "contacts",
      label: "x",
      detail: null,
      status: null,
      dueAt: null,
      attention: false,
      href: null,
    }));
    const edges = nodes.flatMap((from) =>
      nodes
        .filter((to) => to.id !== from.id)
        .map((to) => ({
          id: `${from.id}|r|${to.id}`,
          from: from.id,
          to: to.id,
          relation: "r",
          origin: "record" as const,
        })),
    );
    const assembled = assembleWorkspaceGraph({
      projections: [{ nodes, edges }],
      sources: [],
      links: { state: "skipped", truncated: false },
      perAdapter: 50,
    });
    assert.equal(assembled.edges.length, GRAPH_MAX_EDGES, "1,000 edges per response");
    assert.equal(assembled.truncated.edges, true);
    assert.deepEqual(keysetPage([{ id: "a" }, { id: "b" }], 1), {
      rows: [{ id: "a" }],
      truncated: true,
      nextCursor: "a",
    });
  }
  check("caps-and-keyset-cursors");

  {
    const mem = fixture();
    const db = bound(mem, TENANT_A);
    const input = { relatedTo: `contact:${C1}`, limit: 20 };
    const service = await readWorkspaceGraph(db, member(USER.admin), input);
    const actor: TenantActorContext = {
      kind: "actor",
      tenant: { id: TENANT_A, slug: "alpha", name: "Alpha", status: "active", config: {} },
      user: { id: USER.admin, email: "admin@a.example" },
      role: "admin",
      isPlatformAdmin: false,
      database: db,
    };
    const tool = await runWithTenantRequestContext(actor, () =>
      executeRegisteredRevenueTool(
        { supabase: db, actorEmail: "admin@a.example", tenantConfig: { modules: plugins } },
        "get_workspace_graph",
        input,
      ),
    );
    assert.deepEqual(tool.output, service, "the tool returns the same graph as the service");
    assert.equal(tool.tool.impact, "read");
    assert.equal(tool.tool.operation?.id, "workspace.graph.read");
    // The tool resolves its principal from request context, never from input.
    const memberActor = { ...actor, user: { id: USER.member, email: "member@a.example" } };
    const refused = await runWithTenantRequestContext(memberActor, () =>
      executeRegisteredRevenueTool(
        { supabase: db, actorEmail: "member@a.example", tenantConfig: { modules: plugins } },
        "get_workspace_graph",
        input,
      ),
    );
    assert.equal((refused.output as WorkspaceGraph).nodes.length, 0);
    await assert.rejects(
      () =>
        executeRegisteredRevenueTool(
          { supabase: db, actorEmail: "admin@a.example" },
          "get_workspace_graph",
          { ...input, principal: "admin" },
        ),
      /Unrecognized key|principal/,
    );
    const capability = listRevenueAiCapabilities().find((c) => c.name === "get_workspace_graph")!;
    assert.deepEqual(capability.packs, ["core", "pipeline", "outreach"]);

    const mcp = (await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "get_workspace_graph", arguments: input },
      },
      { supabase: db, actorEmail: "mcp:bearer", tenantSlug: "alpha", principalKind: "integration" },
    ))!.result as { content: Array<{ text: string }>; isError: boolean };
    assert.equal(mcp.isError, false);
    const integration = await readWorkspaceGraph(
      db,
      { kind: "integration", email: "mcp:bearer" },
      input,
    );
    assert.deepEqual(
      JSON.parse(mcp.content[0]!.text),
      integration,
      "MCP returns the service graph",
    );
    const listed = (await handleMcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      { supabase: db, actorEmail: "mcp:bearer", tenantSlug: "alpha", principalKind: "integration" },
    ))!.result as { tools: Array<{ name: string }> };
    assert.ok(listed.tools.some((tool) => tool.name === "get_workspace_graph"));
  }
  check("tool-and-mcp-parity");

  // The HTTP handler after its asynchronous guard, starting with no ambient actor.
  {
    const mem = fixture();
    const db = bound(mem, TENANT_A);
    const shared = globalThis as typeof globalThis & {
      graphRouteFixture?: {
        auth: unknown;
        read: typeof readWorkspaceGraph;
        GraphInputError: typeof GraphInputError;
      };
    };
    shared.graphRouteFixture = { auth: null, read: readWorkspaceGraph, GraphInputError };
    const bundle = await build({
      entryPoints: ["src/app/api/admin/revenue-os/graph/route.ts"],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      packages: "external",
      plugins: [
        {
          name: "guard-and-shared-service",
          setup(builder) {
            builder.onResolve({ filter: /^@\/lib\/admin\/auth$/ }, () => ({
              path: "auth",
              namespace: "fixture",
            }));
            builder.onResolve({ filter: /^@\/lib\/revenue-os\/graph-adapters$/ }, () => ({
              path: "graph",
              namespace: "fixture",
            }));
            builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
              contents:
                args.path === "auth"
                  ? "export const requireAdmin=async()=>globalThis.graphRouteFixture.auth;"
                  : "export const readWorkspaceGraph=(...a)=>globalThis.graphRouteFixture.read(...a); export const GraphInputError=globalThis.graphRouteFixture.GraphInputError;",
            }));
          },
        },
      ],
    });
    const compiled = { exports: {} as { GET: (request: NextRequest) => Promise<NextResponse> } };
    new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(
      createRequire(import.meta.url),
      compiled,
      compiled.exports,
    );
    const get = (query: string) =>
      compiled.exports.GET(
        new NextRequest(`https://workspace.example.test/api/admin/revenue-os/graph${query}`),
      );
    shared.graphRouteFixture.auth = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    assert.equal((await get("")).status, 401);
    assert.ok(!mem.queryTables.includes("contacts"), "an unauthenticated request reads nothing");
    shared.graphRouteFixture.auth = {
      database: db,
      user: { id: USER.admin, email: "admin@a.example" },
      tenant: { id: TENANT_A },
    };
    const query = `?relatedTo=contact:${C1}&limit=20&adapters=contacts,companies,opportunities,tasks`;
    const routed = await get(query);
    assert.equal(routed.status, 200);
    const service = await readWorkspaceGraph(db, member(USER.admin), {
      relatedTo: `contact:${C1}`,
      limit: 20,
      adapters: ["contacts", "companies", "opportunities", "tasks"],
    });
    assert.deepEqual(await routed.json(), service, "the route returns the service graph");
    const paged = await get(`?adapters=contacts&limit=1&cursor.contacts=${C1}`);
    assert.equal(((await paged.json()) as WorkspaceGraph).nodes[0]!.sourceId, C2);
    for (const bad of [
      "?limit=0",
      "?limit=201",
      "?adapters=secret",
      "?ids=contact:x,y",
      "?relatedTo=contact:nope",
    ])
      assert.equal((await get(bad)).status, 400, `${bad} must be refused`);
    shared.graphRouteFixture.auth = {
      database: db,
      user: { id: USER.member, email: "member@a.example" },
      tenant: { id: TENANT_A },
    };
    const denied = (await (await get("")).json()) as WorkspaceGraph;
    assert.equal(denied.nodes.length, 0, "the session actor is rechecked per source");
  }
  check("route-handler-parity-after-guard");

  // Command Board: the real handler binds the guard's actor, then stations read
  // open records through the graph. No ambient actor exists before or after.
  {
    const config = { modules: { ...plugins, "command-board": true } };
    const mem = fixture(config, {
      command_board_definitions: [
        {
          tenant_id: TENANT_A,
          board_key: "alpha-lawn",
          position: 0,
          revision: 1,
          document: COMMAND_BOARD_MODES.service.template("Alpha Lawn"),
        },
      ],
    });
    const db = bound(mem, TENANT_A);
    const actorFor = (userId: string): TenantActorContext => ({
      kind: "actor",
      tenant: { id: TENANT_A, slug: "alpha", name: "Alpha", status: "active", config },
      user: { id: userId, email: "admin@a.example" },
      role: "admin",
      isPlatformAdmin: false,
      database: db,
    });
    let authorization: unknown = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const http: { GET?: () => Promise<NextResponse> } = {};
    const load = createRequire(resolve("package.json"));
    runInNewContext(
      ts.transpileModule(readFileSync("src/app/api/admin/board/route.ts", "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        exports: http,
        console,
        Error,
        require: (name: string) =>
          name === "@/lib/admin/module-guard"
            ? { requireAdminForModule: async () => authorization }
            : load(name.startsWith("@/") ? resolve("src", name.slice(2)) : name),
      },
    );
    assert.equal((await http.GET!()).status, 401);
    assert.ok(!mem.queryTables.includes("command_board_definitions"));

    authorization = actorFor(USER.admin);
    assert.equal(getTenantRequestContext(), undefined);
    const response = await http.GET!();
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.equal(getTenantRequestContext(), undefined, "board authority stays in its handler");
    const board = (await response.json()) as CommandBoardSnapshot;
    const summary = (key: string, station: string) =>
      board.summaries[boardNodeId("alpha-lawn", key, station)]!;
    assert.deepEqual(summary("accounts", "customers").rows[0], {
      label: "Open",
      value: "2 people",
    });
    assert.deepEqual(
      summary("growth", "growth-report").records.map((record) => record.href),
      [`/admin/pipeline/${O1}`],
    );
    assert.equal(
      summary("accounts", "invoices").status,
      "attention",
      "an open balance needs a person",
    );

    authorization = actorFor(USER.member);
    const refused = (await (await http.GET!()).json()) as CommandBoardSnapshot;
    assert.ok(
      Object.values(refused.summaries).every((item) => item.records.length === 0),
      "a non-admin member's stations read nothing",
    );
    assert.deepEqual(
      refused.summaries[boardNodeId("alpha-lawn", "accounts", "customers")]!.rows[0],
      {
        label: "Sources",
        value: "Unavailable right now",
      },
    );
  }
  check("board-route-reads-through-graph");

  // Shared services keep the routes' own read shapes.
  {
    const mem = fixture();
    const db = bound(mem, TENANT_A);
    const routeTasks = await listTasks(db, {
      status: "all",
      sortBy: "created_at",
      sortDirection: "desc",
      page: 1,
      pageSize: 100,
    });
    assert.deepEqual(
      routeTasks.tasks.map((task) => task.id),
      [T2, T1],
      "route ordering and tenant scope are preserved",
    );
    assert.equal(routeTasks.total, 2);
    const linked = await listTasks(db, { linkedTo: { type: "opportunity", id: O1 } });
    assert.deepEqual(
      linked.tasks.map((task) => task.id),
      [T2],
    );
    const directory = await listContacts(db, { page: 1 });
    assert.deepEqual(
      directory.contacts.map((contact) => contact.id),
      [C2, C1],
    );
    const actions = await listActions(db, { limit: 100 });
    assert.equal(actions.actions.length, 4, "the approvals route still lists every status");
    assert.equal(actions.actions[0]!.id, A_PENDING, "newest first");
    for (const [route, table] of [
      ["src/app/api/admin/tasks/route.ts", "listTasks("],
      ["src/app/api/admin/revenue-os/pipeline/route.ts", "listOpportunities("],
      ["src/app/api/admin/contacts/directory/route.ts", "listContacts("],
      ["src/app/api/admin/revenue-os/actions/route.ts", "listActions("],
    ] as const) {
      const text = readFileSync(route, "utf8");
      assert.ok(text.includes(table), `${route} must read through ${table}`);
    }
    assert.doesNotMatch(
      readFileSync("src/app/api/admin/revenue-os/actions/route.ts", "utf8"),
      /from\("action_queue"\)/,
    );
    assert.doesNotMatch(
      readFileSync("src/app/api/admin/revenue-os/pipeline/route.ts", "utf8"),
      /from\("opportunities"\)/,
    );
    assert.doesNotMatch(
      readFileSync("src/app/api/admin/contacts/directory/route.ts", "utf8"),
      /from\("contacts"\)/,
    );
    assert.doesNotMatch(
      readFileSync("src/app/api/admin/tasks/route.ts", "utf8"),
      /from\("tasks"\)/,
    );
    const graphSource = readFileSync("src/lib/revenue-os/graph-adapters.ts", "utf8");
    assert.doesNotMatch(graphSource, /sweepExpiredActions|stripe\.|fetch\(/);
  }
  check("extracted-reads-keep-route-shapes");

  // The fictional demo serves the same route through the shared projections.
  {
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    const values = new Map<string, string>();
    let escaped = 0;
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        fetch: async () => {
          escaped++;
          throw new Error("Demo request escaped");
        },
        open: () => null,
        location: { origin: "https://demo.example", reload: () => {} },
        dispatchEvent: () => true,
      },
    });
    try {
      for (const pack of Object.values(DEMO_SCENARIOS)) {
        const runtime = installAdminDemoRuntime(pack.id);
        try {
          const read = async (query = "") => {
            const response = await window.fetch(`/api/admin/revenue-os/graph${query}`);
            return { status: response.status, body: (await response.json()) as WorkspaceGraph };
          };
          const { status, body } = await read();
          assert.equal(status, 200);
          assert.ok(body.nodes.length > 0 && body.edges.length > 0, `${pack.id}: populated graph`);
          assert.ok(
            body.sources.every((receipt) => receipt.state === "ready"),
            pack.id,
          );
          assert.ok(body.nodes.length <= GRAPH_MAX_NODES);
          const person = pack.people[0]!;
          const around = (await read(`?relatedTo=contact:${person.id}`)).body;
          assert.ok(ids(around).has(`contact:${person.id}`));
          assert.ok(
            around.edges.every((edge) => ids(around).has(edge.from) && ids(around).has(edge.to)),
          );
          const firstPage = (await read("?adapters=contacts&limit=5")).body;
          const next = source(firstPage, "contacts").nextCursor!;
          const secondPage = (await read(`?adapters=contacts&limit=5&cursor.contacts=${next}`))
            .body;
          assert.ok(secondPage.nodes.every((node) => node.sourceId > next));
          const openTasks = (await read("?adapters=tasks,opportunities&open=true")).body;
          assert.ok(
            openTasks.nodes.every((node) =>
              node.adapter === "tasks"
                ? ["pending", "snoozed"].includes(node.status ?? "")
                : !["won", "lost"].includes(node.status ?? ""),
            ),
            `${pack.id}: open keeps work in progress`,
          );
          assert.equal((await read("?limit=500")).status, 400);
          const toggle = await window.fetch("/api/admin/tenant/modules", {
            method: "PATCH",
            body: JSON.stringify({ moduleId: "receivables-collections", enabled: false }),
          });
          assert.equal(toggle.status, 200);
          const disabled = (await read()).body;
          assert.equal(source(disabled, "collection_cases").state, "module_disabled");
          assert.equal(source(disabled, "contacts").state, "ready");
        } finally {
          runtime.restore();
        }
      }
      assert.equal(escaped, 0, "the demo graph never reaches a live endpoint");
    } finally {
      if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (oldStorage) Object.defineProperty(globalThis, "sessionStorage", oldStorage);
      else Reflect.deleteProperty(globalThis, "sessionStorage");
    }
  }
  check("demo-runtime-simulates-route");

  console.log(JSON.stringify({ result: "passed", checks }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
