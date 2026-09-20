import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fictionalWebsite } from "../src/lib/admin/demo/website-runtime";
import { applySiteEditorCommand } from "../src/lib/site-studio/editor-operations";
import {
  siteEditorChangeSchema,
  SITE_EDITOR_TOOL_NAMES,
} from "../src/lib/site-studio/editor-contract";
import { handleMcpRequest } from "../src/lib/revenue-os/mcp-server";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { MemorySupabase } from "./lib/memory-supabase";
import { executeRegisteredRevenueTool } from "../src/lib/revenue-os/ai-tools";
import { isVerifiedSiteDelegation } from "../src/lib/site-studio/delegation";
import { websiteThemeStyle } from "../src/lib/site-studio/website-theme";
import { contrastRatio } from "../src/lib/revenue-os/branding-contract";

async function main() {
  const website = fictionalWebsite("Example Workshop");
  const envelope = { operation: "edit" as const, requestKey: randomUUID(), expectedVersion: 0 };
  const command = {
    ...envelope,
    changes: [
      {
        kind: "create_page" as const,
        id: "new-page",
        title: "Services",
        path: "/services",
        starter: "article" as const,
      },
    ],
  };
  const first = applySiteEditorCommand(website, command);
  assert.deepEqual(first, applySiteEditorCommand(website, command), "preparation is deterministic");
  assert.equal(first.operation, "save");
  if (first.operation !== "save") throw new Error("Expected save");
  assert.equal(first.document.pages.length, website.pages.length + 1);
  assert.equal(website.pages.length, 1, "preparation does not mutate its source");
  assert.deepEqual(
    siteEditorChangeSchema.parse({ kind: "configure", theme: website.theme }),
    { kind: "configure", theme: website.theme },
    "omitted defaults must not reset header or dock",
  );
  const changed = applySiteEditorCommand(first.document, {
    ...envelope,
    changes: [
      {
        kind: "create_page",
        id: "clone",
        title: "Clone",
        path: "/clone",
        starter: "article",
        cloneId: "new-page",
      },
      { kind: "remove_page", id: "new-page" },
      { kind: "put_collection", collection: { id: "news", title: "News", entries: [] } },
      {
        kind: "put_entry",
        collectionId: "news",
        entry: {
          id: "item",
          path: "/news/item",
          metadata: { title: "News item", description: "", noIndex: false },
          title: "News item",
          summary: "",
          body: [],
          tags: [],
        },
      },
    ],
  });
  if (changed.operation !== "save") throw new Error("Expected save");
  assert.ok(changed.document.pages.some((page) => page.id === "clone"));
  assert.equal(changed.document.collections[0]?.entries.length, 1);
  for (const path of ["/admin", "/f/token", "/api/mcp", "/auth/callback"])
    assert.throws(() =>
      applySiteEditorCommand(website, { ...command, changes: [{ ...command.changes[0]!, path }] }),
    );
  assert.throws(() =>
    applySiteEditorCommand(website, {
      ...envelope,
      changes: [{ kind: "remove_page", id: website.pages[0]!.id }],
    }),
  );
  assert.throws(() =>
    siteEditorChangeSchema.parse({ kind: "configure", __proto__: {}, css: "body{display:none}" }),
  );
  for (const accent of ["#000000", "#ffffff", "#3458d4", "#ddcc99"]) {
    const theme = websiteThemeStyle({ ...website.theme, accent }) as Record<string, unknown>;
    assert.ok(contrastRatio(accent, theme["--site-on-accent"] as string) >= 4.5);
    assert.equal(theme["--site-muted"], website.theme.foreground);
  }
  assert.equal(
    isVerifiedSiteDelegation({ auth: {}, grant: {} }),
    false,
    "model arguments cannot manufacture authority",
  );
  const memory = new MemorySupabase({
    tenants: [{ id: "workspace", status: "active", config: {} }],
  });
  const context = {
    supabase: bindTenantDatabaseForTest(memory.client as never, "workspace"),
    actorEmail: "owner@example.test",
    allowedToolNames: SITE_EDITOR_TOOL_NAMES,
  };
  const listed = await handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" }, context);
  const tools = (
    listed?.result as {
      tools: { name: string; annotations: { readOnlyHint: boolean; destructiveHint: boolean } }[];
    }
  ).tools;
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...SITE_EDITOR_TOOL_NAMES].sort());
  const execute = tools.find((tool) => tool.name === "execute_site_change")!;
  assert.equal(execute.annotations.readOnlyHint, false);
  assert.equal(execute.annotations.destructiveHint, true);
  const refused = await handleMcpRequest(
    { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "list_tasks", arguments: {} } },
    context,
  );
  assert.equal((refused?.result as { isError: boolean }).isError, true);
  const resources = await handleMcpRequest(
    { jsonrpc: "2.0", id: 3, method: "resources/list" },
    context,
  );
  assert.deepEqual(resources?.result, { resources: [] });
  const privateRead = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 4,
      method: "resources/read",
      params: { uri: "revenue-os://today/snapshot" },
    },
    context,
  );
  assert.ok(privateRead?.error);
  await assert.rejects(
    executeRegisteredRevenueTool(context, "execute_site_change", {
      actionId: randomUUID(),
      digest: "a".repeat(64),
      summary: "Publish",
    }),
    /owner-approved/,
  );
  assert.equal(
    memory.rpcCalls.length,
    0,
    "legacy contexts never reach the delegated database command",
  );
  console.log(
    "PASS: typed editor transformations, deterministic preview, route and import validation, theme contrast, scoped MCP discovery, annotations and forged/legacy delegation refusal.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
