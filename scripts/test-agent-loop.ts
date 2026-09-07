#!/usr/bin/env tsx
/**
 * Deterministic coverage for the command agent's loop, with OpenRouter stubbed
 * at the fetch boundary so the real gateway and the real agent both execute.
 *
 * Three defects are pinned here:
 *
 *   - **The model never knew what day it was.** A triage tool whose whole job is
 *     "what is overdue, who has gone quiet, follow up in three days" was
 *     reasoning about "today" from its training cutoff. Every relative date it
 *     produced was wrong, and confidently so.
 *   - **Turn exhaustion threw.** The founder lost the entire answer, the run was
 *     recorded as an outright failure, and any propose_* actions staged on
 *     earlier turns stayed in the approval queue as orphans with no conversation
 *     explaining where they came from.
 *   - **The transcript grew without bound.** Tool results were pushed in whole
 *     and re-sent on every subsequent turn, so one large result compounded
 *     across the run until it exhausted the context window mid-answer.
 */
import assert from "node:assert/strict";
import { runRevenueCommandAgent } from "../src/lib/revenue-os/ai-agent";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";

process.env.OPENROUTER_API_KEY = "sk-or-v1-test-key-not-real";

type Row = Record<string, unknown>;
type Sent = {
  tools: Array<{ function: { name: string } }>;
  messages: Array<{ role: string; content?: string }>;
};

const realFetch = globalThis.fetch;
let sent: Sent[] = [];

/** Reply the stub gives on each turn: a tool call, or a final answer. */
function toolCallTurn(index: number) {
  return {
    id: `req-${index}`,
    model: "stub/model",
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [
      {
        message: {
          role: "assistant",
          content: `Working on step ${index}.`,
          tool_calls: [
            {
              id: `call-${index}`,
              type: "function",
              function: { name: "get_today_snapshot", arguments: "{}" },
            },
          ],
        },
      },
    ],
  };
}

function stubOpenRouter(reply: (turn: number) => unknown) {
  let turn = 0;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)) as Sent);
    const body = reply(turn);
    turn += 1;
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as typeof fetch;
}

/**
 * Minimal Supabase stand-in. Reads resolve to whatever `tables` holds; writes
 * are recorded so the terminal state of the run can be asserted.
 */
function stubSupabase(tables: Record<string, Row[]> = {}) {
  const seededTables: Record<string, Row[]> = {
    tenants: [{ id: ACCELERATE_TENANT_ID, slug: "accelerate", status: "active" }],
    integration_connections: [],
    // Fixture approval exercises the real gateway; no live-model evaluation is implied.
    admin_settings: [
      {
        tenant_id: ACCELERATE_TENANT_ID,
        key: "ai-model:openai/gpt-4.1-mini",
        value: JSON.stringify({
          label: "Controlled fixture",
          costTier: "low",
          supportsTools: true,
          supportsJson: true,
          contextWindow: 1047576,
          evalPassed: true,
          evaluatedAt: "2026-09-06T00:00:00Z",
          evaluatedBy: "fixture@example.test",
        }),
      },
    ],
    ...tables,
  };
  const writes: Array<{ table: string; op: "insert" | "update"; payload: Row }> = [];

  function query(table: string): Record<string, unknown> {
    let pending: { op: "insert" | "update"; payload: Row } | null = null;
    let expectsSingle = false;
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const method of [
      "select",
      "eq",
      "neq",
      "gt",
      "gte",
      "lt",
      "lte",
      "is",
      "in",
      "not",
      "or",
      "filter",
      "order",
      "limit",
      "range",
    ]) {
      self[method] = chain;
    }
    self.maybeSingle = () => {
      expectsSingle = true;
      return self;
    };
    self.single = () => {
      expectsSingle = true;
      return self;
    };
    for (const op of ["insert", "update"] as const) {
      self[op] = (payload: Row) => {
        pending = { op, payload };
        writes.push({ table, op, payload });
        return self;
      };
    }
    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      const rows = seededTables[table] ?? [];
      return resolve(
        pending
          ? { data: { id: "run-1", ...pending.payload }, error: null }
          : { data: expectsSingle ? (rows[0] ?? null) : rows, error: null },
      );
    };
    return self;
  }

  return { client: { from: (table: string) => query(table) } as never, writes };
}

const ask = [{ role: "user" as const, content: "What should I do today?" }];

function runAgent(client: Parameters<typeof runRevenueCommandAgent>[0]) {
  return runRevenueCommandAgent(
    bindTenantDatabaseForTest(client, ACCELERATE_TENANT_ID),
    "test@acceleratewith.us",
    ask,
  );
}

/** The system prompt the gateway actually received on a given request. */
function systemPrompt(request: Sent): string {
  return request.messages.find((message) => message.role === "system")?.content ?? "";
}

async function main() {
  // ---- The agent must be told the current date ---------------------------

  sent = [];
  stubOpenRouter(() => ({
    id: "req-final",
    model: "stub/model",
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [
      {
        message: {
          role: "assistant",
          content:
            "Facts\nNo verified facts are available.\nInferences\nNone.\nMissing information\nNo live snapshot was requested.\nRecommended next steps\nRequest the live today snapshot.",
        },
      },
    ],
  }));

  const plain = stubSupabase();
  const answered = await runAgent(plain.client);
  assert.match(answered.text, /^Facts\n/);

  const prompt = systemPrompt(sent[0]!);
  const today = new Date().toISOString().slice(0, 10);
  assert.ok(
    prompt.includes(today),
    `the system prompt must carry today's ISO date (${today}); without it every relative date the model produces is wrong.\n  got: ${prompt.slice(0, 400)}`,
  );
  assert.match(
    prompt,
    /never infer the date from memory/i,
    "the prompt must tell the model not to fall back on its training cutoff",
  );

  const completed = plain.writes.find(
    (write) => write.table === "agent_runs" && write.op === "update",
  );
  assert.equal(
    completed?.payload.status,
    "completed",
    "a run that produced a final answer must be recorded as completed",
  );

  sent = [];
  stubOpenRouter(() => ({
    id: "req-ungrounded",
    model: "stub/model",
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [{ message: { role: "assistant", content: "Nothing is overdue." } }],
  }));
  const rejected = stubSupabase();
  const rejectedAnswer = await runAgent(rejected.client);
  assert.match(
    rejectedAnswer.text,
    /did not pass the grounding contract/i,
    "unstructured unsupported prose must be replaced by a safe explicit degraded answer",
  );
  const rejectedTerminal = rejected.writes.find(
    (write) => write.table === "agent_runs" && write.op === "update",
  );
  assert.equal(
    rejectedTerminal?.payload.status,
    "partial",
    "a rejected final answer must never be recorded as a completed grounded run",
  );

  // ---- Turn exhaustion returns what it has, and is not a failure ----------

  sent = [];
  stubOpenRouter(toolCallTurn);
  const exhausted = stubSupabase();
  const partial = await runAgent(exhausted.client);

  assert.ok(
    partial.text.length > 0,
    "turn exhaustion must return what the run gathered instead of throwing the answer away",
  );
  assert.match(
    partial.text,
    /Working on step 0/,
    "the assistant's own reasoning from earlier turns must survive",
  );
  assert.match(
    partial.text,
    /stopped after 5 tool steps/i,
    "the founder must be told why the answer is incomplete",
  );

  const terminal = exhausted.writes.find(
    (write) => write.table === "agent_runs" && write.op === "update",
  );
  assert.equal(
    terminal?.payload.status,
    "partial",
    "an exhausted run must reach a terminal state; leaving it 'running' makes it un-reapable and blocks nothing but tells nobody",
  );
  assert.ok(terminal?.payload.finished_at, "a terminal run must record finished_at");
  assert.ok(
    String(terminal?.payload.error ?? "").includes("5 tool turns"),
    "the ledger must say why the run stopped",
  );

  // The loop must actually stop. Before the turn budget was named, an off-by-one
  // here would have been invisible.
  assert.equal(
    sent.length,
    5,
    `the agent must make exactly 5 model calls before stopping; got ${sent.length}`,
  );

  // ---- A staged proposal is named rather than orphaned -------------------

  sent = [];
  stubOpenRouter((turn) => ({
    id: `req-${turn}`,
    model: "stub/model",
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    choices: [
      {
        message: {
          role: "assistant",
          content: "Staging a task.",
          tool_calls: [
            {
              id: `call-${turn}`,
              type: "function",
              function: {
                name: "propose_task",
                arguments: JSON.stringify({ title: `Follow up ${turn}`, priority: "high" }),
              },
            },
          ],
        },
      },
    ],
  }));
  const staged = stubSupabase();
  const orphans = await runAgent(staged.client);

  assert.match(
    orphans.text,
    /staged for your approval/i,
    "actions staged before the run ran out of turns must be named, or they sit in the queue with nothing explaining them",
  );
  assert.match(
    orphans.text,
    /propose_task/,
    "the founder must be told which proposals to review or reject",
  );
  assert.ok(
    orphans.proposedActions.includes("propose_task"),
    "the caller must receive the staged proposals so the approval surface can reflect them",
  );

  // Discover a different domain from an opportunity page, activate on the next
  // turn, and stage through the real registry. A same-turn jump is refused.
  sent = [];
  const crossDomain = stubSupabase();
  const calls = [
    { name: "propose_founder_note", args: { body: "Must not be written" } },
    { name: "discover_tool_bundles", args: { query: "founder note" } },
    { name: "activate_tool_bundle", args: { bundleId: "core-command:1" } },
    { name: "propose_founder_note", args: { body: "Follow up on the reviewed customer plan" } },
  ];
  stubOpenRouter((turn) => ({
    id: `cross-${turn}`,
    model: "stub/model",
    choices: [
      {
        message: {
          role: "assistant",
          content: "Working with registered tools.",
          tool_calls:
            turn < calls.length
              ? [
                  {
                    id: `cross-call-${turn}`,
                    type: "function",
                    function: {
                      name: calls[turn]!.name,
                      arguments: JSON.stringify(calls[turn]!.args),
                    },
                  },
                ]
              : undefined,
        },
      },
    ],
  }));
  const crossResult = await runRevenueCommandAgent(
    bindTenantDatabaseForTest(crossDomain.client, ACCELERATE_TENANT_ID),
    "test@acceleratewith.us",
    [{ role: "user", content: "Record a founder note about the customer plan" }],
    {
      pageContext: {
        pathname: "/admin/pipeline",
        entity: { type: "opportunity", id: "00000000-0000-0000-0000-000000000001" },
      },
    },
  );
  assert.ok(sent.every((request) => request.tools.length <= 40));
  assert.ok(!sent[0]!.tools.some((tool) => tool.function.name === "propose_founder_note"));
  assert.ok(sent[3]!.tools.some((tool) => tool.function.name === "propose_founder_note"));
  assert.match(
    sent[1]!.messages.find((message) => message.role === "tool")!.content!,
    /not loaded/,
  );
  assert.ok(
    sent[2]!.messages.some(
      (message) =>
        message.role === "tool" &&
        message.content?.includes('"bundles"') &&
        message.content.includes("core-command:1"),
    ),
  );
  const noteWrites = crossDomain.writes.filter(
    (write) => write.table === "action_queue" && write.op === "insert",
  );
  assert.equal(noteWrites.length, 1);
  // The insert relies on action_queue's pending database default; no approval is written.
  assert.equal(noteWrites[0]!.payload.status, undefined);
  assert.deepEqual(crossResult.proposedActions, ["propose_founder_note"]);
  assert.equal(
    crossDomain.writes.filter(
      (write) =>
        !(write.table === "activities" && write.payload.activity_type === "model_call") &&
        ![
          "agent_runs",
          "agent_run_events",
          "action_queue",
          "audit_log",
          "ai_usage_events",
        ].includes(write.table),
    ).length,
    0,
  );

  // Failed proposal attempts cannot be reported as staged on turn exhaustion.
  sent = [];
  const refused = stubSupabase();
  stubOpenRouter((turn) => ({
    id: `refused-${turn}`,
    model: "stub/model",
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: `refused-call-${turn}`,
              type: "function",
              function: {
                name: "propose_founder_note",
                arguments: JSON.stringify({ body: "Unavailable" }),
              },
            },
          ],
        },
      },
    ],
  }));
  const refusedResult = await runAgent(refused.client);
  assert.deepEqual(refusedResult.proposedActions, []);
  assert.equal(refused.writes.filter((write) => write.table === "action_queue").length, 0);

  // Live disablement after activation removes the tool before the next call.
  sent = [];
  const liveTenant = {
    id: ACCELERATE_TENANT_ID,
    slug: "accelerate",
    status: "active",
    config: { modules: { campaigns: true } },
  };
  const changing = stubSupabase({ tenants: [liveTenant] });
  stubOpenRouter((turn) => {
    if (turn === 1) liveTenant.config.modules.campaigns = false;
    const name = turn === 0 ? "activate_tool_bundle" : "propose_campaign_activation";
    const args = turn === 0 ? { bundleId: "campaigns:1" } : { campaignId: "campaign-test" };
    return {
      id: `disable-${turn}`,
      model: "stub/model",
      choices: [
        {
          message: {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: `disable-call-${turn}`,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
        },
      ],
    };
  });
  const changingResult = await runAgent(changing.client);
  assert.ok(sent[1]!.tools.some((tool) => tool.function.name === "propose_campaign_activation"));
  assert.ok(!sent[2]!.tools.some((tool) => tool.function.name === "propose_campaign_activation"));
  assert.ok(
    sent[2]!.messages.some(
      (message) => message.role === "tool" && message.content?.includes("disabled"),
    ),
  );
  assert.deepEqual(changingResult.proposedActions, []);
  assert.equal(changing.writes.filter((write) => write.table === "action_queue").length, 0);

  // ---- The transcript is bounded -----------------------------------------

  // A snapshot big enough to blow the context window if it were re-sent whole on
  // every turn. The queue read is what the model asked for; the size is the
  // point.
  const huge = Array.from({ length: 400 }, (_, index) => ({
    id: `task-${index}`,
    title: `A task with a fairly long title so the payload is genuinely large ${index}`,
    description: "x".repeat(200),
    priority: "high",
    due_date: "2026-08-24",
    snoozed_until: null,
    related_type: "opportunity",
    related_id: `related-${index}`,
    opportunity_id: `opportunity-${index}`,
    created_at: "2026-08-24T12:00:00.000Z",
    status: "pending",
  }));
  sent = [];
  stubOpenRouter(toolCallTurn);
  await runAgent(stubSupabase({ tasks: huge, opportunities: huge }).client);

  const toolMessages = sent.at(-1)!.messages.filter((message) => message.role === "tool");
  assert.ok(
    toolMessages.length > 0,
    "the final request must contain the tool results, or this assertion proves nothing",
  );
  let sawTruncation = false;
  for (const message of toolMessages) {
    const parsed = JSON.parse(message.content ?? "{}") as {
      truncated?: boolean;
      preview?: string;
      reason?: string;
    };
    if (!parsed.truncated) continue;
    sawTruncation = true;
    // The cut content is what has to be bounded. The envelope around it is a
    // fixed, small overhead, so asserting on the raw string length would just
    // encode that constant.
    assert.ok(
      (parsed.preview ?? "").length <= 3500,
      `a truncated result still carried ${(parsed.preview ?? "").length} characters of payload`,
    );
    assert.ok(
      (parsed.reason ?? "").length > 0,
      "the model must be told why the result was cut so it can narrow the request",
    );
    assert.match(
      String((parsed as { source?: string }).source),
      /^registered_tool_result:/,
      "a tool result must identify its registered evidence receipt",
    );
  }
  assert.ok(
    sawTruncation,
    "an oversized tool result must be truncated; unbounded results are re-sent on every subsequent turn and compound across the run",
  );

  console.log(
    JSON.stringify(
      {
        checks: [
          "current-date-injected",
          "grounded-final-enforced",
          "ungrounded-final-degrades",
          "turn-budget-enforced",
          "exhaustion-returns-partial",
          "exhaustion-is-terminal",
          "staged-proposals-named",
          "transcript-bounded",
          "tool-receipt-provenance",
          "cross-domain-discovery-activation-pending-proposal",
          "unadvertised-calls-refuse-without-false-staging",
          "live-disablement-after-activation-refuses",
        ],
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    globalThis.fetch = realFetch;
  });
