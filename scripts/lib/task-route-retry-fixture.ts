import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { AuthorizedMemorySupabase } from "./autonomy-fixture";
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
        transitionOpportunity: async (_db: unknown, input: { to: string }) => {
          const row = mem.tables[table]![0]!;
          row.stage = input.to;
          return row;
        },
        transitionStatusFromError: () => 409,
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
  }
  console.log(
    "PASS: actual booking/lead adapters report partial failures and retry without duplicate tasks.",
  );
}
