import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bindTenantDatabaseForTest } from "@/lib/supabase/server";
import {
  contentCalendarChangesSchema,
  previewContentCalendarUpdate,
} from "@/lib/revenue-os/content-calendar";
import { randomUUID } from "node:crypto";
import { createAdminConfigurationFixture } from "./lib/admin-configuration-fixture";
import { runWithTenantRequestContext } from "@/lib/tenancy/context";
import { executeRegisteredRevenueTool } from "@/lib/revenue-os/ai-tools";
import { handleMcpRequest } from "@/lib/revenue-os/mcp-server";
import { approveAndExecuteAction } from "@/lib/revenue-os/action-executor";
import { rejectAction } from "@/lib/revenue-os/actions";
import {
  previewContentCalendarCommand,
  writeContentCalendarCommand,
} from "@/lib/revenue-os/content-calendar";
import { contentCalendarCommandSchema } from "@/lib/revenue-os/content-calendar-contract";

const tenantId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const row = {
  id: itemId,
  title: "First draft",
  slug: "first-draft",
  status: "draft",
  category: "education",
  target_keywords: ["onboarding"],
  pillar: null,
  funnel_stage: "awareness",
  target_publish_date: null,
  actual_publish_date: null,
  author: "Editor",
  notes: null,
  seo_title: null,
  seo_description: null,
  word_count_target: 900,
  updated_at: "2026-09-23T12:00:00.000Z",
};

const fakeDatabase = {
  from(table: string) {
    assert.ok(["content_calendar", "tenants"].includes(table));
    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      async maybeSingle() {
        return {
          data: table === "tenants" ? { status: "active", config: {} } : row,
          error: null,
        };
      },
    };
    return query;
  },
} as unknown as SupabaseClient;

async function main() {
  const database = bindTenantDatabaseForTest(fakeDatabase, tenantId);
  const preview = await previewContentCalendarUpdate(database, {
    id: itemId,
    changes: { status: "review", notes: "Ready for editorial review." },
  });

  assert.match(preview.digest, /^[a-f0-9]{64}$/);
  assert.equal(preview.tenantId, tenantId);
  assert.equal(preview.before.status, "draft");
  assert.equal(preview.after.status, "review");
  assert.deepEqual(
    preview.changes.map(({ field }) => field),
    ["status", "notes"],
  );
  assert.equal(preview.requiresHumanApproval, true);

  assert.equal(
    Object.keys(
      contentCalendarChangesSchema.parse({
        title: "Updated title",
        slug: "updated-title",
        status: "review",
        category: "education",
        target_keywords: ["onboarding"],
        pillar: null,
        funnel_stage: "awareness",
        target_publish_date: null,
        actual_publish_date: null,
        author: "Editor",
        notes: null,
        seo_title: null,
        seo_description: null,
        word_count_target: 900,
      }),
    ).length,
    14,
  );

  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: {
        title: "New title",
        slug: "new-title",
        status: "review",
        category: "education",
        pillar: "resources",
        notes: "Ready",
      },
    }),
    /no more than five fields/i,
  );

  assert.equal(
    contentCalendarCommandSchema.parse({
      operation: "create",
      id: randomUUID(),
      values: { title: "A valid draft" },
    }).operation,
    "create",
  );
  assert.throws(() =>
    contentCalendarCommandSchema.parse({
      operation: "create",
      id: randomUUID(),
      values: { title: "A draft", tenant_id: tenantId },
    }),
  );
  assert.throws(() =>
    contentCalendarCommandSchema.parse({
      operation: "reorder",
      updates: [
        { id: itemId, column_key: "draft", sort_order: 1 },
        { id: itemId, column_key: "review", sort_order: 2 },
      ],
    }),
  );
  const fixture = createAdminConfigurationFixture();
  fixture.mem.tables.kanban_columns = ["idea", "draft", "review"].map((key) => ({
    tenant_id: fixture.tenantId,
    board_key: "content",
    column_key: key,
    label: key,
    updated_at: "2026-10-06T12:00:00Z",
  }));
  fixture.mem.tables.content_calendar = [{ ...row, tenant_id: fixture.tenantId, sort_order: 1000 }];
  const hostFetch = globalThis.fetch;
  let calls = 0;
  let fail = false;
  let loseReply = false;
  globalThis.fetch = async (raw, init) => {
    const url = new URL(String(raw));
    if (!url.pathname.endsWith("/rpc/write_content_calendar_command")) return hostFetch(raw, init);
    calls++;
    const args = JSON.parse(String(init?.body));
    assert.equal(args.p_tenant, fixture.tenantId);
    assert.equal(args.p_actor, fixture.userId);
    assert.equal(args.p_actor_email, fixture.email);
    assert.equal(new Headers(init?.headers).get("x-tenant-id"), fixture.tenantId);
    if (loseReply) {
      fixture.mem.tables.audit_log ??= [];
      fixture.mem.tables.audit_log.push({
        tenant_id: fixture.tenantId,
        entity_id: args.p_request_key,
        action: "content_calendar.command",
        metadata: {
          inputDigest: args.p_input_digest,
          result: { status: "success", operation: "delete", count: 1, published: false },
        },
      });
      fixture.mem.tables.content_calendar = fixture.mem
        .rows("content_calendar")
        .filter((item) => item.id !== args.p_command.id);
      throw new TypeError("Controlled reply lost after commit");
    }
    return Response.json(
      fail
        ? { message: "Controlled database failure", code: "XX000" }
        : { status: "success", operation: args.p_command.operation, count: 1, published: false },
      { status: fail ? 500 : 200 },
    );
  };
  try {
    const context = { supabase: fixture.db, actorEmail: fixture.email, toolPack: "core" as const };
    await runWithTenantRequestContext(fixture.actor, async () => {
      const command = { operation: "delete", id: itemId };
      const requestKey = randomUUID();
      const change = (
        await executeRegisteredRevenueTool(context, "preview_content_calendar_change", {
          requestKey,
          command,
        })
      ).output as { digest: string };
      assert.equal(calls, 0);
      const response = await handleMcpRequest(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "propose_content_calendar_change",
            arguments: { requestKey, command, digest: change.digest },
          },
        },
        context,
      );
      const result = response!.result as { isError: boolean; content: Array<{ text: string }> };
      assert.equal(result.isError, false, JSON.stringify(result));
      const action = JSON.parse(result.content[0]!.text);
      assert.equal(action.action_type, "content_calendar_change");
      assert.equal(calls, 0);
      await approveAndExecuteAction(fixture.db, action.id, fixture.email);
      assert.equal(calls, 1);
      await assert.rejects(
        () => approveAndExecuteAction(fixture.db, action.id, fixture.email),
        /already handled/,
      );
      const proposal = async () => {
        const input = { requestKey: randomUUID(), command };
        const preview = await previewContentCalendarCommand(fixture.db, input);
        return (
          await executeRegisteredRevenueTool(context, "propose_content_calendar_change", {
            ...input,
            digest: preview.digest,
          })
        ).output as { id: string };
      };
      const denied = await proposal();
      await rejectAction(fixture.db, denied.id, fixture.email, "Keep this draft");
      await assert.rejects(() => approveAndExecuteAction(fixture.db, denied.id, fixture.email));
      assert.equal(calls, 1);
      const expired = await proposal();
      fixture.mem.rows("action_queue").find((item) => item.id === expired.id)!.expires_at =
        "2020-01-01T00:00:00Z";
      await assert.rejects(() => approveAndExecuteAction(fixture.db, expired.id, fixture.email));
      assert.equal(calls, 1);
      const mismatched = await proposal();
      const stored = fixture.mem.rows("action_queue").find((item) => item.id === mismatched.id)!;
      (stored.payload as { command: { id: string } }).command.id = randomUUID();
      await assert.rejects(
        () => approveAndExecuteAction(fixture.db, mismatched.id, fixture.email),
        /exact preview/,
      );
      assert.equal(calls, 1);
      await assert.rejects(
        () =>
          writeContentCalendarCommand(
            fixture.db,
            {
              requestKey: randomUUID(),
              command,
            },
            fixture.email,
            [{ id: itemId, revision: "stale" }],
          ),
        /changed/,
      );
      assert.equal(calls, 1);
      fail = true;
      const failed = await proposal();
      await assert.rejects(
        () => approveAndExecuteAction(fixture.db, failed.id, fixture.email),
        /result could not be confirmed/,
      );
      assert.equal(
        fixture.mem.rows("action_queue").find((item) => item.id === failed.id)!.status,
        "failed",
      );
      fail = false;
      const retry = await proposal();
      await approveAndExecuteAction(fixture.db, retry.id, fixture.email);
      assert.equal(calls, 3);
      const savedKey = randomUUID();
      const savedCommand = contentCalendarCommandSchema.parse({
        operation: "delete",
        id: itemId,
      });
      loseReply = true;
      await assert.rejects(
        () =>
          writeContentCalendarCommand(
            fixture.db,
            { requestKey: savedKey, command: savedCommand },
            fixture.email,
          ),
        /result could not be confirmed/,
      );
      loseReply = false;
      assert.equal(fixture.mem.rows("content_calendar").length, 0);
      const reconciled = await writeContentCalendarCommand(
        fixture.db,
        { requestKey: savedKey, command: savedCommand },
        fixture.email,
      );
      assert.equal(reconciled.replayed, true);
      assert.equal(calls, 4);
      await assert.rejects(
        () =>
          writeContentCalendarCommand(
            fixture.db,
            { requestKey: savedKey, command: { ...command, id: randomUUID() } },
            fixture.email,
          ),
        /request key/i,
      );
      fixture.mem.rows("tenant_memberships")[0]!.status = "revoked";
      await assert.rejects(
        () =>
          writeContentCalendarCommand(
            fixture.db,
            { requestKey: randomUUID(), command },
            fixture.email,
          ),
        /revoked/,
      );
    });
  } finally {
    fixture.restore();
  }

  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: { target_publish_date: "2026-02-30" },
    }),
  );
  await assert.rejects(
    previewContentCalendarUpdate(database, {
      id: itemId,
      changes: { status: "review", is_published: true },
    }),
  );
  await assert.rejects(
    previewContentCalendarUpdate(database, { id: itemId, changes: { status: "draft" } }),
    /No content calendar values would change/,
  );

  process.stdout.write(
    `${JSON.stringify({ result: "passed", checks: ["exact preview", "tenant binding", "approval requirement", "invalid date", "unknown field", "no-op refusal", "registered preview", "MCP proposal", "human execution", "denial", "expiry", "payload mismatch", "stale UI", "failed receipt and retry", "revoked administrator", "lost reply reconciliation"] })}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
