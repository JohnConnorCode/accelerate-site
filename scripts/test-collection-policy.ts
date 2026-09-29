import { tenant as defaultTenant } from "../src/config/tenant";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCollectionsFixture } from "./lib/collections-fixture";
import {
  previewCollectionPolicy,
  proposeCollectionPolicy,
  executeCollectionPolicy,
} from "../src/lib/revenue-os/collection-policy";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { rejectAction, retryPluginAction } from "../src/lib/revenue-os/actions";
import { previewCollectionAgentReminder } from "../src/lib/revenue-os/collection-agent";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { bindTenantDatabase } from "../src/lib/supabase/server";

async function main() {
  const f = createCollectionsFixture();
  const email = "operator@example.test",
    userId = randomUUID();
  f.mem.idFactory = () => randomUUID();
  f.mem.tables.tenant_memberships = [
    { tenant_id: f.tenant, user_id: userId, role: "admin", status: "active" },
  ];
  const actor: TenantActorContext = {
    kind: "actor",
    database: f.db,
    role: "admin",
    isPlatformAdmin: false,
    user: { id: userId, email },
    tenant: { id: f.tenant, slug: "fixture", name: "Fixture", status: "active", config: {} },
  };
  const context = {
    supabase: f.db,
    actorEmail: email,
    tenantConfig: {
      ...defaultTenant,
      modules: { "receivables-collections": true, "stripe-invoicing": true },
    },
  };
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://collection-policy.example.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "controlled-fixture-key";
  const stripeFetch = globalThis.fetch;
  const commands = new Map<string, { input: string; result: Record<string, unknown> }>();
  let writes = 0,
    failHost = false,
    race = false;
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    if (url.hostname !== "collection-policy.example.test") return stripeFetch(raw, init);
    assert.equal(url.pathname, "/rest/v1/rpc/update_collection_case");
    assert.equal(new Headers(init?.headers).get("x-tenant-id"), f.tenant);
    if (failHost) return Response.json({ message: "controlled host failure" }, { status: 503 });
    const input = JSON.parse(String(init?.body));
    const key = input.p_request as string;
    const fingerprint = JSON.stringify({
      caseId: input.p_case,
      revision: input.p_revision,
      patch: input.p_patch,
    });
    const prior = commands.get(key);
    if (prior) {
      assert.equal(prior.input, fingerprint);
      return Response.json(prior.result);
    }
    if (race) {
      f.row().revision = Number(f.row().revision) + 1;
      race = false;
    }
    if (
      input.p_revision !== f.row().revision ||
      input.p_case !== f.caseId ||
      f.row().status !== "open"
    )
      return Response.json({ message: "Case changed" }, { status: 409 });
    const fields: Record<string, string> = {
      pauseUntil: "pause_until",
      promiseDate: "promise_date",
      ownerEmail: "owner_email",
      nextAction: "next_action",
    };
    for (const [key, value] of Object.entries(input.p_patch)) f.row()[fields[key] ?? key] = value;
    f.row().revision = Number(f.row().revision) + 1;
    writes++;
    const result = { ...f.row() };
    commands.set(key, { input: fingerprint, result });
    f.table("collection_commands").push({ tenant_id: f.tenant, request_id: key, result });
    return Response.json(result);
  };
  const preview = (patch: Record<string, unknown>) =>
    previewCollectionPolicy(f.db, { caseId: f.caseId, patch });
  const propose = async (patch: Record<string, unknown>) => {
    const p = await preview(patch);
    return proposeCollectionPolicy(f.db, { caseId: f.caseId, patch, digest: p.digest }, email);
  };
  try {
    const changes = { nextAction: "Call the billing owner", ownerEmail: "owner@example.test" };
    const before = await preview(changes);
    const reversed = await preview({
      ownerEmail: changes.ownerEmail,
      nextAction: changes.nextAction,
    });
    assert.equal(
      reversed.digest,
      before.digest,
      "Patch key order must not create a different approval",
    );
    assert.equal(before.before.ownerEmail, null);
    assert.equal(before.after.ownerEmail, changes.ownerEmail);
    assert.equal(before.facts.invoices[0]!.remaining, 7500);
    const staged = await executeRegisteredRevenueTool(context, "propose_collection_policy", {
      caseId: f.caseId,
      patch: changes,
      digest: before.digest,
    });
    const action = staged.output as {
      id: string;
      payload: Record<string, unknown>;
      status: string;
    };
    assert.equal(action.status, "pending");
    assert.equal(writes, 0);
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "propose_collection_policy",
          arguments: { caseId: f.caseId, patch: changes, digest: before.digest },
        },
      },
      context,
    );
    const result = mcp?.result as { content: { text: string }[]; isError: boolean };
    assert.equal(result.isError, false);
    assert.equal(JSON.parse(result.content[0]!.text).id, action.id);
    const reminder = await previewCollectionAgentReminder(f.db, { caseId: f.caseId });
    await assert.rejects(
      () => executeCollectionPolicy(f.db, action.payload, email),
      /authenticated/,
    );
    await runWithTenantRequestContext(actor, async () => {
      const approved = (await approveAndExecuteAction(f.db, action.id, email)) as Record<
        string,
        unknown
      >;
      assert.equal(approved.owner_email, changes.ownerEmail);
      assert.equal(writes, 1);
      await assert.rejects(
        () => approveAndExecuteAction(f.db, action.id, email),
        /already handled/,
      );
      const regenerated = await previewCollectionAgentReminder(f.db, { caseId: f.caseId });
      assert.notEqual(regenerated.digest, reminder.digest);
      assert.equal(f.state.sends, 0);
      const replay = await executeCollectionPolicy(f.db, action.payload, email);
      assert.equal(replay.revision, approved.revision);
      assert.equal(writes, 1);
      await assert.rejects(
        () => executeCollectionPolicy(f.db, { ...action.payload, digest: "0".repeat(64) }, email),
        /exact preview/,
      );
      await assert.rejects(
        () =>
          executeCollectionPolicy(
            bindTenantDatabase(f.mem.client, randomUUID(), true),
            action.payload,
            email,
          ),
        /authenticated/,
      );
      for (const [patch, error] of [
        [{ amount: 1 }, /unrecognized/i],
        [{ promiseDate: "2026-02-30" }, /Invalid/],
        [{}, /required/],
      ] as const)
        await assert.rejects(() => preview(patch), error);
      const reject = await propose({ paused: true });
      await rejectAction(f.db, reject.id, email, "Keep current policy");
      await assert.rejects(
        () => approveAndExecuteAction(f.db, reject.id, email),
        /already handled/,
      );
      assert.equal(f.row().paused, false);
      const scenarios = [
        "payment",
        "partial-payment",
        "recipient",
        "case",
        "revoked",
        "disabled",
        "suspended",
        "provider",
        "race",
        "denied",
        "expired",
        "autonomous",
      ] as const;
      for (const scenario of scenarios) {
        const queued = await propose({ nextAction: `Policy check ${scenario}` });
        const previous: number = writes;
        const rowBefore = { ...f.row() };
        const config = f.table("tenants")[0]!.config as { modules: Record<string, boolean> };
        if (scenario === "payment") f.state.balance = 0;
        if (scenario === "partial-payment") f.state.balance = 6500;
        if (scenario === "recipient")
          f.table("contacts")[0]!.primary_email = "changed@example.test";
        if (scenario === "case") f.row().revision = Number(f.row().revision) + 1;
        if (scenario === "revoked") f.table("tenant_memberships")[0]!.status = "inactive";
        if (scenario === "disabled") config.modules["receivables-collections"] = false;
        if (scenario === "suspended") f.table("tenants")[0]!.status = "suspended";
        if (scenario === "provider") f.state.providerFailure = true;
        if (scenario === "race") race = true;
        if (scenario === "denied")
          f.mem.rpc("check_autonomy", ({ p_action_key }) => ({
            action_key: p_action_key,
            level: "prohibited",
            allowed: false,
            requires_approval: true,
            reason: "Denied",
            hard_floor: false,
          }));
        if (scenario === "expired")
          f.table("action_queue").find((a) => a.id === queued.id)!.expires_at =
            "2000-01-01T00:00:00Z";
        await assert.rejects(
          () =>
            approveAndExecuteAction(
              f.db,
              queued.id,
              email,
              scenario === "autonomous" ? { mode: "autonomous" } : undefined,
            ),
          scenario,
        );
        assert.equal(writes, previous, scenario);
        Object.assign(f.row(), rowBefore);
        f.state.balance = 7500;
        f.state.providerFailure = false;
        f.table("contacts")[0]!.primary_email = "billing@example.test";
        f.table("tenant_memberships")[0]!.status = "active";
        config.modules["receivables-collections"] = true;
        f.table("tenants")[0]!.status = "active";
        f.mem.rpc("check_autonomy", ({ p_action_key }) => ({
          action_key: p_action_key,
          level: "always_ask",
          allowed: false,
          requires_approval: true,
          reason: "Approval required",
          hard_floor: false,
        }));
      }
      const retry = await propose({ paused: true });
      failHost = true;
      await assert.rejects(() => approveAndExecuteAction(f.db, retry.id, email));
      failHost = false;
      await retryPluginAction(f.db, retry.id, email);
      const outcomes = await Promise.allSettled([
        approveAndExecuteAction(f.db, retry.id, email),
        approveAndExecuteAction(f.db, retry.id, email),
      ]);
      assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
      assert.equal(f.row().paused, true);
      assert.equal(writes, 2);
      const allFields = await propose({
        paused: false,
        disputed: true,
        pauseUntil: "2027-01-02",
        promiseDate: "2027-01-03",
        ownerEmail: null,
        nextAction: "Resolve disputed amount",
      });
      await approveAndExecuteAction(f.db, allFields.id, email);
      assert.equal(f.row().paused, false);
      assert.equal(f.row().disputed, true);
      assert.equal(f.row().pause_until, "2027-01-02");
      assert.equal(f.row().promise_date, "2027-01-03");
      assert.equal(f.row().owner_email, null);
      assert.equal(f.row().next_action, "Resolve disputed amount");
      await assert.rejects(() => previewCollectionAgentReminder(f.db, { caseId: f.caseId }));
      assert.equal(f.state.sends, 0);
    });
    console.log(
      "PASS: Collections policy registry/MCP preview, exact approval, canonical host RPC, reminder regeneration, replay, denial, expiry, tenant/membership/provider failures, stale facts, concurrent approval and retry; no sends.",
    );
  } finally {
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
    f.restore();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
