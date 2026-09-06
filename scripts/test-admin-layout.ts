#!/usr/bin/env tsx
/**
 * The AI-editable admin layout feature's entire safety story is that a
 * layout doc can only permute or hide a small, closed, code-defined set of
 * ids — never introduce a new id, never hide a region the UI depends on to
 * function. If `validateLayoutDoc` or `applyLayoutOverride` regress, the AI
 * could silently hide "Settings" from the sidebar or dangle the Today page's
 * in-page anchor link. Every assertion here fails if that containment breaks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyLayoutOverride } from "../src/lib/admin/layout-overrides";
import { getLayoutScope } from "../src/lib/admin/layout-scopes";
import {
  validateLayoutDoc,
  applyLayoutChange,
  getCurrentLayout,
  ADMIN_LAYOUT_SCOPES,
} from "../src/lib/revenue-os/admin-layout";
import {
  executeRegisteredRevenueTool,
  assertImpactHonoured,
  getRevenueAiTools,
} from "../src/lib/revenue-os/ai-tools";

type Row = Record<string, unknown>;

function stubSupabase(settingsRow: { value: string } | null = null) {
  const inserted: Array<{ table: string; payload: Row }> = [];
  // Stateful settings shelf so a save round-trips: upserts land here and
  // subsequent reads serve them. Seeded from settingsRow for older tests.
  const shelf: Record<string, string> = {};
  function query(table: string): Record<string, unknown> {
    let pending: Row | null = null;
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const method of ["select", "eq", "or", "order", "limit", "range", "single"])
      self[method] = chain;
    self.maybeSingle = () => self;
    self.insert = (payload: Row) => {
      pending = payload;
      inserted.push({ table, payload });
      return self;
    };
    self.upsert = (payload: Row) => {
      pending = payload;
      inserted.push({ table, payload });
      if (
        table === "admin_settings" &&
        typeof payload.key === "string" &&
        typeof payload.value === "string"
      )
        shelf[payload.key] = payload.value;
      return self;
    };
    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      if (pending) return resolve({ data: { id: "queued-action-id", ...pending }, error: null });
      if (table === "admin_settings") {
        const keys = Object.keys(shelf);
        if (keys.length) return resolve({ data: { value: shelf[keys[0]!] }, error: null });
        return resolve({ data: settingsRow, error: null });
      }
      return resolve({ data: [], error: null });
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

async function rejects(run: () => unknown, includes: string, because: string) {
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
  // ---- Scope registry is a closed set --------------------------------------

  const navScope = getLayoutScope("nav.sidebar")!;
  const todayScope = getLayoutScope("page.today")!;
  assert.ok(navScope, "nav.sidebar scope must be registered");
  assert.ok(todayScope, "page.today scope must be registered");
  assert.ok(
    navScope.requiredIds.includes("settings"),
    "the sidebar's Settings link must be a required (never-hideable) id",
  );
  assert.ok(
    todayScope.requiredIds.includes("revenue-copilot"),
    "the Today page's copilot panel must be required — the empty-approvals state anchors to it",
  );

  // ---- validateLayoutDoc is the containment boundary -----------------------

  await rejects(
    () => validateLayoutDoc("not.a.scope", { order: [], hidden: [] }),
    "unknown layout scope",
    "an unregistered scope must be rejected, not silently accepted",
  );

  await rejects(
    () => validateLayoutDoc("nav.sidebar", { order: ["today", "made-up-link"], hidden: [] }),
    "unknown ids",
    "an id outside the fixed registered set must be rejected — this is what stops the AI inventing nav entries",
  );

  await rejects(
    () => validateLayoutDoc("nav.sidebar", { order: [], hidden: ["settings"] }),
    "cannot hide required",
    "hiding a required id must be rejected even though it's a real, known id",
  );

  await rejects(
    () => validateLayoutDoc("page.today", { order: [], hidden: ["revenue-copilot"] }),
    "cannot hide required",
    "the Today page's required region must be protected identically to nav's",
  );

  const validDoc = validateLayoutDoc("nav.sidebar", {
    order: ["pipeline", "today"],
    hidden: ["partners"],
  });
  assert.deepEqual(validDoc, { order: ["pipeline", "today"], hidden: ["partners"] });

  // Non-array / malformed input degrades to empty rather than throwing —
  // a stored doc that predates a field rename should not crash the page.
  const malformed = validateLayoutDoc("nav.sidebar", { order: "not-an-array" });
  assert.deepEqual(malformed, { order: [], hidden: [] });

  // ---- applyLayoutOverride: the actual render-time merge -------------------

  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  assert.deepEqual(
    applyLayoutOverride(items, [], null),
    items,
    "no override must render the default order unchanged",
  );

  assert.deepEqual(
    applyLayoutOverride(items, [], { order: ["c", "a"], hidden: [] }).map((i) => i.id),
    ["c", "a", "b"],
    "ordered ids come first in the requested order; ids missing from order are appended in registry order",
  );

  assert.deepEqual(
    applyLayoutOverride(items, [], { order: [], hidden: ["b"] }).map((i) => i.id),
    ["a", "c"],
    "a hidden id must be dropped from the render",
  );

  assert.deepEqual(
    applyLayoutOverride(items, ["b"], { order: [], hidden: ["b"] }).map((i) => i.id),
    ["a", "b", "c"],
    "a required id must survive even if a stale/malicious doc tries to hide it — the render-time check, not just validateLayoutDoc, must hold the line",
  );

  assert.deepEqual(
    applyLayoutOverride(items, [], { order: ["z", "a"], hidden: ["also-fake"] }).map((i) => i.id),
    ["a", "b", "c"],
    "unknown ids referenced by a doc must be silently dropped, never crash or inject a phantom entry",
  );

  // ---- Storage fails safe, not loud -----------------------------------------

  const corrupted = await getCurrentLayout(
    stubSupabase({ value: "{not json" }) as unknown as Parameters<typeof getCurrentLayout>[0],
    "nav.sidebar",
    "tenant-1",
  );
  assert.equal(
    corrupted,
    null,
    "a stored doc that fails to parse must fall back to the default order, not throw and break the page",
  );

  const staleIds = await getCurrentLayout(
    stubSupabase({
      value: JSON.stringify({ order: ["a-link-that-no-longer-exists"], hidden: [] }),
    }) as unknown as Parameters<typeof getCurrentLayout>[0],
    "nav.sidebar",
    "tenant-1",
  );
  assert.equal(
    staleIds,
    null,
    "a stored doc referencing ids that are no longer registered must fall back to default, not throw",
  );

  // ---- The AI tool: schema, pack membership, and impact honesty -------------

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_layout_change", {
        order: ["today"],
        reasoning: "test",
      }),
    'requires "scope"',
    "scope is required; a proposal without one is meaningless",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_layout_change", {
        scope: "admin_settings",
        reasoning: "test",
      }),
    "one of",
    "scope is a closed enum — an arbitrary table/scope name must be rejected at the schema layer",
  );

  await rejects(
    () =>
      executeRegisteredRevenueTool(context(stubSupabase()), "propose_layout_change", {
        scope: "nav.sidebar",
        hidden: ["settings"],
        reasoning: "hide settings",
      }),
    "cannot hide required",
    "the tool must surface the domain-service rejection back to the model, not swallow it",
  );

  const proposed = await executeRegisteredRevenueTool(
    context(stubSupabase()),
    "propose_layout_change",
    { scope: "nav.sidebar", order: ["pipeline", "today"], reasoning: "Founder asked for this" },
  );
  assert.equal((proposed.output as { id: string }).id, "queued-action-id");
  assert.equal(proposed.tool.impact, "internal_write");
  assertImpactHonoured(proposed.tool, proposed.output);

  const corePack = getRevenueAiTools("core").map((tool) => tool.name);
  assert.ok(
    corePack.includes("propose_layout_change"),
    "propose_layout_change must be reachable from the default (core) tool pack",
  );

  // ---- Founder-direct save: the same validated service, no queue --------

  const founderDb = stubSupabase();
  const saved = await applyLayoutChange(
    founderDb as unknown as Parameters<typeof applyLayoutChange>[0],
    {
      scope: "page.today",
      doc: { order: ["revenue-copilot", "operating-summary"], hidden: ["operational-ledger"] },
      actorEmail: "founder@acceleratewith.us",
      source: "admin",
      tenantId: "tenant-1",
    },
  );
  assert.deepEqual(saved, {
    order: ["revenue-copilot", "operating-summary"],
    hidden: ["operational-ledger"],
  });
  const reread = await getCurrentLayout(
    founderDb as unknown as Parameters<typeof getCurrentLayout>[0],
    "page.today",
    "tenant-1",
  );
  assert.deepEqual(reread, saved, "a founder save must round-trip through storage, not just echo");
  const auditWrite = founderDb.inserted.find((entry) => entry.table === "audit_log");
  assert.equal(
    (auditWrite?.payload as { source?: string } | undefined)?.source,
    "admin",
    "founder-direct saves audit as admin, not ai",
  );

  await rejects(
    () =>
      applyLayoutChange(founderDb as unknown as Parameters<typeof applyLayoutChange>[0], {
        scope: "page.today",
        doc: { order: ["made-up-region"], hidden: [] },
        actorEmail: "founder@acceleratewith.us",
        tenantId: "tenant-1",
      }),
    "unknown ids",
    "the save endpoint must refuse unknown ids, not store them",
  );
  await rejects(
    () =>
      applyLayoutChange(founderDb as unknown as Parameters<typeof applyLayoutChange>[0], {
        scope: "page.today",
        doc: { order: [], hidden: ["revenue-copilot"] },
        actorEmail: "founder@acceleratewith.us",
        tenantId: "tenant-1",
      }),
    "cannot hide required",
    "the save endpoint must refuse hiding required regions",
  );

  // ---- Tenant isolation is structural, not conventional --------------------

  const { MemorySupabase } = await import("./lib/memory-supabase.js");
  const tenantDb = new MemorySupabase({ admin_settings: [], audit_log: [] });
  const tenantClient = tenantDb.client as unknown as Parameters<typeof applyLayoutChange>[0];
  await applyLayoutChange(tenantClient, {
    scope: "page.today",
    doc: { order: [], hidden: ["operational-ledger"] },
    actorEmail: "a@example.com",
    tenantId: "tenant-a",
  });
  assert.equal(
    await getCurrentLayout(tenantClient, "page.today", "tenant-b"),
    null,
    "tenant B must not read tenant A's layout doc",
  );
  await applyLayoutChange(tenantClient, {
    scope: "page.today",
    doc: { order: ["revenue-copilot"], hidden: [] },
    actorEmail: "b@example.com",
    tenantId: "tenant-b",
  });
  assert.deepEqual(
    (await getCurrentLayout(tenantClient, "page.today", "tenant-a"))?.hidden,
    ["operational-ledger"],
    "tenant A's doc must survive tenant B writing its own",
  );

  // ---- Wiring: the executor actually dispatches to the domain service -------

  const executorSource = readFileSync("src/lib/revenue-os/action-executor.ts", "utf8");
  assert.match(
    executorSource,
    /"admin_layout_change"/,
    "admin_layout_change must be declared in APPROVABLE_ACTIONS or approval can never execute it",
  );
  assert.match(
    executorSource,
    /case "admin_layout_change":[\s\S]{0,200}applyLayoutChange\(/,
    "the admin_layout_change case must call applyLayoutChange, the same domain service the AI tool proposes into",
  );

  // action_queue.entity_id is a UUID column. A layout scope ("nav.sidebar",
  // "page.today") is not a UUID, and a stubbed Supabase client happily echoes
  // back whatever you insert — so this exact defect (proposeLayoutChange
  // once passed entityId: input.scope) passed every test above while failing
  // every real proposal in production with a Postgres type error. Guard the
  // source directly, since no in-process test can see a real column type.
  const adminLayoutSource = readFileSync("src/lib/revenue-os/admin-layout.ts", "utf8");
  const proposeLayoutChangeBody = adminLayoutSource.slice(
    adminLayoutSource.indexOf("export async function proposeLayoutChange"),
    adminLayoutSource.indexOf("export async function applyLayoutChange"),
  );
  assert.ok(
    !/entityId:\s*input\.scope/.test(proposeLayoutChangeBody),
    "proposeLayoutChange must not pass the scope string as action_queue.entity_id (a UUID column) — this silently failed every real proposal in production",
  );

  console.log(
    JSON.stringify(
      {
        registeredScopes: ADMIN_LAYOUT_SCOPES.map((scope) => scope.id),
        checks: [
          "scope-registry",
          "validate-unknown-scope",
          "validate-unknown-ids",
          "validate-required-hide",
          "validate-malformed",
          "override-default",
          "override-reorder",
          "override-hide",
          "override-required-survives",
          "override-unknown-dropped",
          "storage-corrupt-fallback",
          "storage-stale-ids-fallback",
          "tool-schema-required",
          "tool-schema-enum",
          "tool-domain-rejection-surfaced",
          "tool-impact-honoured",
          "tool-core-pack",
          "executor-wiring",
          "founder-save-roundtrip",
          "founder-save-unknown-refused",
          "founder-save-required-refused",
          "tenant-isolation",
          "no-scope-string-into-uuid-entity-id",
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
