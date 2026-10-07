import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
import {
  PRIVATE_COMMAND_TABLES,
  runWithPlatformCommandContext,
} from "../src/lib/revenue-os/platform-command-context";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { claimApprovedAction, proposeAction, rejectAction } from "../src/lib/revenue-os/actions";

const oldEmail = process.env.ADMIN_EMAIL;
process.env.ADMIN_EMAIL = "founder@example.test";
const oldFetch = globalThis.fetch;
globalThis.fetch = async () => {
  throw new Error("Private command tests must never call a provider");
};
let checks = 0;
function fixture() {
  const tenantId = randomUUID(),
    userId = randomUUID(),
    email = "founder@example.test";
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenantId, status: "active" }],
    tenant_memberships: [{ tenant_id: tenantId, user_id: userId, role: "admin", status: "active" }],
    opportunities: [{ id: "opp", tenant_id: tenantId, next_action: null }],
  });
  mem.idFactory = () => randomUUID();
  const auth = {
    user: { id: userId, email, is_anonymous: false },
    error: null as null | Error,
    reads: 0,
  };
  const raw = {
    ...mem.client,
    auth: {
      getUser: async () => {
        auth.reads++;
        return { data: { user: auth.user }, error: auth.error };
      },
    },
  };
  const db = bindTenantDatabase(raw as never, tenantId);
  const actor: TenantActorContext = {
    kind: "actor",
    database: db,
    user: { id: userId, email },
    role: "admin",
    isPlatformAdmin: true,
    tenant: { id: tenantId, status: "active", slug: "fixture", name: "Fixture", config: {} },
  };
  const command = <T>(work: () => Promise<T>) =>
    runWithTenantRequestContext(actor, () => runWithPlatformCommandContext(db, email, work));
  return { tenantId, userId, email, mem, db, raw, actor, auth, command };
}
async function refusal(work: () => Promise<unknown>) {
  await assert.rejects(work);
  checks++;
}
async function proposal(f: ReturnType<typeof fixture>, expires?: string) {
  const row = await f.command(() =>
    proposeAction(f.db, {
      actionType: "update_next_action",
      title: "Private next step",
      sourceContext: "founder-command",
      payload: { opportunityId: "opp", nextAction: "Reviewed next step" },
      proposedBy: `human:${f.email}`,
      expiresAt: expires,
    }),
  );
  return row.id as string;
}
async function main() {
  try {
    const f = fixture();
    await refusal(() => runWithPlatformCommandContext(f.db, f.email, async () => {}));
    for (const override of [
      { isPlatformAdmin: false },
      { user: { id: randomUUID(), email: f.email } },
      { workspaceMcpProof: { grantId: "g", clientId: "c", sessionId: "s", resource: "r" } },
      { database: bindTenantDatabase(f.raw as never, randomUUID()) },
    ])
      await refusal(() =>
        runWithTenantRequestContext({ ...f.actor, ...override }, () =>
          runWithPlatformCommandContext(f.db, f.email, async () => {}),
        ),
      );
    await refusal(() =>
      runWithTenantRequestContext(
        { kind: "system", tenantId: f.tenantId, tenantSlug: "fixture", source: "worker" },
        () => runWithPlatformCommandContext(f.db, f.email, async () => {}),
      ),
    );
    f.auth.user.email = "other@example.test";
    await refusal(() => f.command(async () => {}));
    f.auth.user.email = f.email;
    f.auth.user.is_anonymous = true;
    await refusal(() => f.command(async () => {}));
    f.auth.user.is_anonymous = false;
    f.auth.error = new Error("Controlled revoked session");
    await refusal(() => f.command(async () => {}));
    f.auth.error = null;
    for (const column of ["status", "role"]) {
      const member = f.mem.rows("tenant_memberships")[0]!;
      const old = member[column];
      member[column] = "revoked";
      await refusal(() => f.command(async () => {}));
      member[column] = old;
    }
    f.mem.rows("tenants")[0]!.status = "suspended";
    await refusal(() => f.command(async () => {}));
    f.mem.rows("tenants")[0]!.status = "active";
    delete process.env.ADMIN_EMAIL;
    await refusal(() => f.command(async () => {}));
    process.env.ADMIN_EMAIL = f.email;
    // Scope annotates all existing ledger owners, including batch/upsert writes.
    await f.command(async () => {
      for (const table of PRIVATE_COMMAND_TABLES) {
        const result = await f.db.from(table).insert([{ id: randomUUID() }, { id: randomUUID() }]);
        assert.equal(result.error, null);
        assert.ok(
          f.mem
            .rows(table)
            .every((r) => r.platform_owner_user_id === f.userId && r.tenant_id === f.tenantId),
        );
        checks++;
      }
      await f.db.from("ai_conversations").upsert({ id: randomUUID() }, { onConflict: "id" });
      assert.equal(f.mem.rows("ai_conversations").at(-1)!.platform_owner_user_id, f.userId);
      await refusal(async () => {
        await bindTenantDatabase(f.raw as never, randomUUID())
          .from("action_queue")
          .insert({});
      });
      await refusal(async () => {
        await f.db.from("action_queue").insert({ platform_owner_user_id: randomUUID() });
      });
    });
    await refusal(async () => {
      await f.db.from("action_queue").insert({ platform_owner_user_id: f.userId });
    });
    await f.db.from("action_queue").insert({ id: "shared", status: "pending" });
    assert.equal(f.mem.rows("action_queue").at(-1)!.platform_owner_user_id, undefined);
    const system = bindTenantDatabase(f.raw as never, f.tenantId, true);
    const hidden = await system.from("action_queue").select("*", { count: "exact" });
    assert.equal(hidden.count, 1);
    assert.equal(hidden.data?.[0]?.id, "shared");
    await system
      .from("action_queue")
      .update({ title: "Shared changed" })
      .eq("platform_owner_user_id", f.userId);
    await system.from("action_queue").delete().eq("platform_owner_user_id", f.userId);
    assert.ok(f.mem.rows("action_queue").some((r) => r.platform_owner_user_id === f.userId));
    checks++;

    const approved = fixture(),
      id = await proposal(approved);
    await runWithTenantRequestContext(approved.actor, () =>
      approveAndExecuteAction(approved.db, id, approved.email),
    );
    assert.equal(approved.mem.rows("opportunities")[0]!.next_action, "Reviewed next step");
    assert.equal(approved.mem.rows("action_queue")[0]!.status, "executed");
    assert.ok(
      approved.mem.rows("audit_log").every((r) => r.platform_owner_user_id === approved.userId),
    );
    assert.equal(approved.mem.rows("agent_memories").length, 0);
    await refusal(() =>
      runWithTenantRequestContext(approved.actor, () =>
        approveAndExecuteAction(approved.db, id, approved.email),
      ),
    );
    checks++;
    const automatic = fixture(),
      aid = await proposal(automatic);
    await refusal(() =>
      runWithTenantRequestContext(automatic.actor, () =>
        approveAndExecuteAction(automatic.db, aid, automatic.email, { mode: "autonomous" }),
      ),
    );
    assert.equal(automatic.mem.rows("action_queue")[0]!.status, "denied");
    assert.equal(automatic.mem.rows("opportunities")[0]!.next_action, null);
    assert.ok(
      automatic.mem.rows("audit_log").every((r) => r.platform_owner_user_id === automatic.userId),
    );
    checks++;
    const direct = fixture(),
      did = await proposal(direct);
    await refusal(() =>
      runWithTenantRequestContext(direct.actor, () =>
        claimApprovedAction(direct.db, did, direct.email, "autonomous"),
      ),
    );
    assert.equal(direct.mem.rows("action_queue")[0]!.status, "pending");
    for (const revoke of ["membership", "session", "email"] as const) {
      const stale = fixture(),
        sid = await proposal(stale);
      if (revoke === "membership") stale.mem.rows("tenant_memberships")[0]!.status = "revoked";
      if (revoke === "session") stale.auth.error = new Error("Revoked session");
      if (revoke === "email") process.env.ADMIN_EMAIL = "replacement@example.test";
      await refusal(() =>
        runWithTenantRequestContext(stale.actor, () =>
          approveAndExecuteAction(stale.db, sid, stale.email),
        ),
      );
      assert.equal(stale.mem.rows("action_queue")[0]!.status, "pending");
      assert.equal(stale.mem.rows("opportunities")[0]!.next_action, null);
      process.env.ADMIN_EMAIL = stale.email;
      checks++;
    }
    const expired = fixture(),
      eid = await proposal(expired, new Date(Date.now() - 10000).toISOString());
    await refusal(() =>
      runWithTenantRequestContext(expired.actor, () =>
        approveAndExecuteAction(expired.db, eid, expired.email),
      ),
    );
    assert.equal(expired.mem.rows("opportunities")[0]!.next_action, null);
    const rejected = fixture(),
      rid = await proposal(rejected);
    await runWithTenantRequestContext(rejected.actor, () =>
      rejectAction(rejected.db, rid, rejected.email, "Private reason"),
    );
    assert.equal(rejected.mem.rows("action_queue")[0]!.status, "rejected");
    assert.equal(rejected.mem.rows("agent_memories").length, 0);
    assert.equal(rejected.mem.rows("learned_policies").length, 0);
    checks++;
    const missing = fixture();
    missing.mem.fail("action_queue", { code: "42703", message: "Missing privacy column" });
    await refusal(() => proposal(missing));
    assert.equal(missing.mem.rows("action_queue").length, 0);
    assert.ok(approved.auth.reads >= 3, "Approval must authenticate again after the proposal");
    console.log(`Private command context: ${checks} checks passed; no provider calls`);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = oldEmail;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
