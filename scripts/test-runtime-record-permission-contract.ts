#!/usr/bin/env tsx
/**
 * runtime-record-permission-contract acceptance battery (AC01–AC06, local).
 *
 * Memory-only fixtures with controlled cleanup (fresh MemorySupabase per
 * section). Every acceptance item is asserted including negative cases:
 * default-deny codes, revoked/archived/suspended actors, ungranted entities,
 * unreadable fields, revocation-after-approval denials, and reference drift.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import {
  authorizeMcpResource,
  authorizeRecordAccess,
  RECORD_DENY_CODES,
  RECORD_PERMISSION_VERSION,
} from "../src/lib/revenue-os/record-permissions";
import { buildRecordPermissionReference } from "../src/lib/revenue-os/record-permission-reference";
import { registerEntityType } from "../src/lib/revenue-os/entity-registry";
import { queryCapabilityEntities } from "../src/lib/revenue-os/capability-data-api";
import { denyAction } from "../src/lib/revenue-os/actions";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const TENANT_SUSPENDED = "tenant-suspended";
const TENANT_ARCHIVED = "tenant-archived";

const checks: string[] = [];
function check(name: string) {
  checks.push(name);
}

function seedBase() {
  return new MemorySupabase({
    tenants: [
      { id: TENANT_A, status: "active", config: {} },
      { id: TENANT_B, status: "active", config: { modules: { campaigns: false } } },
      { id: TENANT_SUSPENDED, status: "suspended", config: {} },
      { id: TENANT_ARCHIVED, status: "archived", config: {} },
    ],
    tenant_memberships: [
      { tenant_id: TENANT_A, invited_email: "alice@example.com", status: "active", role: "admin" },
      { tenant_id: TENANT_A, invited_email: "bob@example.com", status: "revoked", role: "admin" },
      { tenant_id: TENANT_A, invited_email: "dave@example.com", status: "invited", role: "admin" },
      { tenant_id: TENANT_B, invited_email: "carol@example.com", status: "active", role: "admin" },
    ],
    webinars: [
      { id: "w1", tenant_id: TENANT_A, title: "Intro call", status: "live", secret_note: "a" },
      { id: "w9", tenant_id: TENANT_B, title: "Foreign webinar", status: "live", secret_note: "b" },
    ],
  });
}

function boundDb(mem: MemorySupabase, tenantId: string) {
  return bindTenantDatabaseForTest(mem.client as never, tenantId);
}

async function registerWebinar(db: SupabaseClient) {
  await registerEntityType(db, {
    tenantId: TENANT_A,
    typeKey: "webinar",
    label: "Webinar",
    backingTable: "webinars",
    identityFields: ["title"],
    readableColumns: ["title", "status"],
  });
}

async function main() {
  // AC01 + AC06: the committed reference is generated, complete, and current.
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const committed = JSON.parse(
    readFileSync(join(root, "docs/generated/record-permission-reference.json"), "utf8"),
  );
  assert.deepEqual(committed, buildRecordPermissionReference());
  check("reference-matches-generator");
  assert.equal(committed.contract, RECORD_PERMISSION_VERSION);
  assert.deepEqual(committed.denyCodes, [...RECORD_DENY_CODES]);
  assert.ok(committed.modules.length > 10, "modules must come from the live registry");
  assert.ok(
    committed.toolGrants.some(
      (g: { tool: string; module: string }) =>
        g.tool === "get_today_snapshot" && g.module === "core-command",
    ),
    "tool grants must bind tools to owning modules",
  );
  assert.ok(committed.hardFloors.includes("customer_database.export"));
  assert.ok(committed.boundaries.length >= 4, "authority boundaries must be documented");
  check("reference-covers-boundaries");

  // AC02: one evaluator, same decision across operations for the same fixture.
  {
    const mem = seedBase();
    const db = boundDb(mem, TENANT_A);
    await registerWebinar(db);
    const principal = { kind: "workspace_member" as const, email: "alice@example.com" };
    for (const operation of ["read", "relate", "export", "write", "action"] as const) {
      const decision = await authorizeRecordAccess(db, {
        principal,
        operation,
        entityType: "webinar",
        moduleId: "core-command",
        grant: {
          capabilityId: "webinar-pack",
          tenantId: TENANT_A,
          entities: ["webinar"],
          recipes: [],
          namespace: false,
        },
      });
      assert.equal(
        decision.allowed,
        ["read", "relate"].includes(operation),
        `${operation} must require an explicit policy for mutation or export`,
      );
    }
    check("one-policy-all-operations");

    // Same helper governs the MCP surface: allowed here...
    const mcpAllowed = await authorizeMcpResource(db, {
      principal: { kind: "integration", email: "mcp:bearer" },
      uri: "revenue-os://system/modules",
    });
    assert.equal(mcpAllowed.allowed, true);
    // ...and denies on a suspended workspace through the identical code.
    const memS = seedBase();
    const dbS = boundDb(memS, TENANT_SUSPENDED);
    const mcpDenied = await authorizeMcpResource(dbS, {
      principal: { kind: "integration", email: "mcp:bearer" },
      uri: "revenue-os://system/modules",
    });
    assert.equal(mcpDenied.allowed, false);
    assert.equal(
      (mcpDenied as { code: string }).code,
      "tenant_unknown_or_suspended",
      "MCP shares the evaluator deny codes",
    );
    check("mcp-shares-evaluator");

    // Disabled optional module denies through the same helper the UI/API use.
    const memB = seedBase();
    const dbB = boundDb(memB, TENANT_B);
    const moduleDenied = await authorizeRecordAccess(dbB, {
      principal: { kind: "workspace_member", email: "carol@example.com" },
      operation: "read",
      entityType: "campaign",
      moduleId: "campaigns",
    });
    assert.equal(moduleDenied.allowed, false);
    assert.equal((moduleDenied as { code: string }).code, "module_disabled");
    check("module-disabled-denies");
  }

  // AC03: two-tenant denials — revoked, invited-only, suspended, archived.
  {
    const mem = seedBase();
    const db = boundDb(mem, TENANT_A);
    await registerWebinar(db);

    const revoked = await authorizeRecordAccess(db, {
      principal: { kind: "workspace_member", email: "bob@example.com" },
      operation: "read",
      entityType: "webinar",
      moduleId: "core-command",
      grant: {
        capabilityId: "webinar-pack",
        tenantId: TENANT_A,
        entities: ["webinar"],
        recipes: [],
        namespace: false,
      },
    });
    assert.equal(revoked.allowed, false);
    assert.equal((revoked as { code: string }).code, "membership_revoked");
    check("revoked-membership-denies");

    const invited = await authorizeRecordAccess(db, {
      principal: { kind: "workspace_member", email: "dave@example.com" },
      operation: "read",
      entityType: "webinar",
      moduleId: "core-command",
      grant: {
        capabilityId: "webinar-pack",
        tenantId: TENANT_A,
        entities: ["webinar"],
        recipes: [],
        namespace: false,
      },
    });
    assert.equal(invited.allowed, false);
    assert.equal((invited as { code: string }).code, "membership_revoked");
    check("invited-only-denies");

    for (const [tenantId, label] of [
      [TENANT_SUSPENDED, "suspended"],
      [TENANT_ARCHIVED, "archived"],
    ] as const) {
      const memT = seedBase();
      const dbT = boundDb(memT, tenantId);
      const denied = await authorizeRecordAccess(dbT, {
        principal: { kind: "workspace_member", email: "alice@example.com" },
        operation: "read",
        entityType: "webinar",
        moduleId: "core-command",
        grant: {
          capabilityId: "webinar-pack",
          tenantId: TENANT_A,
          entities: ["webinar"],
          recipes: [],
          namespace: false,
        },
      });
      assert.equal(denied.allowed, false, `${label} workspace must deny`);
      assert.equal((denied as { code: string }).code, "tenant_unknown_or_suspended");
    }
    check("suspended-archived-deny");

    // Guessed IDs: tenant scope hides foreign rows, and a foreign id looks
    // exactly like a nonexistent one — no cross-tenant oracle.
    const memB = seedBase();
    const dbB = boundDb(memB, TENANT_B);
    await registerEntityType(dbB, {
      tenantId: TENANT_B,
      typeKey: "webinar",
      label: "Webinar",
      backingTable: "webinars",
      identityFields: ["title"],
      readableColumns: ["title", "status"],
    });
    const bGrant = {
      capabilityId: "webinar-pack",
      tenantId: TENANT_B,
      entities: ["webinar"],
      recipes: [] as string[],
      namespace: false,
    };
    const guessed = await queryCapabilityEntities(dbB, bGrant, {
      type: "webinar",
      filters: [{ column: "id", op: "eq", value: "w1" }],
    });
    const missing = await queryCapabilityEntities(dbB, bGrant, {
      type: "webinar",
      filters: [{ column: "id", op: "eq", value: "nope" }],
    });
    assert.equal(guessed.rows.length, 0, "tenant-A row must be invisible to tenant B");
    assert.deepEqual(
      guessed.rows,
      missing.rows,
      "a foreign id and a nonexistent id must look identical",
    );
    check("no-cross-tenant-oracle");

    // An unbound client fails closed before any table is touched.
    const memU = seedBase();
    const unbound = await authorizeRecordAccess(memU.client as never, {
      principal: { kind: "integration", email: "cron" },
      operation: "read",
      entityType: "webinar",
      moduleId: "core-command",
    });
    assert.equal(unbound.allowed, false);
    assert.equal((unbound as { code: string }).code, "tenant_unknown_or_suspended");
    check("unbound-client-denies");
  }

  // AC05: custom/plugin fields inherit the host policy; manifests cannot escalate.
  {
    const mem = seedBase();
    const db = boundDb(mem, TENANT_A);
    await registerWebinar(db);
    const principal = { kind: "workspace_member" as const, email: "alice@example.com" };

    const secretField = await authorizeRecordAccess(db, {
      principal,
      operation: "read",
      entityType: "webinar",
      moduleId: "core-command",
      grant: {
        capabilityId: "webinar-pack",
        tenantId: TENANT_A,
        entities: ["webinar"],
        recipes: [],
        namespace: false,
      },
      field: "secret_note",
    });
    assert.equal(secretField.allowed, false);
    assert.equal((secretField as { code: string }).code, "field_not_readable");
    check("unreadable-field-denies");

    const noGrant = await authorizeRecordAccess(db, {
      principal,
      operation: "read",
      entityType: "webinar",
      moduleId: "core-command",
    });
    assert.equal(noGrant.allowed, false);
    assert.equal((noGrant as { code: string }).code, "entity_not_granted");
    check("grant-required");
    for (const grant of [
      {
        capabilityId: "unrelated",
        tenantId: TENANT_A,
        entities: ["other"],
        recipes: [],
        namespace: false,
      },
      {
        capabilityId: "foreign",
        tenantId: TENANT_B,
        entities: ["webinar"],
        recipes: [],
        namespace: false,
      },
    ]) {
      assert.equal(
        (
          await authorizeRecordAccess(db, {
            principal,
            operation: "read",
            entityType: "webinar",
            moduleId: "core-command",
            grant,
          })
        ).allowed,
        false,
      );
    }
    assert.equal(
      (
        await authorizeRecordAccess(db, {
          principal,
          operation: "read",
          entityType: "not_registered",
          moduleId: "core-command",
        })
      ).allowed,
      false,
    );
    check("unknown-entity-and-unrelated-or-foreign-grants-denied");

    // The capability layer enforces the same rule on real reads: secrets are
    // projected out, unreadable filters throw, ungranted types throw.
    const rows = await queryCapabilityEntities(
      db,
      {
        capabilityId: "webinar-pack",
        tenantId: TENANT_A,
        entities: ["webinar"],
        recipes: [],
        namespace: false,
      },
      { type: "webinar" },
    );
    assert.equal(rows.rows.length, 1);
    assert.ok(!("secret_note" in rows.rows[0]!), "secret columns must not leave the host");
    check("capability-projection-strips-secrets");
    await assert.rejects(
      () =>
        queryCapabilityEntities(
          db,
          {
            capabilityId: "webinar-pack",
            tenantId: TENANT_A,
            entities: ["webinar"],
            recipes: [],
            namespace: false,
          },
          { type: "webinar", filters: [{ column: "secret_note", op: "eq", value: "a" }] },
        ),
      /not readable/,
    );
    check("capability-filter-escalation-refused");
    await assert.rejects(
      () =>
        queryCapabilityEntities(
          db,
          {
            capabilityId: "webinar-pack",
            tenantId: TENANT_A,
            entities: ["webinar"],
            recipes: [],
            namespace: false,
          },
          { type: "othertype" },
        ),
      /not granted/,
    );
    check("capability-grant-required");
  }

  // AC04: revocation after approval emits a truthful denied receipt.
  {
    // Direct receipt shape.
    const mem = seedBase();
    const db = boundDb(mem, TENANT_A);
    mem.tables.action_queue = [
      {
        id: "action-1",
        action_type: "update_task",
        status: "executing",
        tenant_id: TENANT_A,
        payload: {},
      },
    ];
    await denyAction(db, "action-1", {
      code: "autonomy_denied",
      reason: "Action denied: standing permission revoked",
      policy: { level: "prohibited", mode: "approved" },
    });
    const deniedRow = mem.rows("action_queue").find((r) => r.id === "action-1");
    assert.equal(deniedRow?.status, "denied");
    assert.deepEqual(deniedRow?.result, {
      denied: true,
      code: "autonomy_denied",
      policy: { level: "prohibited", mode: "approved" },
    });
    assert.ok(
      mem.rows("audit_log").some((r) => r.action === "action.denied"),
      "denial must leave an audit entry with the policy reference",
    );
    check("denied-receipt-shape");

    // Full executor path: autonomy revoked between approval and execution.
    const mem2 = seedBase();
    const db2 = boundDb(mem2, TENANT_A);
    mem2.tables.action_queue = [
      {
        id: "action-2",
        action_type: "update_task",
        status: "pending",
        tenant_id: TENANT_A,
        proposed_by: "founder@example.com",
        payload: { taskId: "t1", changeType: "complete" },
      },
    ];
    mem2.rpc("check_autonomy", () => ({
      action_key: "update_task",
      allowed: false,
      level: "prohibited",
      requires_approval: true,
      policy_id: "policy-revoked",
      hard_floor: false,
      reason: "Standing permission revoked after approval",
    }));
    await assert.rejects(
      () => approveAndExecuteAction(db2, "action-2", "founder@example.com"),
      /Action denied: Standing permission revoked after approval/,
      "the original denial message must survive, not a superseded error",
    );
    const execRow = mem2.rows("action_queue").find((r) => r.id === "action-2");
    assert.equal(execRow?.status, "denied", "revocation must deny, not fail generically");
    assert.equal((execRow?.result as { code?: string })?.code, "autonomy_denied");
    assert.ok(
      mem2
        .rows("audit_log")
        .some((r) => r.action === "action.denied" && r.entity_id === "action-2"),
    );
    mem2.tables.action_queue!.push({ ...execRow, id: "denied-audit-failure", status: "pending" });
    mem2.rpc("check_autonomy", () => {
      mem2.fail("audit_log", { message: "controlled audit outage" });
      return {
        action_key: "update_task",
        allowed: false,
        level: "prohibited",
        requires_approval: true,
        policy_id: "policy-revoked",
        hard_floor: false,
        reason: "Standing permission revoked after approval",
      };
    });
    await assert.rejects(
      () => approveAndExecuteAction(db2, "denied-audit-failure", "founder@example.com"),
      /denial audit unavailable/,
    );
    assert.equal(
      mem2.rows("action_queue").find((row) => row.id === "denied-audit-failure")!.status,
      "denied",
    );
    check("denied-receipt-survives-audit-outage");
    check("executor-revocation-denies");
  }

  console.log(JSON.stringify({ result: "passed", checks }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
