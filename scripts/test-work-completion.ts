import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import {
  createWorkItem,
  settleWorkItem,
  withWorkItem,
  type WorkItem,
} from "../src/lib/revenue-os/work-items";
import { deferWork } from "../src/lib/revenue-os/work-result";
import {
  executeClaimableWork,
  registerWorkKindHandler,
  getWorkKindHandler,
  workExecutionStatus,
} from "../src/lib/revenue-os/work-executor";
import { runCoworkerAgentTask } from "../src/lib/revenue-os/coworker-agent";
import { registerSalesWorkHandlers } from "../src/lib/revenue-os/sales-coworker";
import { findWorkDraft, workDraftKey } from "../src/lib/revenue-os/work-drafts";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import type { OpenRouterMessage, openRouterChat } from "../src/lib/ai/openrouter";

const iso = (ms: number) => new Date(Date.now() + ms).toISOString();
function item(overrides: Row = {}): WorkItem {
  return {
    id: "work-1",
    tenant_id: "tenant-a",
    coworker_id: "sales",
    kind: "draft_followup",
    objective: "Prepare follow-up",
    reason: "Customer awaits reply",
    source: "test",
    entity_type: "opportunity",
    entity_id: "opp-1",
    priority: "high",
    status: "in_progress",
    lease_owner: "worker-a",
    claimed_at: iso(-1000),
    lease_expires_at: iso(60_000),
    attempt_count: 1,
    max_attempts: 3,
    next_check_at: null,
    next_check_reason: null,
    outcome: null,
    error: null,
    ...overrides,
  } as WorkItem;
}
function seed(wi = item()) {
  const db = new MemorySupabase({
    work_items: [{ ...wi }],
    coworkers: [
      {
        id: "sales",
        name: "Sales",
        role: "sales",
        tool_pack: "pipeline",
        status: "active",
        required_capabilities: [],
      },
    ],
    contacts: [{ id: "contact-1", tenant_id: "tenant-a", email: "customer@example.test" }],
    opportunities: [
      {
        id: "opp-1",
        tenant_id: "tenant-a",
        contact_id: "contact-1",
        stage: "proposal",
        company_name: "Example",
      },
    ],
    conversations: [
      {
        id: "conv-1",
        tenant_id: "tenant-a",
        opportunity_id: "opp-1",
        contact_id: "contact-1",
        channel: "gmail",
      },
    ],
  });
  db.rpc("resolve_workspace_capability", (args) => ({
    capability_key: args.p_capability_key,
    available: false,
    policy: null,
    status_reason: "Capability not registered in this workspace",
    verified_at: null,
  }));
  db.rpc("record_budget_usage", () => ({}));
  db.rpc("increment_budget_usage", () => ({}));
  db.rpc("claim_work_item", (args) => {
    const row = db
      .rows("work_items")
      .find(
        (r) =>
          r.kind === args.p_kind &&
          ["pending", "waiting"].includes(String(r.status)) &&
          (!r.next_check_at || String(r.next_check_at) <= iso(0)),
      );
    if (!row)
      return {
        work_item_id: null,
        claimed: false,
        existing_status: "none_available",
        recovered_stale: false,
      };
    Object.assign(row, {
      status: "claimed",
      lease_owner: args.p_lease_owner,
      claimed_at: iso(0),
      lease_expires_at: iso(60_000),
      attempt_count: Number(row.attempt_count) + 1,
    });
    return {
      work_item_id: row.id,
      claimed: true,
      existing_status: "claimed",
      recovered_stale: false,
    };
  });
  return db;
}
function proposal(wi = item(), overrides: Row = {}): Row {
  return {
    id: "proposal-1",
    tenant_id: wi.tenant_id,
    dedupe_key: workDraftKey(wi),
    status: "pending",
    action_type: "send_email",
    entity_type: "opportunity",
    entity_id: wi.entity_id,
    expires_at: iso(60_000),
    payload: {
      opportunityId: wi.entity_id,
      workItemId: wi.id,
      to: "customer@example.test",
      subject: "Follow-up",
      body: "Hello",
    },
    ...overrides,
  };
}
const auditFixtures: Row[] = [];
let checks = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks++;
  console.log(`ok ${checks} - ${name}`);
}
const chat = (messages: OpenRouterMessage[]): typeof openRouterChat => {
  let index = 0;
  return async () =>
    ({
      id: "test-response",
      model: "test-model",
      choices: [{ message: messages[Math.min(index++, messages.length - 1)]! }],
    }) as Awaited<ReturnType<typeof openRouterChat>>;
};
const call = (name: string, args: Record<string, unknown> = {}): OpenRouterMessage => ({
  role: "assistant",
  content: null,
  tool_calls: [
    { id: "call-1", type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

async function main() {
  registerSalesWorkHandlers();
  const savedModel = process.env.OPENROUTER_AGENT_MODEL;
  try {
    for (const status of ["completed", "skipped", "partial", "failed"] as const) {
      await check(`${status} persists its lifecycle and truthful activity`, async () => {
        const wi = item();
        const db = seed(wi);
        await settleWorkItem(db.client, wi, {
          status,
          outcome: "Receipt",
          artifacts: [{ type: "action", id: "artifact-1" }],
        });
        auditFixtures.push(...db.rows("audit_log"));
        const row = db.rows("work_items")[0]!;
        assert.equal(
          row.status,
          { completed: "completed", skipped: "cancelled", partial: "pending", failed: "pending" }[
            status
          ],
        );
        assert.equal(row.lease_owner, null);
        assert.equal(db.rows("activities").length, status === "completed" ? 1 : 0);
        assert.match(String(row.outcome), /artifact-1/);
      });
    }
    await check("defer preserves execution attempts and future retry reason", async () => {
      const wi = item();
      const db = seed(wi);
      await settleWorkItem(db.client, wi, deferWork("Connect Google"));
      auditFixtures.push(...db.rows("audit_log"));
      const row = db.rows("work_items")[0]!;
      assert.equal(row.status, "waiting");
      assert.equal(row.attempt_count, 0);
      assert.ok(String(row.next_check_at) > iso(0));
      assert.equal(row.next_check_reason, "Connect Google");
      assert.equal(row.finished_at, null);
    });
    await check("future child work cannot execute before its scheduled check", async () => {
      const db = seed();
      const dueAt = iso(86_400_000);
      const child = await createWorkItem(db.client, {
        kind: "future-check",
        objective: "Check for reply",
        reason: "Allow reply time",
        source: "sales",
        dueAt,
      });
      // Apply the database status default omitted by the in-memory adapter.
      db.rows("work_items").find((row) => row.id === child.workItem.id)!.status = "pending";
      let called = false;
      const result = await withWorkItem(db.client, "future-check", async () => {
        called = true;
        return { status: "completed", outcome: "Checked" };
      });
      assert.equal(result.claimed, false);
      assert.equal(called, false);
      assert.equal(child.workItem.next_check_at, dueAt);
    });
    await check("exhausted failures are terminal", async () => {
      const wi = item({ attempt_count: 3 });
      const db = seed(wi);
      await settleWorkItem(db.client, wi, { status: "failed", outcome: "Provider unavailable" });
      assert.equal(db.rows("work_items")[0]!.status, "failed");
    });
    for (const changed of [
      { status: "cancelled" },
      { lease_owner: "worker-b" },
      { attempt_count: 2 },
      { claimed_at: iso(500) },
      { lease_expires_at: iso(-1) },
      { tenant_id: "tenant-b" },
    ]) {
      await check(`claim fence rejects ${Object.keys(changed)[0]}`, async () => {
        const wi = item();
        const db = seed(wi);
        Object.assign(db.rows("work_items")[0]!, changed);
        await assert.rejects(
          () => settleWorkItem(db.client, wi, { status: "completed", outcome: "Finished" }),
          /claim/,
        );
        assert.equal(db.rows("activities").length, 0);
        assert.equal(db.rows("audit_log").length, 0);
      });
    }
    await check("wrapper completes exactly once and does not claim twice", async () => {
      const db = seed(item({ status: "pending", attempt_count: 0 }));
      let executions = 0;
      const run = () =>
        withWorkItem(db.client, "draft_followup", async () => {
          executions++;
          return { status: "completed", outcome: "Saved" };
        });
      assert.equal((await run()).persisted, true);
      assert.equal((await run()).claimed, false);
      assert.equal(executions, 1);
      assert.equal(db.rows("activities").length, 1);
    });
    await check("wrapper preserves cancellation during execution", async () => {
      const db = seed(item({ status: "pending", attempt_count: 0 }));
      const result = await withWorkItem(db.client, "draft_followup", async () => {
        db.rows("work_items")[0]!.status = "cancelled";
        return { status: "completed", outcome: "Too late" };
      });
      assert.equal(result.persisted, false);
      assert.equal(db.rows("work_items")[0]!.status, "cancelled");
      assert.equal(db.rows("activities").length, 0);
    });
    await check("completion telemetry failure cannot roll back or repeat work", async () => {
      const wi = item();
      const db = seed(wi);
      db.fail("activities", { message: "ledger offline" });
      const errors = await settleWorkItem(db.client, wi, { status: "completed", outcome: "Saved" });
      assert.equal(db.rows("work_items")[0]!.status, "completed");
      assert.equal(errors.length, 1);
    });
    for (const gate of [
      "capability",
      "policy",
      "budget",
      "policy-error",
      "budget-error",
      "manifest-error",
    ]) {
      await check(`${gate} never completes work`, async () => {
        const db = seed(item({ status: "pending", attempt_count: 0 }));
        if (gate === "capability") db.rows("coworkers")[0]!.required_capabilities = ["gmail.read"];
        if (gate === "policy")
          db.tables.learned_policies = [
            {
              action_key: "work:draft_followup",
              rule: "Never execute",
              scope_entity_type: null,
              superseded_at: null,
            },
          ];
        if (gate === "budget")
          db.tables.budget_limits = [
            { coworker_id: "sales", budget_kind: "model_spend", limit_value: 0 },
          ];
        if (gate.endsWith("error"))
          db.fail(
            (
              {
                "policy-error": "learned_policies",
                "budget-error": "budget_limits",
                "manifest-error": "coworkers",
              } as Record<string, string>
            )[gate]!,
            { message: "offline" },
          );
        let ran = false;
        registerWorkKindHandler("draft_followup", async () => {
          ran = true;
          return { status: "completed", outcome: "Oops" };
        });
        const result = await executeClaimableWork(db.client, { kinds: ["draft_followup"] });
        assert.equal(ran, false);
        assert.equal(result.completed, 0);
        assert.equal(
          db.rows("work_items")[0]!.status,
          gate.endsWith("error") ? "pending" : "waiting",
        );
        assert.notEqual(workExecutionStatus(result), "success");
        if (gate === "budget")
          assert.match(String(db.rows("work_items")[0]!.next_check_at), /T00:00:00.000Z$/);
      });
    }
    registerSalesWorkHandlers();
    delete process.env.OPENROUTER_AGENT_MODEL;
    await check(
      "missing model leaves drafting waiting without pretending to create a draft",
      async () => {
        const result = await getWorkKindHandler("draft_followup")!(seed().client, item());
        assert.equal(result.status, "deferred");
      },
    );
    await check(
      "existing valid draft completes without a model and without another proposal",
      async () => {
        const db = seed();
        db.tables.action_queue = [proposal()];
        const result = await getWorkKindHandler("draft_followup")!(db.client, item());
        assert.equal(result.status, "completed");
        assert.equal(result.artifacts?.[0]?.id, "proposal-1");
        assert.equal(db.rows("action_queue").length, 1);
      },
    );
    for (const overrides of [
      { tenant_id: "tenant-b" },
      { entity_id: "opp-other" },
      { status: "rejected" },
      { expires_at: iso(-1000) },
      { payload: { ...(proposal().payload as Row), workItemId: "other" } },
    ]) {
      await check(
        `invalid draft cannot satisfy completion: ${Object.keys(overrides)[0]}`,
        async () => {
          const db = seed();
          db.tables.action_queue = [proposal(item(), overrides)];
          assert.equal(await findWorkDraft(db.client, item()), null);
        },
      );
    }
    await check("wrong recipient cannot prove a draft", async () => {
      const db = seed();
      db.tables.action_queue = [
        proposal(item(), { payload: { ...(proposal().payload as Row), to: "other@example.test" } }),
      ];
      await assert.rejects(() => findWorkDraft(db.client, item()), /recipient/);
    });
    await check(
      "server work identity deduplicates email proposals and leaves them pending",
      async () => {
        const db = seed();
        const wi = item();
        const context = {
          supabase: db.client,
          actorEmail: "coworker:sales",
          toolPack: "outreach" as const,
          workItem: wi,
        };
        const input = {
          to: "customer@example.test",
          opportunityId: "opp-1",
          subject: "Follow-up",
          body: "Hello",
          reasoning: "Awaiting reply",
        };
        const first = await executeRegisteredRevenueTool(context, "propose_send_email", input);
        // MemorySupabase has no tenant default; emulate the tenant-bound client's insert behavior.
        db.rows("action_queue")[0]!.tenant_id = "tenant-a";
        const second = await executeRegisteredRevenueTool(context, "propose_send_email", {
          ...input,
          subject: "Changed wording",
          body: "Hello again",
        });
        assert.equal((first.output as Row).id, (second.output as Row).id);
        assert.equal(db.rows("action_queue").length, 1);
        assert.equal(db.rows("action_queue")[0]!.status, "pending");
        assert.equal(db.rows("action_queue")[0]!.dedupe_key, workDraftKey(wi));
      },
    );
    await check(
      "required child creation errors propagate instead of claiming queued work",
      async () => {
        const db = seed();
        db.fail("work_items", { message: "work storage offline" });
        await assert.rejects(
          () =>
            getWorkKindHandler("review_stale_proposal")!(
              db.client,
              item({ kind: "review_stale_proposal" }),
            ),
          /work storage offline/,
        );
      },
    );
    process.env.OPENROUTER_AGENT_MODEL = "test-model";
    await check("AI prose without tools cannot complete work", async () => {
      const db = seed();
      const result = await runCoworkerAgentTask(db.client, item(db.rows("work_items")[0]), {
        chat: chat([{ role: "assistant", content: "Draft ready" }]),
      });
      assert.equal(result.status, "partial");
      assert.equal(db.rows("action_queue").length, 0);
    });
    await check("AI turn exhaustion stays partial with a durable run link", async () => {
      const db = seed();
      const result = await runCoworkerAgentTask(db.client, item(db.rows("work_items")[0]), {
        chat: chat([call("get_pending_actions")]),
      });
      assert.equal(result.status, "partial");
      assert.ok(result.runId);
      assert.equal(db.rows("work_items")[0]!.agent_run_id, result.runId);
      assert.equal(db.rows("agent_runs")[0]!.status, "partial");
    });
    await check("AI failure stays failed", async () => {
      const db = seed();
      const result = await runCoworkerAgentTask(db.client, item(db.rows("work_items")[0]), {
        chat: async () => {
          throw new Error("model outage");
        },
      });
      assert.equal(result.status, "failed");
      assert.equal(db.rows("agent_runs")[0]!.status, "failed");
    });
    await check(
      "draft tools are available and successful drafting requires the saved proposal",
      async () => {
        const db = seed();
        let turn = 0;
        const result = await runCoworkerAgentTask(db.client, item(db.rows("work_items")[0]), {
          chat: async (request) => {
            assert.ok(request.tools?.some((t) => t.function.name === "propose_send_email"));
            assert.ok(
              !request.tools?.some((t) => t.function.name === "propose_campaign_activation"),
            );
            if (turn++ === 0)
              return chat([
                call("propose_send_email", {
                  to: "customer@example.test",
                  opportunityId: "opp-1",
                  subject: "Follow-up",
                  body: "Hello",
                  reasoning: "Awaiting reply",
                }),
              ])(request);
            db.rows("action_queue")[0]!.tenant_id = "tenant-a";
            return chat([{ role: "assistant", content: "Ready for review" }])(request);
          },
        });
        assert.equal(result.status, "completed");
        assert.equal(result.artifacts?.length, 1);
        assert.equal(db.rows("action_queue")[0]!.status, "pending");
      },
    );
  } finally {
    if (savedModel === undefined) delete process.env.OPENROUTER_AGENT_MODEL;
    else process.env.OPENROUTER_AGENT_MODEL = savedModel;
  }
  if (process.argv.includes("--browser-fixtures")) {
    writeFileSync(
      "/tmp/accelerate-work-completion-fixtures.json",
      JSON.stringify(
        auditFixtures.map((row, index) => ({
          id: `work-audit-${index}`,
          actorEmail: "system",
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id,
          source: row.source,
          before: row.before_state,
          after: row.after_state,
          metadata: row.metadata,
          createdAt: new Date(Date.now() - index * 60_000).toISOString(),
        })),
      ),
    );
  }
  console.log(JSON.stringify({ result: "passed", cases: checks }));
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
