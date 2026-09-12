import type { SupabaseClient } from "@supabase/supabase-js";
import type { Row } from "./memory-supabase";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { AuthorizedMemorySupabase } from "./autonomy-fixture";
import {
  transitionOpportunity,
  updateOpportunityRecord,
  transitionStatusFromError,
} from "../../src/lib/revenue-os/pipeline";
import { createRevenueTask } from "../../src/lib/revenue-os/tasks";

// Execute the actual adapters with explicit auth/transition boundaries. Task
// dispatch, queue approval and dedupe use the shared fixture, not route mocks.
export async function testTaskRouteRetries() {
  for (const route of ["bookings", "leads"]) {
    const id = "22222222-2222-4222-8222-222222222222";
    const table = route === "bookings" ? "opportunities" : "solution_requests";
    const mem = new AuthorizedMemorySupabase({
      [table]: [{ id, stage: "showed", email: "lead@example.test", contact_name: "Lead" }],
    });
    mem.tables.kanban_columns = [
      {
        board_key: "pipeline",
        column_key: "meeting",
        label: "Meeting",
        metadata: { role: "open", probability: 55 },
      },
      {
        board_key: "pipeline",
        column_key: "proposal",
        label: "Proposal",
        metadata: { role: "open", probability: 70 },
      },
    ];
    let fail = true;
    const imports: Record<string, unknown> = {
      "next/server": { NextRequest, NextResponse },
      "@/lib/revenue-os/tasks": {
        createRevenueTask: (...args: Parameters<typeof createRevenueTask>) => {
          if (fail) {
            fail = false;
            throw new Error("Injected task transport failure");
          }
          return createRevenueTask(...args);
        },
      },
      "@/lib/admin/module-guard": {
        requireAdminForModule: async () => ({
          database: mem.client,
          user: { email: "owner@example.test" },
          tenant: { id },
        }),
      },
      "@/lib/revenue-os/pipeline": {
        transitionOpportunity,
        transitionStatusFromError,
        updateOpportunityRecord,
      },
      "@/lib/email/booking": {},
      "@/config/tenant": {
        tenant: { playbooks: [] },
        resolvePlaybook: () => ({ label: "Service" }),
      },
      "@/lib/admin/pipeline-stages": { PIPELINE_STAGES: [{ key: "contacted" }] },
      "@/lib/revenue-os/legacy-adapter": {},
      "@/lib/revenue-os/inbound": {},
      "@/lib/revenue-os/pipeline-stage-resolver": {},
    };
    const exports: { PATCH?: (request: NextRequest) => Promise<NextResponse> } = {};
    const source = readFileSync(`src/app/api/admin/${route}/route.ts`, "utf8");
    runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText,
      {
        exports,
        require: (name: string) => {
          assert.ok(name in imports, `Unexpected route import ${name}`);
          return imports[name];
        },
        console,
        Date,
      },
    );
    const request = () =>
      new NextRequest(`https://example.test/api/admin/${route}`, {
        method: "PATCH",
        body: JSON.stringify(
          route === "bookings" ? { id, stage: "proposal" } : { id, lead_status: "contacted" },
        ),
      });
    const failed = await exports.PATCH!(request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.json()).partial, true);
    assert.equal(
      mem.tables[table]![0]![route === "bookings" ? "stage" : "lead_status"],
      route === "bookings" ? "proposal" : "contacted",
      "Source save survives and failure remains truthful",
    );
    assert.equal(
      (await exports.PATCH!(request())).status,
      200,
      "Same request retries missing follow-up",
    );
    assert.equal(mem.rows("tasks").length, 1);
    mem.rows("tasks")[0]!.status = "completed";
    assert.equal((await exports.PATCH!(request())).status, 200);
    assert.equal(mem.rows("tasks").length, 1, "Retry preserves completed follow-up identity");
    if (route === "bookings") {
      assert.equal(
        mem.rows("stage_events").length,
        1,
        "Same-stage retry creates no extra pipeline effect",
      );
      assert.equal(
        mem.rpcCalls.filter((call) => call.name === "apply_pipeline_action").length,
        3,
        "Actual booking adapter reaches canonical pipeline executor on each attempt",
      );
    }
  }
  console.log(
    "PASS: actual booking/lead adapters report partial failures and retry without duplicate tasks.",
  );
}

export async function testCalendlyTaskRetry() {
  const id = "22222222-2222-4222-8222-222222222222";
  const mem = new AuthorizedMemorySupabase({
    opportunities: [{ id, email: "lead@example.test", stage: "qualified" }],
  });
  let fail = true;
  const taskInputs: Parameters<typeof createRevenueTask>[1][] = [];
  const imports: Record<string, unknown> = {
    "node:crypto": {},
    "next/server": { NextRequest, NextResponse },
    "@/lib/revenue-os/tasks": {
      createRevenueTask: async (_db: unknown, input: Parameters<typeof createRevenueTask>[1]) => {
        taskInputs.push(input);
        if (fail) {
          fail = false;
          throw new Error("Injected task failure");
        }
        return { task: { id }, deduplicated: false };
      },
    },
    "@/lib/supabase/server": { createBootstrapServiceRoleClient: () => mem.client },
    "@/lib/email/sequences": { cancelScheduledSequences: async () => {} },
    "@/lib/email/booking": {},
    "@/lib/email/resend": { getResend: () => null },
    "@/lib/rate-limit": { rateLimit: () => ({ success: true }) },
    "@/lib/revenue-os/activities": {},
    "@/lib/revenue-os/audit": {},
    "@/lib/revenue-os/campaign-stops": {},
    "@/lib/revenue-os/pipeline": {
      updateOpportunityRecord: async (
        database: SupabaseClient,
        input: { id: string; patch: Row },
      ) => {
        const { data, error } = await database
          .from("opportunities")
          .update(input.patch)
          .eq("id", input.id)
          .select("*")
          .single();
        if (error) throw new Error(error.message);
        return data;
      },
      transitionOpportunity: async () => {
        mem.rows("opportunities")[0]!.stage = "booked";
      },
    },
    "@/lib/revenue-os/meeting-intel-coworker": {},
    "@/lib/tenancy/constants": { ACCELERATE_TENANT_ID: id },
  };
  const exports: {
    handleCalendlyWebhook?: (
      request: NextRequest,
      input: { webhookSecret: string },
    ) => Promise<NextResponse>;
  } = {};
  const source = readFileSync("src/app/api/webhooks/calendly/route.ts", "utf8");
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name: string) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      console,
      Date,
      Buffer,
      URL,
    },
  );
  const request = () =>
    new NextRequest("https://example.test/api/webhooks/calendly", {
      method: "POST",
      headers: { "x-accelerate-webhook-secret": "test-secret" },
      body: JSON.stringify({
        event: "invitee.created",
        payload: { uri: "https://calendly.test/invitees/one", email: "lead@example.test" },
      }),
    });
  const call = () => exports.handleCalendlyWebhook!(request(), { webhookSecret: "test-secret" });
  const partial = await call();
  assert.equal(partial.status, 502);
  assert.equal((await partial.json()).partial, true);
  assert.equal(
    mem.rows("calendly_webhook_receipts").length,
    0,
    "Failed task leaves event retryable",
  );
  assert.equal(mem.rows("admin_notifications").length, 0, "Task failure precedes notifications");
  assert.equal((await call()).status, 200);
  assert.equal(taskInputs.length, 2);
  assert.equal(taskInputs[0]!.dedupeKey, taskInputs[1]!.dedupeKey);
  assert.equal(taskInputs[1]!.source, "calendly");
  assert.equal(taskInputs[1]!.dueDate, null, "Missing scheduled time stays null");
  assert.equal(mem.rows("admin_notifications").length, 1);
  assert.equal((await (await call()).json()).duplicate, true);
  assert.equal(taskInputs.length, 2, "Receipt replay skips follow-up entirely");
  console.log(
    "PASS: Calendly task failure remains retryable before notifications, with stable source key and null schedule.",
  );
}
