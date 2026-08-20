#!/usr/bin/env tsx
/**
 * The AI tool layer had two declarations that meant nothing at runtime.
 *
 *   - `inputSchema` was advertised to the model and enforced nowhere. Whatever
 *     the model produced went straight into `execute`, so a missing recipient
 *     became the string "undefined" inside a dedupe key and an unknown field
 *     was silently accepted into an action payload a human would later approve.
 *   - `impact` was declared on every tool and read in exactly one place: a log
 *     line. Nothing branched on it. The system was safe only because every
 *     mutating tool happened to call proposeAction; a tool tagged `read` that
 *     wrote directly would have been executed without objection.
 *
 * Every assertion here fails if the corresponding gate is removed from
 * `executeRegisteredRevenueTool`. That is the point: a guard that cannot fail
 * on the bug it targets is worse than no guard.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertImpactHonoured,
  executeRegisteredRevenueTool,
  getRevenueAiTools,
  validateToolInput,
  AI_TOOL_REGISTRY_VERSION,
} from "../src/lib/revenue-os/ai-tools";

type Row = Record<string, unknown>;

/**
 * The smallest Supabase stand-in these tools need: proposeAction inserts into
 * action_queue and reads the row back, and the read tools issue filtered
 * selects. Reads return whatever `tables` holds so a query error can be
 * simulated per table.
 */
function stubSupabase(tables: Record<string, { data?: Row[]; error?: { message: string } }> = {}) {
  const inserted: Array<{ table: string; payload: Row }> = [];

  function query(table: string): Record<string, unknown> {
    let pending: Row | null = null;
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const method of ["select", "eq", "neq", "gt", "gte", "lt", "lte", "is", "in", "not", "or", "filter", "order", "limit", "range", "maybeSingle", "single"]) {
      self[method] = chain;
    }
    self.insert = (payload: Row) => {
      pending = payload;
      inserted.push({ table, payload });
      return self;
    };
    // Awaiting the builder resolves it. `single()` after an insert returns the
    // stored row with an id, which is what proposeAction returns and what the
    // impact check inspects.
    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      if (pending) return resolve({ data: { id: "queued-action-id", ...pending }, error: null });
      const fixture = tables[table] ?? {};
      return resolve({ data: fixture.error ? null : (fixture.data ?? []), error: fixture.error ?? null });
    };
    return self;
  }

  return { from: (table: string) => query(table), inserted } as unknown as {
    from: (table: string) => never;
    inserted: Array<{ table: string; payload: Row }>;
  };
}

function context(supabase: unknown) {
  return { supabase, actorEmail: "test@acceleratewith.us" } as Parameters<typeof executeRegisteredRevenueTool>[0];
}

async function rejects(run: () => Promise<unknown>, includes: string, because: string) {
  let message: string | null = null;
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert.ok(message !== null, `expected a rejection: ${because}`);
  assert.ok(
    message.toLowerCase().includes(includes.toLowerCase()),
    `${because}\n  expected the message to mention "${includes}"\n  got: ${message}`,
  );
}

async function main() {
  // ---- Schema enforcement -------------------------------------------------

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "propose_send_email", { subject: "Hi", body: "Hello", reasoning: "test" }),
    'requires "to"',
    "a required field the model omitted must be rejected, not turned into the string undefined inside a dedupe key",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "propose_send_email", { to: "   ", subject: "Hi", body: "Hello", reasoning: "test" }),
    'requires "to"',
    "whitespace is not a recipient; a blank required string must be treated as missing",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", { title: "Call back", priority: "urgent" }),
    "one of",
    "a value outside the declared enum must be rejected; the registry only accepts high/medium/low",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", { title: "Call back", priority: "high", sendImmediately: true }),
    'does not accept "sendImmediately"',
    "additionalProperties:false must be honoured, or an invented field rides into a payload a human then approves",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", { title: 42, priority: "high" }),
    "to be a string",
    "a declared string type must be enforced",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "not_a_real_tool", {}),
    "not registered",
    "an unknown tool name must fail rather than resolve to undefined",
  );

  // A valid call still succeeds. Without this the suite would pass if
  // validation rejected everything.
  const ok = await executeRegisteredRevenueTool(
    context(stubSupabase()),
    "propose_task",
    { title: "Call back", priority: "high", description: "Follow up on the quote" },
  );
  assert.equal((ok.output as { id: string }).id, "queued-action-id", "a well-formed call must still stage an action");
  assert.equal(ok.tool.impact, "internal_write");

  // ---- Impact tiers actually branch --------------------------------------

  const registry = getRevenueAiTools();
  assert.ok(registry.length > 0, "registry is empty, so nothing below is being checked");

  for (const tool of registry) {
    assert.ok(
      ["read", "internal_write", "external_action", "destructive"].includes(tool.impact),
      `${tool.name} declares an unknown impact tier "${tool.impact}"`,
    );
    assert.ok(
      tool.impact === "read" ? tool.confirmationRequired === false : tool.confirmationRequired === true,
      `${tool.name} is ${tool.impact} but confirmationRequired is ${tool.confirmationRequired}; mutating tools must require confirmation`,
    );
  }

  // A read tool that stages an action is mislabelled, and vice versa. Both
  // directions are checkable from the result, which is why the gate exists.
  const readTool = registry.find((tool) => tool.impact === "read");
  assert.ok(readTool, "no read tool registered");
  await rejects(
    async () => assertImpactHonoured(readTool, { id: "queued-action-id" }),
    "read tool but produced a queued action",
    "a tool tagged read that stages an action must fail closed",
  );

  const writeTool = registry.find((tool) => tool.impact === "internal_write");
  assert.ok(writeTool, "no internal_write tool registered");
  await rejects(
    async () => assertImpactHonoured(writeTool, [{ id: "some-row" }]),
    "did not stage an action",
    "a mutating tool that returns rows instead of a proposal must fail closed; mutating tools propose, they never act",
  );

  const source = readFileSync("src/lib/revenue-os/ai-tools.ts", "utf8");

  // Every tool in the registry is correctly labelled today, so no input can
  // drive a mislabelled tool through dispatch. That makes the two checks above
  // prove the gate works but not that dispatch still calls it. Assert the wiring
  // at the source, or deleting one line silently disarms it.
  const dispatch = source.slice(source.indexOf("export async function executeRegisteredRevenueTool"));
  assert.match(dispatch, /const output = await tool\.execute\([\s\S]{0,120}assertImpactHonoured\(tool, output\)/, "executeRegisteredRevenueTool must run the impact check on the tool's output before returning it");
  assert.ok(dispatch.indexOf("assertImpactHonoured(tool, output)") < dispatch.indexOf("return { output, tool }"), "the impact check must run before the result is handed back to the agent");

  // Destructive fails closed at dispatch even before schema validation, so the
  // absence of a destructive tool today is not what is keeping us safe.
  assert.match(
    source,
    /impact === "destructive"[\s\S]{0,200}throw new Error/,
    "destructive impact must fail closed at dispatch",
  );
  assert.ok(
    source.indexOf('impact === "destructive"') < source.indexOf("validateToolInput(tool.name"),
    "the destructive check must come before schema validation, so a destructive tool cannot be reached by a well-formed call",
  );

  // ---- Snapshot bounds and honest read failures ---------------------------

  // A failed read used to become `?? []`, which the model reports as a
  // confident "you have no opportunities": hallucination by omission.
  const degraded = await executeRegisteredRevenueTool(
    context(stubSupabase({ opportunities: { error: { message: "connection reset" } } })),
    "get_today_snapshot",
    {},
  );
  const snapshot = degraded.output as { unreadable: string[]; openOpportunityCount: number };
  assert.deepEqual(snapshot.unreadable, ["opportunities"], "a table that failed to read must be named, not silently reported as empty");
  assert.equal(snapshot.openOpportunityCount, 0);

  const healthy = await executeRegisteredRevenueTool(context(stubSupabase()), "get_today_snapshot", {});
  assert.deepEqual((healthy.output as { unreadable: string[] }).unreadable, [], "a clean read must report nothing unreadable");

  const bulk = Array.from({ length: 50 }, (_, index) => ({ id: `opp-${index}`, name: `Company ${index}`, stage: "qualified", estimated_value: 100 }));
  const large = await executeRegisteredRevenueTool(context(stubSupabase({ opportunities: { data: bulk } })), "get_today_snapshot", {});
  const bounded = large.output as { topOpportunities: Row[]; openOpportunityCount: number; openPipelineValue: number; truncated: boolean };
  assert.equal(bounded.openOpportunityCount, 50, "the count must reflect everything read");
  assert.equal(bounded.openPipelineValue, 5000, "pipeline value must be summed over everything read, not just what is detailed");
  assert.ok(bounded.topOpportunities.length <= 10, `detail must be capped; got ${bounded.topOpportunities.length} rows into the transcript`);
  assert.equal(bounded.truncated, true, "hitting the row limit must be disclosed so the model does not present a partial view as complete");

  // The registry version is what a stored trace is interpreted against. Adding
  // gates changes what a tool call means, so the version had to move.
  assert.equal(AI_TOOL_REGISTRY_VERSION, "revenue-os-tools.v2");

  // validateToolInput is exported and usable directly, which is how the agent
  // surfaces a correctable error back into the transcript.
  assert.doesNotThrow(() => validateToolInput("t", { type: "object", properties: { a: { type: "string" } }, required: ["a"] }, { a: "x" }));

  console.log(JSON.stringify({
    registeredTools: registry.length,
    registryVersion: AI_TOOL_REGISTRY_VERSION,
    gates: ["required", "enum", "additionalProperties", "type", "unknown-tool", "impact-read", "impact-write", "destructive-fail-closed", "snapshot-bounds", "snapshot-read-errors"],
    result: "passed",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
