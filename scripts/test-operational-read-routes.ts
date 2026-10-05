import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { NextRequest, NextResponse } from "next/server";
import { MemorySupabase, type Row } from "./lib/memory-supabase";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";

const tenant = "11111111-1111-4111-8111-111111111111";
const require = createRequire(import.meta.url);
const fixture = globalThis as typeof globalThis & { operationalReadAuth?: unknown };
// These are the deployed field contracts, not invented columns accepted by a
// permissive memory store. Authentication is stubbed only at the route boundary.
const columns: Record<string, string[]> = {
  sent_emails: [
    "id",
    "to_email",
    "to_name",
    "subject",
    "body",
    "template_used",
    "sent_at",
    "related_type",
    "related_id",
  ],
  messages: [
    "id",
    "recipient_emails",
    "subject",
    "body_text",
    "status",
    "provider_id",
    "sent_at",
    "created_at",
    "metadata",
    "direction",
  ],
  tasks: [
    "id",
    "title",
    "description",
    "due_date",
    "due_time",
    "priority",
    "related_type",
    "related_id",
    "related_name",
    "created_at",
    "source",
    "dedupe_key",
    "status",
  ],
  work_items: [
    "id",
    "kind",
    "objective",
    "reason",
    "coworker_id",
    "status",
    "priority",
    "created_at",
  ],
  action_queue: [
    "id",
    "action_type",
    "title",
    "description",
    "reasoning",
    "proposed_by",
    "urgency",
    "status",
    "created_at",
  ],
};
function database(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    solution_requests: [],
    contact_submissions: [],
    chat_leads: [],
    partner_applications: [],
    proposals: [],
    tasks: [],
    work_items: [],
    action_queue: [],
    sent_emails: [],
    messages: [],
    ...seed,
  };
  const mem = new MemorySupabase(
    Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [
        table,
        rows.map((row) => ({ tenant_id: tenant, ...row })),
      ]),
    ),
  );
  const client = mem.client as { from: (table: string) => Record<string, unknown> };
  const from = (table: string) => {
    const raw = client.from(table);
    const allowed = new Set(["tenant_id", ...(columns[table] ?? [])]);
    const proxy: Record<string, unknown> = new Proxy(raw, {
      get(target, property) {
        const value = target[property as string];
        if (typeof value !== "function") return value;
        if (property === "then") return value.bind(target);
        return (...args: unknown[]) => {
          if (columns[table] && ["select", "order", "eq", "in"].includes(String(property))) {
            const fields =
              property === "select"
                ? String(args[0])
                    .split(",")
                    .map((v) => v.trim())
                : [String(args[0])];
            for (const field of fields)
              assert.ok(allowed.has(field), `${table}.${field} is not a deployed field`);
          }
          value.apply(target, args);
          return proxy;
        };
      },
    });
    return proxy;
  };
  const db = bindTenantDatabaseForTest({ ...client, from } as never, tenant);
  fixture.operationalReadAuth = { database: db, user: { email: "operator@example.test" } };
  return mem;
}
async function route(path: string) {
  const bundle = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    plugins: [
      {
        name: "controlled-route-auth",
        setup(builder) {
          builder.onResolve(
            { filter: /^@\/lib\/(admin\/(auth|module-guard)|revenue-os\/legacy-adapter)$/ },
            () => ({ path: "controlled-auth", namespace: "fixture" }),
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents:
              "export const requireAdmin = async () => globalThis.operationalReadAuth; export const requireAdminForModule = requireAdmin; export const recordLegacyAdapterUse = async () => {};",
          }));
        },
      },
    ],
  });
  const compiled = { exports: {} as { GET: (request: NextRequest) => Promise<NextResponse> } };
  new Function("require", "module", "exports", bundle.outputFiles[0]!.text)(
    require,
    compiled,
    compiled.exports,
  );
  return compiled.exports.GET;
}
async function main() {
  const inbox = await route("src/app/api/admin/inbox/route.ts");
  const history = await route("src/app/api/admin/emails/history/route.ts");
  const request = new NextRequest("https://workspace.example.test/api/admin/inbox");
  try {
    const mem = database({
      tasks: [
        {
          id: "bridge",
          title: "[Work] Prepare a brief",
          source: "work_engine",
          dedupe_key: "work-item-inbox:work-1",
          status: "pending",
          created_at: "2026-10-05T12:00:00Z",
        },
        {
          id: "task-1",
          title: "Review scope",
          status: "pending",
          created_at: "2026-10-05T11:00:00Z",
        },
      ],
      work_items: [
        {
          id: "work-1",
          kind: "pre_call_brief",
          objective: "Prepare a brief",
          reason: "Upcoming call",
          coworker_id: "meeting-intel",
          priority: "high",
          status: "pending",
          created_at: "2026-10-05T12:00:00Z",
        },
      ],
      action_queue: [
        {
          id: "action-1",
          title: "Review the exact reply",
          description: "A prepared reply awaits approval",
          action_type: "send_email",
          proposed_by: "sales",
          urgency: "urgent",
          status: "pending",
          created_at: "2026-10-05T12:00:00Z",
        },
      ],
    });
    const response = await inbox(request);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.counts.coworker, 1);
    assert.equal(data.counts.task, 1, "Task bridge must not duplicate the coworker item");
    const action = data.items.find((row: Row) => row.id === "action-1");
    assert.equal(action.title, "Review the exact reply");
    assert.equal(action.priority, "urgent");
    assert.equal(action.href, "/admin/work?tab=approvals&action=action-1");
    for (const table of ["action_queue", "tasks", "work_items"]) {
      mem.fail(table, { message: "private-database-detail" });
      const unavailable = await inbox(request);
      assert.equal(unavailable.status, 503);
      assert.ok(!(await unavailable.text()).includes("private-database-detail"));
      mem.recover(table);
    }
    const mail = database({
      sent_emails: [
        {
          id: 1,
          to_email: "recipient@example.test",
          subject: "Older note",
          body: "Reviewed body",
          sent_at: "2026-10-04T12:00:00Z",
        },
      ],
      messages: [
        {
          id: "message-1",
          direction: "outbound",
          recipient_emails: ["recipient@example.test"],
          subject: "Recent note",
          body_text: "Reviewed body",
          provider_id: "provider-1",
          status: "sent",
          sent_at: "2026-10-05T12:00:00Z",
          created_at: "2026-10-05T11:00:00Z",
        },
      ],
    });
    const complete = await history(request);
    const completeData = await complete.json();
    assert.equal(complete.status, 200);
    assert.equal(completeData.partial, false);
    assert.deepEqual(
      completeData.history.map((row: Row) => row.id),
      ["message:message-1", "legacy:1"],
    );
    assert.equal(completeData.history[0].providerId, "provider-1");
    mail.fail("sent_emails", { message: "private-legacy-failure" });
    const partial = await history(request);
    const partialData = await partial.json();
    assert.equal(partial.status, 200);
    assert.equal(partialData.partial, true);
    assert.equal(partialData.history.length, 1);
    mail.fail("messages", { message: "private-canonical-failure" });
    const unavailable = await history(request);
    assert.equal(unavailable.status, 503);
    assert.ok(!(await unavailable.text()).includes("private-canonical-failure"));
    fixture.operationalReadAuth = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    assert.equal((await inbox(request)).status, 401);
    assert.equal((await history(request)).status, 401);
    console.log(
      "PASS: actual Inbox and email-history routes, canonical columns, task bridge, exact approval links, history ordering/provider evidence, partial/error and authorization boundaries (controlled database).",
    );
  } finally {
    delete fixture.operationalReadAuth;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
