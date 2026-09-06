import assert from "node:assert/strict";
import test from "node:test";
import { setupConfiguration, runWorkspaceSetup } from "./lib/workspace-setup.mjs";
import { createWorkspaceSetupHost } from "./lib/workspace-setup-host.mjs";
import { bootstrapOwnerMembershipSql } from "./lib/bootstrap-owner-membership.mjs";
const ownerId = "11111111-1111-4111-8111-111111111111",
  tenantId = "22222222-2222-4222-8222-222222222222";
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://fixtureproject.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-private",
  SUPABASE_PROJECT_REF: "fixtureproject",
  SUPABASE_DB_HOST: "db.fixtureproject.supabase.co",
  ADMIN_EMAIL: "owner@harbor.test",
  BOOTSTRAP_BRAND_NAME: "Harbor",
  NEXT_PUBLIC_SITE_URL: "https://harbor.test",
};
const config = setupConfiguration(env);
const owner = { id: ownerId, email: config.ownerEmail, email_confirmed_at: "2026-01-01T00:00:00Z" };
function fixture({ existingOwner = false, existingWorkspace = false } = {}) {
  const state = {
    owner: existingOwner ? { ...owner } : null,
    workspace: existingWorkspace
      ? {
          id: tenantId,
          status: "active",
          config: { founder: { email: config.ownerEmail }, retained: "keep" },
        }
      : null,
    membership: null,
    writes: [],
    reads: [],
  };
  const host = {
    inspectDatabase: async () => ({
      pending: state.workspace ? 0 : 65,
      workspace: state.workspace,
      untrackedExisting: false,
    }),
    findOwner: async () => state.owner,
    createOwner: async (email, password) => {
      assert.equal(email, config.ownerEmail);
      assert.ok(password.length >= 12);
      state.writes.push("owner");
      state.owner = { ...owner };
      return state.owner;
    },
    assertDatabaseOwner: async () => {
      state.reads.push("owner_database_match");
    },
    migrate: async (bootstrap) => {
      state.writes.push("migrations");
      assert.doesNotMatch(JSON.stringify(bootstrap), /acceleratewith|John Connor|calendly/);
      state.workspace ??= {
        id: tenantId,
        status: "active",
        config: { founder: { email: config.ownerEmail }, retained: "keep" },
      };
    },
    readWorkspace: async () => state.workspace,
    readMembership: async () => state.membership,
    activateMembership: async (t, u) => {
      assert.equal(t, tenantId);
      assert.equal(u.id, ownerId);
      state.writes.push("membership");
      state.membership = {
        tenant_id: t,
        user_id: u.id,
        role: "admin",
        status: "active",
        invited_email: u.email,
      };
    },
  };
  return { state, host };
}
const apply = { apply: true, project: config.project, password: "private-fixture-password" };
test("missing/placeholder config is actionable and performs no host calls", async () => {
  assert.equal(
    setupConfiguration({ ...env, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }).bootstrap
      .BOOTSTRAP_SYSTEM_ACTOR_EMAIL,
    "system@harbor.test",
  );
  const bad = setupConfiguration({});
  assert.equal(bad.ready, false);
  assert.ok(bad.issues.length > 4);
  assert.equal((await runWorkspaceSetup(bad, {})).status, "configuration_required");
  assert.equal(setupConfiguration({ ...env, ADMIN_EMAIL: "admin@example.com" }).ready, false);
  for (const values of [
    { NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" },
    { NEXT_PUBLIC_SITE_URL: "http://remote.test" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://secret:pass@fixtureproject.supabase.co" },
    { BOOTSTRAP_FOUNDER_EMAIL: "other@harbor.test" },
    { SUPABASE_DB_HOST: "localhost" },
  ])
    assert.equal(setupConfiguration({ ...env, ...values }).ready, false);
});
test("default plan is read-only and redacted; neutral identity covers every bootstrap token", async () => {
  const f = fixture();
  const result = await runWorkspaceSetup(config, f.host);
  assert.equal(result.status, "plan");
  assert.deepEqual(f.state.writes, []);
  assert.doesNotMatch(
    JSON.stringify(result),
    /fixture-private|fixture-public|private-fixture-password/,
  );
  const { BOOTSTRAP_IDENTITY_TOKENS } = await import("./lib/bootstrap-identity.mjs");
  for (const t of BOOTSTRAP_IDENTITY_TOKENS)
    assert.ok(Object.hasOwn(config.bootstrap, t.env), t.env);
  assert.doesNotMatch(
    JSON.stringify(config.bootstrap),
    /Accelerate|acceleratewith|John Connor|calendly/,
  );
});
test("fresh setup orders owner before migrations, activates membership and replays without duplicate account/grant", async () => {
  const f = fixture();
  assert.equal((await runWorkspaceSetup(config, f.host, apply)).status, "workspace_configured");
  assert.deepEqual(f.state.writes, ["owner", "migrations", "membership"]);
  const saved = JSON.stringify(f.state.workspace);
  await runWorkspaceSetup(config, f.host, { ...apply, password: undefined });
  assert.deepEqual(f.state.writes, ["owner", "migrations", "membership", "migrations"]);
  assert.equal(JSON.stringify(f.state.workspace), saved);
});
test("owner created after migrations gains only missing membership without resetting account or settings", async () => {
  const f = fixture({ existingOwner: true, existingWorkspace: true });
  const result = await runWorkspaceSetup(config, f.host, { ...apply, password: undefined });
  assert.equal(result.status, "workspace_configured");
  assert.deepEqual(f.state.writes, ["migrations", "membership"]);
  assert.equal(f.state.workspace.config.retained, "keep");
});
test("target mismatch, missing password and foreign/inactive workspace refuse before writes", async () => {
  for (const options of [
    { ...apply, project: "other" },
    { ...apply, password: "short" },
  ]) {
    const f = fixture();
    await assert.rejects(runWorkspaceSetup(config, f.host, options));
    assert.deepEqual(f.state.writes, []);
  }
  for (const alter of [
    (w) => (w.status = "suspended"),
    (w) => (w.config.founder.email = "different@harbor.test"),
  ]) {
    const f = fixture({ existingWorkspace: true });
    alter(f.state.workspace);
    await assert.rejects(runWorkspaceSetup(config, f.host, apply));
    assert.deepEqual(f.state.writes, []);
  }
  const f = fixture();
  f.host.inspectDatabase = async () => ({ untrackedExisting: true });
  await assert.rejects(runWorkspaceSetup(config, f.host, apply), /no migration ledger/);
  assert.deepEqual(f.state.writes, []);
});
test("unconfirmed or banned accounts and restricted memberships are never silently reactivated", async () => {
  for (const fields of [
    { email_confirmed_at: null },
    { banned_until: "2999-01-01T00:00:00Z" },
    { email: "other@harbor.test" },
  ]) {
    const f = fixture({ existingOwner: true });
    Object.assign(f.state.owner, fields);
    await assert.rejects(runWorkspaceSetup(config, f.host, apply));
    assert.deepEqual(f.state.writes, []);
  }
  for (const status of ["revoked", "invited"]) {
    const f = fixture({ existingOwner: true, existingWorkspace: true });
    f.state.membership = { status, role: "admin", invited_email: config.ownerEmail };
    await assert.rejects(runWorkspaceSetup(config, f.host, apply), /explicit platform review/);
    assert.ok(!f.state.writes.includes("membership"));
  }
});
test("partial migration failure preserves owner; retry completes; raw service errors stay private", async () => {
  const f = fixture();
  const original = f.host.migrate;
  f.host.migrate = async () => {
    throw new Error("private-fixture-password provider payload");
  };
  await assert.rejects(
    runWorkspaceSetup(config, f.host, apply),
    (e) => /migrations/.test(e.message) && !/private-fixture/.test(e.message),
  );
  assert.deepEqual(f.state.writes, ["owner"]);
  f.host.migrate = original;
  await runWorkspaceSetup(config, f.host, apply);
  assert.deepEqual(f.state.writes, ["owner", "migrations", "membership"]);
});
test("false activation success cannot become workspace readiness", async () => {
  const f = fixture({ existingOwner: true });
  f.host.activateMembership = async () => ({ status: "active" });
  await assert.rejects(runWorkspaceSetup(config, f.host, apply), /verification failed/);
});
test("real Supabase Auth/REST adapter uses exact owner and existing audited membership RPC without invites", async () => {
  const calls = [];
  let member = null;
  const transport = async (url, init = {}) => {
    const parsed = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path: parsed.pathname, method: init.method ?? "GET", body });
    let result;
    if (parsed.pathname === "/auth/v1/admin/users")
      result = init.method === "POST" ? owner : { users: [owner], aud: "authenticated" };
    else if (parsed.pathname.endsWith("/tenant_memberships")) result = member;
    else throw new Error(`Unexpected request ${parsed.pathname}`);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  let transactions = 0;
  const host = createWorkspaceSetupHost(
    config,
    {
      runPsql: (_args, { input }) => {
        assert.equal(input, bootstrapOwnerMembershipSql(tenantId, ownerId, config.ownerEmail));
        transactions++;
        member = {
          tenant_id: tenantId,
          user_id: ownerId,
          role: "admin",
          status: "active",
          invited_email: config.ownerEmail,
        };
        return { status: 0 };
      },
    },
    [],
    { fetch: transport },
  );
  assert.equal((await host.findOwner(config.ownerEmail)).id, ownerId);
  assert.equal((await host.createOwner(config.ownerEmail, apply.password)).id, ownerId);
  assert.equal(calls[1].body.email_confirm, true);
  await host.activateMembership(tenantId, owner);
  assert.equal((await host.readMembership(tenantId, ownerId)).status, "active");
  assert.ok(calls.every((c) => !c.path.includes("invite")));
  assert.equal(transactions, 1);
});
