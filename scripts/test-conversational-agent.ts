import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { runWithTenantRequestContext, type TenantActorContext } from "../src/lib/tenancy/context";
import {
  previewAgentWork,
  startAgentWork,
  getAgentWork,
  controlAgentWork,
  registerAgentWorkHandler,
} from "../src/lib/revenue-os/agent-work";
import { getWorkKindHandler } from "../src/lib/revenue-os/work-executor";
import {
  executeRegisteredRevenueTool,
  getRevenueAiTools,
  toActivatedOpenRouterTools,
} from "../src/lib/revenue-os/ai-tools";
import { internalPermissionSchema } from "../src/lib/revenue-os/internal-permission-contract";
import { runDemoAgent } from "../src/lib/admin/demo/agent";
import { withDemoInference, demoSession } from "../src/lib/admin/demo/agent-inference";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { createDemoBusinessState } from "../src/lib/admin/demo/business-runtime";
import { seedDemoCollections } from "../src/lib/admin/demo/collections-runtime";
import { DEMO_SCENARIOS } from "../src/lib/admin/demo/scenarios";
import type { OpenRouterResponse } from "../src/lib/ai/openrouter";
import type { WorkItem } from "../src/lib/revenue-os/work-items";
async function main() {
  const tenantId = randomUUID(),
    userId = randomUUID(),
    email = "member@example.test";
  const mem = new AuthorizedMemorySupabase({
    tenants: [{ id: tenantId, status: "active", config: {} }],
    tenant_memberships: [
      {
        tenant_id: tenantId,
        user_id: userId,
        role: "admin",
        status: "active",
        invited_email: email,
      },
    ],
    budget_limits: [
      {
        tenant_id: tenantId,
        coworker_id: "*",
        budget_kind: "vendor_api_calls",
        period: "daily",
        limit_value: 20,
      },
    ],
    budget_usage: [],
  });
  mem.idFactory = () => randomUUID();
  const client = {
    ...(mem.client as unknown as Record<string, unknown>),
    auth: {
      admin: { getUserById: async () => ({ data: { user: { id: userId, email } }, error: null }) },
    },
  };
  const db = bindTenantDatabase(client as never, tenantId, true);
  const actor: TenantActorContext = {
    kind: "actor",
    database: db,
    user: { id: userId, email },
    role: "admin",
    isPlatformAdmin: false,
    tenant: { id: tenantId, slug: "test", name: "Test", status: "active", config: {} },
  };
  await runWithTenantRequestContext(actor, async () => {
    const plan = {
      objective: "Prepare the client handoff",
      steps: [
        { title: "Read context", instruction: "Read the exact client opportunity" },
        { title: "Prepare follow-up", instruction: "Prepare a reply and create a follow-up task" },
      ],
    };
    const preview = await previewAgentWork(db, plan, email);
    const requestId = randomUUID();
    const started = await startAgentWork(db, { plan, digest: preview.digest, requestId }, email);
    assert.equal(started.status, "pending");
    const row = mem.rows("work_items")[0]!;
    row.status = "pending";
    assert.equal(
      (await startAgentWork(db, { plan, digest: preview.digest, requestId }, email)).workItemId,
      started.workItemId,
    );
    await assert.rejects(
      startAgentWork(db, { plan, digest: "0".repeat(64), requestId: randomUUID() }, email),
      /changed/,
    );
    await assert.rejects(
      startAgentWork(
        db,
        {
          plan: { ...plan, objective: "Another objective" },
          digest: (await previewAgentWork(db, { ...plan, objective: "Another objective" }, email))
            .digest,
          requestId,
        },
        email,
      ),
      /already used/,
    );
    const read = await getAgentWork(db, { workItemId: started.workItemId }, email);
    assert.equal(read.plan.steps.length, 2);
    const paused = await controlAgentWork(
      db,
      { workItemId: started.workItemId, control: "pause", revision: 1 },
      email,
    );
    assert.equal(paused.control, "paused");
    await assert.rejects(
      controlAgentWork(
        db,
        { workItemId: started.workItemId, control: "resume", revision: 1 },
        email,
      ),
      /changed/,
    );
    const resumed = await controlAgentWork(
      db,
      { workItemId: started.workItemId, control: "resume", revision: 2 },
      email,
    );
    assert.equal(resumed.control, "running");
    const mcp = await handleMcpRequest(
      {
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: { name: "get_agent_work", arguments: { workItemId: started.workItemId } },
      },
      { supabase: db, actorEmail: email, principalKind: "workspace_member" },
    );
    assert.equal(mcp?.result?.isError, false);
    assert.equal(
      JSON.parse((mcp?.result?.content as Array<{ text: string }>)[0]!.text).workItemId,
      started.workItemId,
    );
    assert.ok(
      toActivatedOpenRouterTools(null, {}).some(
        (tool) => tool.function.name === "start_agent_work",
      ),
    );
    await assert.rejects(
      executeRegisteredRevenueTool({ supabase: db, actorEmail: email }, "approve_action", {}),
      /not registered/,
    );
    const otherActor = { ...actor, user: { id: randomUUID(), email } };
    await runWithTenantRequestContext(otherActor, () =>
      assert.rejects(getAgentWork(db, { workItemId: started.workItemId }, email), /not found/),
    );
    registerAgentWorkHandler();
    const progress = row.agent_plan as { steps: Array<Record<string, unknown>> };
    const actionId = randomUUID();
    progress.steps[0]!.status = "awaiting_approval";
    progress.steps[0]!.actionIds = [actionId];
    mem.tables.action_queue = [{ tenant_id: tenantId, id: actionId, status: "pending" }];
    row.lease_owner = "test";
    row.attempt_count = 1;
    const handler = getWorkKindHandler("agent_work")!;
    assert.equal((await handler(db, row as unknown as WorkItem)).status, "awaiting_approval");
    mem.tables.action_queue[0]!.status = "executed";
    assert.equal((await handler(db, row as unknown as WorkItem)).status, "deferred");
    assert.equal((row.agent_plan as typeof progress).steps[0]!.status, "completed");
    // An interrupted step is retained for reconciliation, never replayed.
    (row.agent_plan as typeof progress).steps[1]!.status = "running";
    assert.equal((await handler(db, row as unknown as WorkItem)).status, "reconciliation_required");
    mem.rows("tenant_memberships")[0]!.status = "revoked";
    await assert.rejects(handler(db, row as unknown as WorkItem), /no longer active/);
  });
  assert.throws(() =>
    internalPermissionSchema.parse({
      actionKey: "send_email",
      recordIds: [randomUUID()],
      allowedFields: ["body"],
      expiresAt: new Date().toISOString(),
      maxDailyActions: 5,
    }),
  );
  assert.throws(() =>
    internalPermissionSchema.parse({
      actionKey: "update_task",
      recordIds: [randomUUID()],
      allowedFields: ["deleted"],
      expiresAt: new Date().toISOString(),
      maxDailyActions: 5,
    }),
  );
  await assert.rejects(
    withDemoInference("a".repeat(64), randomUUID(), async () => null),
    /dedicated provider/,
  );
  process.env.DEMO_AI_SESSION_SECRET = "controlled-test-key".repeat(3);
  const session = demoSession();
  assert.equal(demoSession(session.cookie).key, session.key);
  assert.notEqual(demoSession(session.cookie + "tampered").key, session.key);
  for (const pack of Object.values(DEMO_SCENARIOS)) {
    const snapshot = {
      contacts: pack.people.map(({ id, name, email, company }) => ({ id, name, email, company })),
      opportunities: pack.opportunities.map(({ id, name, personId, stage, nextAction, value }) => ({
        id,
        name,
        personId,
        stage,
        nextAction,
        value,
      })),
      tasks: [],
      conversations: pack.conversations.map(({ id, personId, subject, unread, messages }) => ({
        id,
        personId,
        subject,
        unread,
        messages,
      })),
    };
    let turn = 0;
    const result = await runDemoAgent(
      {
        scenarioId: pack.id,
        clientMessageId: randomUUID(),
        text: "Prepare a useful reply and follow-up",
        history: [],
        snapshot,
      },
      async (messages, tools) => {
        assert.ok(messages.some((message) => message.content?.includes("Prepare a useful reply")));
        assert.ok(
          tools.every(
            (tool) => !/approve|execute|publish|permission|billing/.test(tool.function.name),
          ),
        );
        const response: OpenRouterResponse = {
          id: `test-${turn}`,
          model: "controlled-model",
          choices: [{ message: { role: "assistant", content: null } }],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        };
        if (turn++ === 0)
          response.choices[0]!.message.tool_calls = [
            {
              id: "read",
              type: "function",
              function: {
                name: "read_complete_gmail_thread",
                arguments: JSON.stringify({ conversationId: pack.conversations[0]!.id }),
              },
            },
            {
              id: "reply",
              type: "function",
              function: {
                name: "propose_conversation_reply",
                arguments: JSON.stringify({
                  conversationId: pack.conversations[0]!.id,
                  body: "Thanks for the inquiry. What time works for a call?",
                  reasoning: "Prepare the requested follow-up",
                }),
              },
            },
            {
              id: "task",
              type: "function",
              function: {
                name: "propose_task",
                arguments: JSON.stringify({
                  title: "Follow up on the inquiry",
                  priority: "high",
                  opportunityId: pack.opportunities[0]!.id,
                }),
              },
            },
            {
              id: "attack",
              type: "function",
              function: { name: "execute_action", arguments: "{}" },
            },
          ];
        else
          response.choices[0]!.message.content = "The two proposals are ready for your approval.";
        return response;
      },
    );
    assert.equal(result.status, "partial");
    assert.equal(result.proposals.length, 2);
    assert.equal(
      result.proposals[0]!.payload.to,
      pack.people.find((person) => person.id === pack.conversations[0]!.personId)!.email,
    );
    assert.equal(result.usage.inputTokens, 200);
    assert.equal(result.usage.outputTokens, 40);
    assert.ok(
      result.events.some(
        (event) =>
          event.type === "tool_completed" && event.name === "execute_action" && event.failed,
      ),
    );
    assert.equal(result.proposals[0]!.status, "pending");
  }
  // Preview and propose use the existing collection renderer and hold checks.
  const pack = DEMO_SCENARIOS["northline-roofing"];
  const state = createDemoBusinessState(pack);
  const cases = seedDemoCollections(pack, state);
  const snapshot = {
    brand: state.brand,
    brandRevision: state.brandRevision,
    cooldownHours: 72,
    collections: cases.map(
      ({
        id,
        contactId,
        name,
        email,
        currency,
        status,
        revision,
        disputed,
        paused,
        pauseUntil,
        promiseDate,
        nextAction,
        invoices,
      }) => ({
        id,
        contactId,
        name,
        email,
        currency,
        status,
        revision,
        disputed,
        paused,
        pauseUntil,
        promiseDate,
        nextAction,
        invoices,
      }),
    ),
    contacts: pack.people.map(({ id, name, email, company }) => ({ id, name, email, company })),
    opportunities: pack.opportunities.map(({ id, name, personId, stage, nextAction, value }) => ({
      id,
      name,
      personId,
      stage,
      nextAction,
      value,
    })),
    tasks: [],
    conversations: [],
  };
  let turn = 0;
  const reminder = await runDemoAgent(
    {
      scenarioId: pack.id,
      clientMessageId: randomUUID(),
      text: "Prepare an overdue invoice reminder",
      history: [],
      snapshot,
    },
    async (messages) => {
      const last = messages.at(-1);
      const preview = last?.role === "tool" ? JSON.parse(last.content || "{}") : null;
      const message =
        turn++ === 0
          ? {
              role: "assistant" as const,
              content: null,
              tool_calls: [
                {
                  id: "preview",
                  type: "function" as const,
                  function: {
                    name: "preview_collection_reminder",
                    arguments: JSON.stringify({ caseId: cases[0]!.id }),
                  },
                },
              ],
            }
          : turn === 2
            ? {
                role: "assistant" as const,
                content: null,
                tool_calls: [
                  {
                    id: "propose",
                    type: "function" as const,
                    function: {
                      name: "propose_collection_reminder",
                      arguments: JSON.stringify({ caseId: cases[0]!.id, digest: preview.digest }),
                    },
                  },
                ],
              }
            : {
                role: "assistant" as const,
                content: "The exact reminder is ready for your approval.",
              };
      return { id: `reminder-${turn}`, model: "controlled-model", choices: [{ message }] };
    },
  );
  assert.equal(reminder.proposals.length, 1);
  assert.equal(reminder.proposals[0]!.action_type, "send_collection_reminder");
  assert.equal(reminder.usage.inputTokens, null, "Unknown token usage must stay unknown");
  assert.ok(reminder.proposals[0]!.payload.digest);
  const held = await runDemoAgent(
    {
      scenarioId: pack.id,
      clientMessageId: randomUUID(),
      text: "Prepare the disputed invoice reminder",
      history: [],
      snapshot,
    },
    async () => ({
      id: "held",
      model: "controlled-model",
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "held",
                type: "function",
                function: {
                  name: "preview_collection_reminder",
                  arguments: JSON.stringify({ caseId: cases[2]!.id }),
                },
              },
            ],
          },
        },
      ],
    }),
  );
  assert.equal(held.proposals.length, 0);
  assert.ok(held.events.some((event) => event.type === "tool_completed" && event.failed));
  for (const name of [
    "preview_agent_work",
    "start_agent_work",
    "get_agent_work",
    "control_agent_work",
    "preview_internal_permission",
    "propose_internal_permission",
    "propose_next_action",
  ])
    assert.ok(getRevenueAiTools().some((tool) => tool.name === name));
  console.log(
    "Conversational agent: ordered work, replay, controls, requester revocation, sandbox isolation, six businesses and measured telemetry passed",
  );
}
main().catch((issue) => {
  console.error(issue);
  process.exitCode = 1;
});
