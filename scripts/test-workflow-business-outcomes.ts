import { EXTENSION_WORKFLOWS } from "../src/lib/revenue-os/extension-workflows.generated";
import { readBoundedJson } from "../src/lib/http/bounded-json";
import assert from "node:assert/strict";
import { AuthorizedMemorySupabase } from "./lib/autonomy-fixture";
import { bindTenantDatabase } from "../src/lib/supabase/server";
import { updateModuleConfiguration } from "../src/lib/revenue-os/module-configuration";
import {
  prepareWorkflowPlugin,
  proposeWorkflowPlugin,
} from "../src/lib/revenue-os/workflow-plugins";
import { approveAndExecuteAction } from "../src/lib/revenue-os/action-executor";
import { readWorkspaceBrand, saveWorkspaceBrand } from "../src/lib/revenue-os/branding";
import {
  workspaceBrandSchema,
  brandButtonInk,
  contrastRatio,
} from "../src/lib/revenue-os/branding-contract";
import { validateBoundedWorkflowSchema } from "./lib/bounded-workflow-schema.mjs";
async function main() {
  assert.deepEqual(
    await readBoundedJson(
      new Request("http://example.test", { method: "POST", body: '{"value":"é"}' }),
      32,
    ),
    { value: "é" },
  );
  await assert.rejects(
    () =>
      readBoundedJson(
        new Request("http://example.test", { method: "POST", body: '"' + "é".repeat(20) + '"' }),
        32,
      ),
    /size limit/,
  );
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(40));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () =>
      readBoundedJson(
        new Request("http://example.test", {
          method: "POST",
          body: stream,
          duplex: "half",
        } as RequestInit),
        32,
      ),
    /size limit/,
  );
  assert.equal(cancelled, true);

  const tenantId = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    user = "33333333-3333-4333-8333-333333333333",
    opportunityId = "44444444-4444-4444-8444-444444444444",
    meetingId = "55555555-5555-4555-8555-555555555555";
  const mem = new AuthorizedMemorySupabase({
    tenants: [
      {
        id: tenantId,
        name: "Example Studio",
        status: "active",
        config: { modules: {}, otherSetting: "preserve" },
      },
      { id: other, name: "Other company", status: "active", config: {} },
    ],
    tenant_memberships: [{ tenant_id: tenantId, user_id: user, status: "active" }],
    opportunities: [
      { id: opportunityId, tenant_id: tenantId, name: "Implementation", stage: "won" },
    ],
    calendar_events: [
      {
        id: meetingId,
        tenant_id: tenantId,
        title: "Kickoff",
        status: "confirmed",
        start_at: "2026-09-05T10:00:00Z",
      },
    ],
  });
  mem.idFactory = (sequence) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(sequence).padStart(12, "0")}`;
  const db = bindTenantDatabase(mem.client, tenantId, true),
    foreign = bindTenantDatabase(mem.client, other, true);
  const brand = await readWorkspaceBrand(db);
  const saved = await saveWorkspaceBrand(
    db,
    { ...brand.brand, accentColor: "#faf000", legalName: "Example Studio LLC" },
    brand.revision,
    "qa@example.example",
  );
  assert.equal(saved.brand.legalName, "Example Studio LLC");
  assert.equal(
    (mem.rows("tenants")[0]!.config as Record<string, unknown>).otherSetting,
    "preserve",
  );
  await assert.rejects(
    () => saveWorkspaceBrand(db, brand.brand, brand.revision, "qa@example.example"),
    /another session/,
  );
  await assert.rejects(
    () =>
      saveWorkspaceBrand(
        db,
        { ...saved.brand, inkColor: "#ffffff" },
        saved.revision,
        "qa@example.example",
      ),
    /contrast/,
  );
  assert.equal((await readWorkspaceBrand(foreign)).brand.name, "Other company");
  assert.equal(
    workspaceBrandSchema.safeParse({ ...saved.brand, logoUrl: "javascript:alert(1)" }).success,
    false,
  );
  assert.equal(
    workspaceBrandSchema.safeParse({
      ...saved.brand,
      logoUrl: "https://user:password@example.com/logo.png",
    }).success,
    false,
  );
  assert.ok(contrastRatio(saved.brand.accentColor, brandButtonInk(saved.brand.accentColor)) >= 4.5);
  assert.throws(
    () => validateBoundedWorkflowSchema({ type: "string", maxLength: 100, pattern: "(a+)+$" }),
    /Unsupported/,
  );
  assert.throws(
    () => validateBoundedWorkflowSchema({ $ref: "https://example.com/schema" }),
    /Unsupported/,
  );
  for (const [pluginId, sourceKey, sourceId] of [
    ["client-onboarding", "opportunityId", opportunityId],
    ["meeting-commitments", "meetingId", meetingId],
  ] as const) {
    await updateModuleConfiguration(
      db,
      { moduleId: pluginId, enabled: true },
      "qa@example.example",
    );
    const tasks = [
      {
        title:
          pluginId === "client-onboarding"
            ? "Confirm delivery scope"
            : "Send the agreed implementation brief",
        description: "Reviewed commitment",
        dueDate: "2026-09-08",
        assigneeUserId: user,
      },
    ];
    const input = { [sourceKey]: sourceId, tasks };
    const compiled = EXTENSION_WORKFLOWS[pluginId]!;
    const originalCode = compiled.code;
    try {
      compiled.code =
        '({title:"Bad plan",summary:"Missing reviewed identity",action:{type:"create_task_batch",payload:{}}})';
      await assert.rejects(
        () => prepareWorkflowPlugin(db, pluginId, input),
        /selected business identity/,
      );
    } finally {
      compiled.code = originalCode;
    }
    const preview = await prepareWorkflowPlugin(db, pluginId, input);
    assert.equal(preview.actionType, "create_task_batch");
    assert.equal(mem.rows("tasks").length, pluginId === "client-onboarding" ? 0 : 1);
    await assert.rejects(
      () =>
        prepareWorkflowPlugin(db, pluginId, {
          ...input,
          tasks: [{ ...tasks[0], assigneeUserId: other }],
        }),
      /active workspace assignee/,
    );
    const requestId =
      pluginId === "client-onboarding"
        ? "66666666-6666-4666-8666-666666666666"
        : "77777777-7777-4777-8777-777777777777";
    const action = await proposeWorkflowPlugin(
      db,
      pluginId,
      input,
      preview.digest,
      requestId,
      "qa@example.example",
    );
    const result = (await approveAndExecuteAction(db, action.id, "qa@example.example")) as {
      complete: boolean;
      tasks: { id: string }[];
    };
    assert.equal(result.complete, true);
    assert.equal(result.tasks.length, 1);
    const row = mem.rows("tasks").find((row) => row.id === result.tasks[0]!.id)!;
    assert.equal(row.assigned_to, user);
    assert.equal(row.related_id, sourceId);
    assert.equal(row.tenant_id, tenantId);
    row.status = "completed";
    const repeated = await proposeWorkflowPlugin(
      db,
      pluginId,
      input,
      preview.digest,
      requestId,
      "qa@example.example",
    );
    assert.equal(repeated.id, action.id);
    await updateModuleConfiguration(
      db,
      { moduleId: pluginId, enabled: false },
      "qa@example.example",
    );
    await assert.rejects(() => prepareWorkflowPlugin(db, pluginId, input), /disabled/);
  }
  assert.equal(mem.rows("tasks").length, 2);
  console.log(
    "Business workflows: real isolated onboarding/meeting plans create assigned canonical tasks through approval; replay, invalid assignees and disabled workflows refused. Branding validates URLs, contrast, tenant isolation and stale revisions while preserving workspace settings.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
