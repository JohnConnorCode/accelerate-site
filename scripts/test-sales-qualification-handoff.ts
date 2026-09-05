import assert from "node:assert/strict";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import { registerSalesWorkHandlers } from "../src/lib/revenue-os/sales-coworker";
import { getWorkKindHandler } from "../src/lib/revenue-os/work-executor";
import type { WorkItem } from "../src/lib/revenue-os/work-items";

function fixture() {
  const tenant = ACCELERATE_TENANT_ID;
  const wi = {
    id: "qualification",
    tenant_id: tenant,
    coworker_id: "sales",
    kind: "qualify_lead",
    entity_type: "contact",
    entity_id: "contact",
    objective: "Qualify fictional inquiry",
    reason: "New inquiry",
    source: "test",
    status: "in_progress",
    lease_owner: "fixture",
    claimed_at: new Date().toISOString(),
    lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
    attempt_count: 1,
    max_attempts: 3,
  } as WorkItem;
  const db = new AuthorizedMemorySupabase({
    tenants: [{ id: tenant, status: "active", name: "Fictional workspace", config: {} }],
    coworkers: [
      {
        id: "sales",
        tenant_id: tenant,
        name: "Sales",
        role: "sales",
        tool_pack: "pipeline",
        status: "active",
        required_capabilities: [],
      },
    ],
    work_items: [{ ...wi }],
    contacts: [
      { id: "contact", tenant_id: tenant, email: "fixture@example.test", first_name: "Fixture" },
    ],
    opportunities: [
      {
        id: "opportunity",
        tenant_id: tenant,
        contact_id: "contact",
        stage: "new",
        company_name: "Fictional company",
        created_at: new Date().toISOString(),
      },
    ],
  });
  db.rpc("claim_budget_usage", () => ({ allowed: true, replayed: false, reason: "fixture" }));
  db.rpc("resolve_workspace_capability", () => ({
    available: false,
    policy: null,
    status_reason: "fixture",
  }));
  return { db, wi, client: bindTenantDatabase(db.client as never, tenant, true) };
}

/** Exercises the registered handler and real AI loop with a fully intercepted transport. */
export async function verifySalesQualificationHandoff() {
  const savedFetch = globalThis.fetch;
  const savedModel = process.env.OPENROUTER_AGENT_MODEL;
  const savedKey = process.env.OPENROUTER_API_KEY;
  const cases: string[] = [];
  let calls = 0;
  let mode: "success" | "partial" | "failure" = "success";
  let onFinal: (() => void) | undefined;
  registerSalesWorkHandlers();
  const handler = getWorkKindHandler("qualify_lead")!;
  const drafts = (db: AuthorizedMemorySupabase) =>
    db.rows("work_items").filter((row) => row.kind === "draft_followup");
  const run = async (f: ReturnType<typeof fixture>) => {
    calls = 0;
    return handler(f.client, f.wi);
  };
  try {
    process.env.OPENROUTER_AGENT_MODEL = "fixture-model";
    process.env.OPENROUTER_API_KEY = "fixture-placeholder";
    globalThis.fetch = async (url) => {
      assert.equal(
        String(url),
        "https://openrouter.ai/api/v1/chat/completions",
        "Unexpected network request",
      );
      const turn = calls++;
      if (mode === "failure")
        return Response.json({ error: { message: "Fixture model unavailable" } }, { status: 400 });
      const read = mode === "success" && turn === 0;
      if (!read) onFinal?.();
      const message = read
        ? {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "read",
                type: "function",
                function: { name: "get_pending_actions", arguments: "{}" },
              },
            ],
          }
        : { role: "assistant", content: "Lead reviewed and ready for a follow-up draft." };
      return Response.json({
        id: "fixture",
        model: "fixture-model",
        choices: [{ message }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      });
    };

    const f = fixture();
    const result = await run(f);
    assert.equal(result.status, "completed");
    assert.equal(calls, 2);
    assert.ok(result.runId);
    assert.equal(drafts(f.db).length, 1);
    const child = drafts(f.db)[0]!;
    assert.equal(child.tenant_id, f.wi.tenant_id);
    assert.equal(child.source, "sales_coworker");
    assert.ok(
      result.artifacts?.some(
        (artifact) => artifact.type === "work_item" && artifact.id === child.id,
      ),
    );
    assert.equal(f.db.rows("tasks").length, 1);
    assert.equal(f.db.rows("tasks")[0]!.source, "work_engine");
    assert.ok(f.db.rows("activities").some((row) => row.activity_type === "task_created"));
    assert.equal(f.db.rows("action_queue").length, 0);
    cases.push(
      "AI qualification persists a tenant-owned draft WorkItem and inbox receipt without sending",
    );

    // MemorySupabase deliberately has no SQL defaults; emulate the persisted status.
    child.status = "pending";
    const replay = await run(f);
    assert.equal(replay.status, "completed");
    assert.equal(drafts(f.db).length, 1);
    assert.equal(f.db.rows("tasks").length, 1);
    assert.ok(replay.artifacts?.some((artifact) => artifact.id === child.id));
    cases.push("replay returns the same durable draft and does not duplicate inbox work");

    delete process.env.OPENROUTER_AGENT_MODEL;
    const deterministic = fixture();
    assert.equal((await run(deterministic)).status, "completed");
    assert.equal(calls, 0);
    assert.equal(drafts(deterministic.db).length, 1);
    process.env.OPENROUTER_AGENT_MODEL = "fixture-model";
    cases.push("deterministic qualification retains the same handoff");

    for (const disposition of ["partial", "failure"] as const) {
      mode = disposition;
      const incomplete = fixture();
      assert.equal(
        (await run(incomplete)).status,
        disposition === "failure" ? "failed" : "partial",
      );
      assert.equal(drafts(incomplete.db).length, 0);
    }
    mode = "success";
    cases.push("unfinished and failed AI runs cannot advance the Sales workflow");

    for (const stage of ["won", "lost", "proposal"]) {
      const changed = fixture();
      onFinal = () => {
        changed.db.rows("opportunities")[0]!.stage = stage;
      };
      assert.equal((await run(changed)).status, "completed");
      assert.equal(drafts(changed.db).length, 0);
    }
    onFinal = undefined;
    cases.push("opportunity changes during AI execution are checked before scheduling a draft");

    for (const table of ["contacts", "opportunities"]) {
      const foreign = fixture();
      foreign.db.rows(table)[0]!.tenant_id = "other-tenant";
      assert.equal((await run(foreign)).status, table === "contacts" ? "skipped" : "completed");
      assert.equal(drafts(foreign.db).length, 0);
      if (table === "contacts") assert.equal(calls, 0);
    }
    cases.push("foreign contacts and opportunities cannot create a cross-tenant handoff");

    const failure = fixture();
    onFinal = () => failure.db.fail("work_items", { message: "Fixture child persistence failed" });
    await assert.rejects(run(failure), /Fixture child persistence failed/);
    assert.equal(drafts(failure.db).length, 0);
    assert.ok(
      !failure.db.rows("audit_log").some((row) => row.action === "sales_coworker.qualified_lead"),
    );
    onFinal = undefined;
    failure.db.recover("work_items");
    assert.equal((await run(failure)).status, "completed");
    assert.equal(drafts(failure.db).length, 1);
    cases.push("child persistence failure propagates and recovery creates one draft");
    return cases;
  } finally {
    globalThis.fetch = savedFetch;
    if (savedModel === undefined) delete process.env.OPENROUTER_AGENT_MODEL;
    else process.env.OPENROUTER_AGENT_MODEL = savedModel;
    if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = savedKey;
  }
}
