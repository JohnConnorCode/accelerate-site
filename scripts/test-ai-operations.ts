#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AiOperationsValidationError,
  decodeAiRunCursor,
  encodeAiRunCursor,
  loadAiRunDetail,
  loadAiRunHistory,
  parseAiRunHistoryFilters,
  redactAiOperationsSummary,
} from "../src/lib/revenue-os/ai-operations";
import {
  AI_TOOL_REGISTRY_VERSION,
  listRevenueAiCapabilities,
} from "../src/lib/revenue-os/ai-tools";

type Response = { data: unknown; error: unknown };
type Operation = { table: string; method: string; args: unknown[] };

class Query implements PromiseLike<Response> {
  constructor(
    private readonly table: string,
    private readonly response: Response,
    private readonly operations: Operation[],
  ) {}
  private add(method: string, ...args: unknown[]) {
    this.operations.push({ table: this.table, method, args });
    return this;
  }
  select(...args: unknown[]) {
    return this.add("select", ...args);
  }
  order(...args: unknown[]) {
    return this.add("order", ...args);
  }
  limit(...args: unknown[]) {
    return this.add("limit", ...args);
  }
  gte(...args: unknown[]) {
    return this.add("gte", ...args);
  }
  eq(...args: unknown[]) {
    return this.add("eq", ...args);
  }
  contains(...args: unknown[]) {
    return this.add("contains", ...args);
  }
  or(...args: unknown[]) {
    return this.add("or", ...args);
  }
  in(...args: unknown[]) {
    return this.add("in", ...args);
  }
  maybeSingle() {
    this.add("maybeSingle");
    return Promise.resolve(this.response);
  }
  then<TResult1 = Response, TResult2 = never>(
    onfulfilled?: ((value: Response) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.response).then(onfulfilled, onrejected);
  }
}

function fakeClient(responses: Record<string, Response[]>): {
  client: SupabaseClient;
  operations: Operation[];
} {
  const operations: Operation[] = [];
  const calls = new Map<string, number>();
  const client = {
    from(table: string) {
      const index = calls.get(table) ?? 0;
      calls.set(table, index + 1);
      const response = responses[table]?.[index] ?? { data: [], error: null };
      return new Query(table, response, operations);
    },
  } as unknown as SupabaseClient;
  return { client, operations };
}

async function main() {
  const RUN_ID = "018f3d70-4f50-7cc1-8f3d-0123456789ab";
  const RECORD_ID = "018f3d70-4f50-7cc1-8f3d-abcdefabcdef";
  const startedAt = "2026-08-25T18:00:00.000Z";
  const rawRun = {
    id: RUN_ID,
    surface: "admin_command",
    provider: "openrouter",
    model: "model-a",
    tool_pack: "core",
    conversation_id: null,
    status: "future_status",
    prompt_preview: "authorization: Bearer secret-token",
    tool_names: ["get_today_snapshot"],
    input_tokens: 12,
    output_tokens: 8,
    duration_ms: 320,
    result_preview: "api_key=sk-supersecret123456",
    error: null,
    started_at: startedAt,
    finished_at: startedAt,
  };

  const cursor = encodeAiRunCursor({ startedAt, id: RUN_ID });
  assert.deepEqual(decodeAiRunCursor(cursor), { startedAt, id: RUN_ID });
  assert.throws(() => decodeAiRunCursor("not-a-cursor"), AiOperationsValidationError);
  assert.throws(
    () => parseAiRunHistoryFilters(new URLSearchParams("limit=0")),
    AiOperationsValidationError,
  );
  assert.throws(
    () => parseAiRunHistoryFilters(new URLSearchParams("window=forever")),
    AiOperationsValidationError,
  );
  assert.match(
    redactAiOperationsSummary("Bearer abc.def api_key=sk-abcdefghijklmnop") ?? "",
    /Bearer \[redacted\].*api_key=\[redacted\]/,
  );

  const filters = parseAiRunHistoryFilters(
    new URLSearchParams(
      `window=30d&status=completed&surface=admin_command&pack=core&model=model-a&tool=get_today_snapshot&cursor=${cursor}&limit=10`,
    ),
  );
  const historyFixture = fakeClient({
    agent_runs: [{ data: [{ ...rawRun, status: "completed" }], error: null }],
    agent_run_events: [{ data: [], error: { code: "42P01", message: "relation does not exist" } }],
  });
  const history = await loadAiRunHistory(historyFixture.client, filters);
  assert.equal(history.schemaReady, true);
  assert.equal(history.degraded, true, "missing feedback evidence must not appear healthy");
  assert.match(history.runs[0]?.promptPreview ?? "", /authorization=\[redacted\]/);
  assert.doesNotMatch(history.runs[0]?.promptPreview ?? "", /secret-token/);
  assert.equal(history.runs[0]?.resultPreview, "api_key=[redacted]");
  for (const [method, field] of [
    ["eq", "status"],
    ["eq", "surface"],
    ["eq", "tool_pack"],
    ["eq", "model"],
    ["contains", "tool_names"],
  ] as const) {
    assert.ok(
      historyFixture.operations.some(
        (operation) => operation.method === method && operation.args[0] === field,
      ),
      `${field} must be filtered in the database query`,
    );
  }
  assert.ok(
    historyFixture.operations.some(
      (operation) =>
        operation.method === "or" && String(operation.args[0]).includes("started_at.lt."),
    ),
    "the opaque cursor must become a two-column keyset predicate",
  );

  const detailEvents = Array.from({ length: 101 }, (_, index) => ({
    id: `018f3d70-4f50-7cc1-8f3e-${String(index).padStart(12, "0")}`,
    run_id: RUN_ID,
    event_type: index === 0 ? "human_feedback" : "tool_result",
    tool_name: index ? "get_record_timeline" : null,
    output:
      index === 0
        ? { rating: "sideways" }
        : {
            result: {
              entity_type: "opportunity",
              entity_id: index === 1 ? RECORD_ID : "--------------------",
              title: "Bearer event-secret",
            },
          },
    created_at: new Date(Date.parse(startedAt) + index).toISOString(),
  }));
  const detailFixture = fakeClient({
    agent_runs: [{ data: rawRun, error: null }],
    agent_run_events: [{ data: detailEvents, error: null }],
  });
  const detail = await loadAiRunDetail(detailFixture.client, RUN_ID);
  assert.equal(detail.run?.status, "unknown", "future statuses must not be fabricated as failures");
  assert.equal(detail.run?.feedback, "invalid");
  assert.equal(detail.events[0]?.status, "unknown");
  assert.equal(detail.events[0]?.summary, "Invalid feedback evidence");
  assert.equal(detail.events[1]?.summary, "Bearer [redacted]");
  assert.equal(detail.eventsTruncated, true);
  assert.deepEqual(detail.affectedRecords, [
    { type: "opportunity", id: RECORD_ID, href: `/admin/pipeline/${RECORD_ID}` },
  ]);
  await assert.rejects(
    () => loadAiRunDetail(detailFixture.client, "--------------------"),
    AiOperationsValidationError,
  );

  const missingDetailFixture = fakeClient({
    agent_runs: [{ data: rawRun, error: null }],
    agent_run_events: [{ data: null, error: { code: "42P01", message: "missing" } }],
  });
  const missingDetail = await loadAiRunDetail(missingDetailFixture.client, RUN_ID);
  assert.equal(missingDetail.degraded, true);
  assert.deepEqual(missingDetail.events, []);

  const capabilities = listRevenueAiCapabilities();
  assert.equal(AI_TOOL_REGISTRY_VERSION, "revenue-os-tools.v4");
  assert.ok(capabilities.some((capability) => capability.impact === "read"));
  assert.ok(
    capabilities
      .filter((capability) => capability.impact !== "read")
      .every((capability) => capability.confirmationRequired),
  );

  for (const route of [
    "src/app/api/admin/revenue-os/ai/runs/route.ts",
    "src/app/api/admin/revenue-os/ai/runs/[id]/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /requireAdmin\(\)/);
    assert.match(source, /AiOperationsValidationError/);
    assert.match(source, /Could not load AI run/);
    assert.doesNotMatch(
      source,
      /NextResponse\.json\(\{ error: message \}/,
      "routes must not return arbitrary internal error messages",
    );
  }

  const capabilitiesRoute = readFileSync(
    "src/app/api/admin/revenue-os/ai/capabilities/route.ts",
    "utf8",
  );
  assert.match(capabilitiesRoute, /scope: "runtime_registry"/);
  assert.match(capabilitiesRoute, /readinessEvaluated: true/);
  assert.match(capabilitiesRoute, /state: capability\.available \? "available" : "unavailable"/);

  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "typed validation",
          "opaque keyset cursor",
          "database filters",
          "missing-event degradation",
          "summary redaction",
          "unknown evidence",
          "event truncation",
          "canonical affected records",
          "registry policy truth",
          "safe route errors",
        ],
      },
      null,
      2,
    ),
  );
}

void main();
