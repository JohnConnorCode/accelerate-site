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
  getRevenueAiToolsForProfile,
  listRevenueAiCapabilities,
  listRevenueAiCapabilitiesForProfile,
  projectTaskToolProfile,
  taskToolProfileToolNames,
  toOpenRouterToolsForProfile,
  validateToolInput,
  validateToolOutput,
  AI_TOOL_REGISTRY_VERSION,
} from "../src/lib/revenue-os/ai-tools";
import {
  DEFAULT_TASK_TOOL_PROFILE,
  PROFILE_ALIASES,
  TASK_TOOL_PROFILE_META,
  mcpEndpointUrl,
  parseTaskToolProfile,
  type TaskToolProfile,
} from "../src/lib/revenue-os/tool-profiles";

import { REVENUE_OS_MODULES } from "../src/lib/revenue-os/modules";
import {
  pluginToolDeclarations,
  assertPluginToolGrants,
} from "../src/lib/revenue-os/plugin-tool-contract";

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
      "maybeSingle",
      "single",
    ]) {
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
      return resolve({
        data: fixture.error ? null : (fixture.data ?? []),
        error: fixture.error ?? null,
      });
    };
    return self;
  }

  return { from: (table: string) => query(table), inserted } as unknown as {
    from: (table: string) => never;
    inserted: Array<{ table: string; payload: Row }>;
  };
}

function context(supabase: unknown) {
  return { supabase, actorEmail: "test@acceleratewith.us" } as Parameters<
    typeof executeRegisteredRevenueTool
  >[0];
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
  const runtime = getRevenueAiTools();
  let pluginTools = 0;
  for (const moduleDef of REVENUE_OS_MODULES.filter((moduleDef) => moduleDef.workflow)) {
    const registeredModule = { ...moduleDef, workflow: moduleDef.workflow! };
    const declarations = pluginToolDeclarations(registeredModule);
    assertPluginToolGrants(registeredModule);
    assert.deepEqual(
      moduleDef.aiToolNames,
      declarations.map((tool) => tool.name),
    );
    assert.deepEqual(moduleDef.workflow!.tools, declarations);
    for (const { operation, ...declaration } of declarations) {
      assert.ok(operation.length > 0);
      const tool = runtime.find((tool) => tool.name === declaration.name)!;
      assert.ok(tool);
      for (const [key, expected] of Object.entries(declaration))
        assert.deepEqual(tool[key as keyof typeof tool], expected);
      pluginTools++;
      const disabledContext = {
        ...context(stubSupabase()),
        tenantConfig: { modules: { [moduleDef.id]: false } },
      };
      await assert.rejects(
        () => executeRegisteredRevenueTool(disabledContext, tool.name, {}),
        /unavailable/,
      );
    }
    const originalNames = moduleDef.aiToolNames;
    try {
      moduleDef.aiToolNames = [];
      const tool = runtime.find((tool) => tool.name === declarations[0]!.name)!;
      await assert.rejects(() => tool.execute(context(stubSupabase()), {}), /grants disagree/);
    } finally {
      moduleDef.aiToolNames = originalNames;
    }
  }
  assert.equal(pluginTools, 9);
  const invoiceModule = REVENUE_OS_MODULES.find((module) => module.id === "stripe-invoicing")!;
  assert.throws(
    () => pluginToolDeclarations({ ...invoiceModule, workflow: { inputContract: "constructor" } }),
    /Unknown host workflow contract/,
  );
  assert.throws(
    () =>
      pluginToolDeclarations({
        ...invoiceModule,
        workflow: { inputContract: "task-batch-meeting-v1" },
      }),
    /require the invoice workflow/,
  );
  const noDatabase = {
    from() {
      throw new Error("INVALID TOOL INPUT REACHED DATABASE");
    },
  };
  const uuid = "11111111-1111-4111-8111-111111111111";
  const invalidInputs: Record<string, Record<string, unknown>> = {
    prepare_client_onboarding: { opportunityId: "x".repeat(36), tasks: [] },
    propose_client_onboarding: {
      input: { opportunityId: uuid, tasks: [] },
      digest: "x".repeat(64),
      requestId: uuid,
    },
    prepare_meeting_commitments: {
      meetingId: uuid,
      tasks: [{ title: "Test", description: "", dueDate: "2026-02-30", assigneeUserId: uuid }],
    },
    propose_meeting_commitments: {
      input: { meetingId: uuid, tasks: [] },
      digest: "0".repeat(64),
      requestId: "invalid",
    },
    prepare_stripe_invoicing: {
      contactId: uuid,
      customerId: "bad",
      currency: "usd",
      daysUntilDue: 30,
      memo: "",
      lines: [],
    },
    propose_stripe_invoicing: { input: {}, digest: "0".repeat(64), requestId: uuid },
    propose_stripe_invoice_send: { creationActionId: "invalid" },
    preview_invoice_page: {
      creationActionId: uuid,
      design: { layout: "classic", heading: "Invoice", introduction: "", closing: "", total: 1 },
    },
    propose_invoice_page: {
      creationActionId: uuid,
      design: { layout: "classic", heading: "Invoice", introduction: "", closing: "" },
      digest: "x".repeat(64),
      requestId: uuid,
    },
  };
  for (const [name, input] of Object.entries(invalidInputs)) {
    const enabled = Object.fromEntries(
      REVENUE_OS_MODULES.filter((module) => module.workflow).map((module) => [module.id, true]),
    );
    await assert.rejects(
      () =>
        executeRegisteredRevenueTool(
          { ...context(noDatabase), tenantConfig: { modules: enabled } },
          name,
          input,
        ),
      (error) => error instanceof Error && error.name === "ZodError",
    );
  }

  // ---- Schema enforcement -------------------------------------------------

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_send_email", {
        subject: "Hi",
        body: "Hello",
        reasoning: "test",
      }),
    'requires "to"',
    "a required field the model omitted must be rejected, not turned into the string undefined inside a dedupe key",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_send_email", {
        to: "   ",
        subject: "Hi",
        body: "Hello",
        reasoning: "test",
      }),
    'requires "to"',
    "whitespace is not a recipient; a blank required string must be treated as missing",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", {
        title: "Call back",
        priority: "urgent",
      }),
    "one of",
    "a value outside the declared enum must be rejected; the registry only accepts high/medium/low",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", {
        title: "Call back",
        priority: "high",
        sendImmediately: true,
      }),
    'does not accept "sendImmediately"',
    "additionalProperties:false must be honoured, or an invented field rides into a payload a human then approves",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", {
        title: 42,
        priority: "high",
      }),
    "to be a string",
    "a declared string type must be enforced",
  );

  await rejects(
    () => executeRegisteredRevenueTool(context(stubSupabase()), "not_a_real_tool", {}),
    "not registered",
    "an unknown tool name must fail rather than resolve to undefined",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_founder_note", {
        contactId: "contact-1",
      }),
    'requires "body"',
    "a note with no body is meaningless and must be rejected",
  );

  const noteProposal = await executeRegisteredRevenueTool(
    context(stubSupabase()),
    "propose_founder_note",
    { body: "Called back, wants a revised quote by Friday.", opportunityId: "opp-1" },
  );
  assert.equal((noteProposal.output as { id: string }).id, "queued-action-id");
  assert.equal(noteProposal.tool.impact, "internal_write");
  assertImpactHonoured(noteProposal.tool, noteProposal.output);

  await rejects(
    () =>
      executeRegisteredRevenueTool(
        { ...context(stubSupabase()), toolPack: "core" },
        "propose_stage_change",
        { opportunityId: "opp-1", stage: "qualified", reason: "Verified reply" },
      ),
    "not available in the core tool pack",
    "a registered tool outside the active command pack must fail closed at dispatch",
  );

  // A valid call still succeeds. Without this the suite would pass if
  // validation rejected everything.
  const ok = await executeRegisteredRevenueTool(context(stubSupabase()), "propose_task", {
    title: "Call back",
    priority: "high",
    description: "Follow up on the quote",
  });
  assert.equal(
    (ok.output as { id: string }).id,
    "queued-action-id",
    "a well-formed call must still stage an action",
  );
  assert.equal(ok.tool.impact, "internal_write");
  assert.equal(
    ok.tool.serviceTarget,
    "revenue-os.action-queue",
    "a proposal must declare the reviewed service it is allowed to call",
  );

  // ---- Impact tiers actually branch --------------------------------------

  const registry = getRevenueAiTools();
  assert.ok(registry.length > 0, "registry is empty, so nothing below is being checked");

  for (const tool of registry) {
    assert.ok(
      ["read", "internal_write", "external_action", "destructive"].includes(tool.impact),
      `${tool.name} declares an unknown impact tier "${tool.impact}"`,
    );
    assert.ok(
      tool.outputSchema && typeof tool.outputSchema === "object",
      `${tool.name} must declare an explicit output schema`,
    );
    assert.ok(
      ["none", "host_verified"].includes(tool.connectionRequirement),
      `${tool.name} must declare whether a verified host connection is required`,
    );
    assert.ok(
      tool.impact === "read"
        ? tool.confirmationRequired === false
        : tool.confirmationRequired === true,
      `${tool.name} is ${tool.impact} but confirmationRequired is ${tool.confirmationRequired}; mutating tools must require confirmation`,
    );
  }

  // ---- Task-focused tool profiles are bounded registry projections -------

  // Every profile advertises a bounded subset of registered tools and the
  // always-present discovery path (AC1), membership never grants access (AC2),
  // UI/AI/MCP share one availability read (AC3), and the projected surface is
  // measurably smaller without dropping tools merely to hit a count (AC4).
  const registeredNames = registry.map((tool) => tool.name);
  for (const profile of ["core", "ops", "full"] as const) {
    const advertised = taskToolProfileToolNames(profile);
    assert.ok(advertised.length > 0, `${profile} profile advertises no tools`);
    for (const name of advertised)
      assert.ok(
        registeredNames.includes(name),
        `${profile} profile advertises an unregistered tool "${name}"`,
      );
    assert.ok(
      ["discover_tool_bundles", "activate_tool_bundle", "get_workspace_capabilities"].every(
        (name) => advertised.includes(name),
      ),
      `${profile} profile must always advertise the discovery path`,
    );
    // Membership is a bounded projection: core ⊂ ops ⊂ full, never full for a
    // bounded profile, and full is exactly the registry.
    if (profile === "full") assert.deepEqual([...advertised].sort(), [...registeredNames].sort());
    else assert.ok(advertised.length < registeredNames.length, `${profile} is not bounded`);
    assert.deepEqual(
      listRevenueAiCapabilitiesForProfile(profile).map((capability) => capability.name),
      listRevenueAiCapabilities()
        .filter((capability) => advertised.includes(capability.name))
        .map((capability) => capability.name),
      `${profile} capability projection must agree with the shared registry read`,
    );
    assert.deepEqual(
      projectTaskToolProfile(profile).discoveryPath,
      ["discover_tool_bundles", "activate_tool_bundle", "get_workspace_capabilities"],
      `${profile} projection must expose the discovery path`,
    );
    // OpenRouter conversion keeps the same availability gate as the AI path.
    assert.deepEqual(
      toOpenRouterToolsForProfile(profile).map((tool) => tool.function.name),
      getRevenueAiToolsForProfile(profile).map((tool) => tool.name),
      `${profile} OpenRouter surface must equal the available registered tools`,
    );
  }
  assert.ok(
    taskToolProfileToolNames("core").length < taskToolProfileToolNames("ops").length,
    "core must be strictly smaller than ops",
  );
  assert.ok(
    taskToolProfileToolNames("ops").length < taskToolProfileToolNames("full").length,
    "ops must be strictly smaller than full",
  );
  // AC4: the projected surface is measurably smaller, not an arbitrary count.
  const fullSize = JSON.stringify(taskToolProfileToolNames("full")).length;
  for (const profile of ["core", "ops"] as TaskToolProfile[]) {
    const size = JSON.stringify(taskToolProfileToolNames(profile)).length;
    assert.ok(size < fullSize, `${profile} tool-name projection must be measurably smaller`);
  }

  // AC1/AC3: omitted and unknown profile values resolve to full, never to a
  // silently empty or guessed surface; aliases map to their canonical profile.
  assert.equal(parseTaskToolProfile(undefined), "full");
  assert.equal(parseTaskToolProfile(null), "full");
  assert.equal(parseTaskToolProfile(""), "full");
  assert.equal(parseTaskToolProfile("bogus-profile"), "full");
  assert.equal(parseTaskToolProfile("daily"), "ops");
  assert.equal(parseTaskToolProfile("minimal"), "core");
  assert.equal(parseTaskToolProfile("power"), "full");
  for (const [alias, canonical] of Object.entries(PROFILE_ALIASES))
    assert.equal(parseTaskToolProfile(alias), canonical);
  assert.equal(DEFAULT_TASK_TOOL_PROFILE, "ops");
  assert.ok(TASK_TOOL_PROFILE_META.ops.recommended);
  assert.match(
    mcpEndpointUrl("https://example.com", "ops"),
    /^https:\/\/example\.com\/api\/mcp\?profile=ops$/,
  );
  assert.equal(mcpEndpointUrl("https://example.com", "full"), "https://example.com/api/mcp");

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
  const dispatch = source.slice(
    source.indexOf("export async function executeRegisteredRevenueTool"),
  );
  assert.match(
    dispatch,
    /const output = await withProposalWorkContext\([\s\S]{0,300}assertImpactHonoured\(tool, output\)/,
    "executeRegisteredRevenueTool must run the impact check on the tool's output before returning it",
  );
  assert.ok(
    dispatch.indexOf("assertImpactHonoured(tool, output)") <
      dispatch.indexOf("return { output, tool }"),
    "the impact check must run before the result is handed back to the agent",
  );

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

  // Every propose_* tool must have a matching executor case, or an approved
  // proposal sits forever with no way to actually apply it.
  const executorSource = readFileSync("src/lib/revenue-os/action-executor.ts", "utf8");
  assert.match(
    executorSource,
    /"create_founder_note"/,
    "create_founder_note must be declared in APPROVABLE_ACTIONS or an approved note can never execute",
  );
  assert.match(
    executorSource,
    /case "create_founder_note":[\s\S]{0,200}captureFounderNote\(/,
    "the create_founder_note case must call captureFounderNote, the same service the manual note UI uses",
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
  assert.deepEqual(
    snapshot.unreadable,
    ["opportunities"],
    "a table that failed to read must be named, not silently reported as empty",
  );
  assert.equal(snapshot.openOpportunityCount, 0);

  const healthy = await executeRegisteredRevenueTool(
    context(stubSupabase()),
    "get_today_snapshot",
    {},
  );
  assert.deepEqual(
    (healthy.output as { unreadable: string[] }).unreadable,
    [],
    "a clean read must report nothing unreadable",
  );

  const bulk = Array.from({ length: 50 }, (_, index) => ({
    id: `opp-${index}`,
    name: `Company ${index}`,
    stage: "qualified",
    estimated_value: 100,
  }));
  const large = await executeRegisteredRevenueTool(
    context(stubSupabase({ opportunities: { data: bulk } })),
    "get_today_snapshot",
    {},
  );
  const bounded = large.output as {
    topOpportunities: Row[];
    openOpportunityCount: number;
    openPipelineValue: number;
    truncated: boolean;
  };
  assert.equal(bounded.openOpportunityCount, 50, "the count must reflect everything read");
  assert.equal(
    bounded.openPipelineValue,
    5000,
    "pipeline value must be summed over everything read, not just what is detailed",
  );
  assert.ok(
    bounded.topOpportunities.length <= 10,
    `detail must be capped; got ${bounded.topOpportunities.length} rows into the transcript`,
  );
  assert.equal(
    bounded.truncated,
    true,
    "hitting the row limit must be disclosed so the model does not present a partial view as complete",
  );

  // The registry version is what a stored trace is interpreted against. Adding
  // gates changes what a tool call means, so the version had to move.
  assert.equal(AI_TOOL_REGISTRY_VERSION, "revenue-os-tools.v18");

  // validateToolInput is exported and usable directly, which is how the agent
  // surfaces a correctable error back into the transcript.
  assert.doesNotThrow(() =>
    validateToolInput(
      "t",
      { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
      { a: "x" },
    ),
  );
  assert.doesNotThrow(() =>
    validateToolOutput(
      "t",
      { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      { id: "one" },
    ),
  );
  assert.throws(
    () =>
      validateToolOutput(
        "t",
        { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        { id: 42 },
      ),
    /invalid output/,
    "a service response that violates its declared output contract must fail",
  );
  assert.throws(
    () =>
      validateToolOutput(
        "t",
        { type: "object", required: ["total"], properties: { total: { type: "number" } } },
        { total: Number.NaN },
      ),
    /finite number/,
    "non-finite metrics must never enter the model transcript as valid business data",
  );

  assert.match(
    dispatch,
    /availabilityFor\(tool, context\)[\s\S]{0,180}if \(!availability\.available\)\s*throw new Error/,
    "dispatch must reject a tool outside the active context before executing it",
  );
  assert.match(
    dispatch,
    /const output = await withProposalWorkContext\([\s\S]{0,180}tool\.execute\(context, parsedInput\)[\s\S]{0,120}validateToolOutput\(tool\.name, tool\.outputSchema, output\)/,
    "dispatch must validate every tool output before returning it",
  );

  console.log(
    JSON.stringify(
      {
        registeredTools: registry.length,
        registryVersion: AI_TOOL_REGISTRY_VERSION,
        gates: [
          "plugin-runtime-manifest-parity",
          "plugin-full-validator-dispatch",
          "plugin-stale-grant-refusal",
          "required",
          "enum",
          "additionalProperties",
          "type",
          "unknown-tool",
          "active-pack",
          "output-contract",
          "impact-read",
          "impact-write",
          "destructive-fail-closed",
          "founder-note-schema",
          "founder-note-executor-wiring",
          "snapshot-bounds",
          "snapshot-read-errors",
        ],
        result: "passed",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
