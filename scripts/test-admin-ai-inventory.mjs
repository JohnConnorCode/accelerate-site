import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  inspectRoute,
  inventory,
  serializeInventory,
  operationBindings,
  assertNoNewCoverageGaps,
} from "./admin-ai-inventory.mjs";

test("finds function, variable, alias and named reexports without counting comments or types", () => {
  const result = inspectRoute(`
    import { save } from './service';
    // export function DELETE() {}
    const description = 'export function PUT() {}';
    export async function POST() { return save(); }
    export const PATCH = POST;
    const read = () => {};
    export { read as GET };
    export { remove as DELETE } from './other';
    export type { PUT } from './types';
    export const runtime = 'nodejs';
  `);
  assert.deepEqual(result.handlers, ["DELETE", "GET", "PATCH", "POST"]);
  assert.deepEqual(result.mutationHandlers, ["DELETE", "PATCH", "POST"]);
});

test("semantic bindings refuse missing routes, conflicting commands and absent evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "admin-ai-bindings-"));
  try {
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "scripts/test-example.ts"), "// executable acceptance fixture");
    const routes = [{ source: "src/app/api/admin/example/route.ts", handlers: ["POST"] }];
    const operation = {
      id: "example.change",
      version: 1,
      scope: "workspace",
      entrypoints: [{ path: "/api/admin/example", method: "POST", variant: "change" }],
      verification: ["scripts/test-example.ts"],
    };
    const tool = { name: "propose_example", serviceTarget: "example.service", operation };
    const result = operationBindings(root, routes, [
      tool,
      { name: "preview_example", serviceTarget: "example.service", operation },
      { name: "legacy" },
    ]);
    assert.equal(result.complete, false);
    assert.deepEqual(result.operations[0].tools, ["propose_example", "preview_example"]);
    assert.deepEqual(result.unreviewedToolBindings, ["legacy"]);
    assert.throws(
      () =>
        operationBindings(root, routes, [
          tool,
          { ...tool, name: "bad", operation: { ...operation, version: 2 } },
        ]),
      /Conflicting/,
    );
    assert.throws(() => operationBindings(root, [], [tool]), /missing handler/);
    assert.throws(
      () =>
        operationBindings(root, routes, [
          tool,
          { ...tool, name: "alternate", serviceTarget: "other.service" },
        ]),
      /one service owner/,
    );
    assert.throws(
      () =>
        assertNoNewCoverageGaps(
          { semantic: result, additionalEntrypoints: [] },
          { semantic: { ...result, handlersWithoutReviewedBindings: ["POST /api/admin/new"] } },
        ),
      /New operations/,
    );
    assert.throws(
      () =>
        operationBindings(root, routes, [
          { ...tool, operation: { ...operation, verification: ["scripts/missing.ts"] } },
        ]),
      /ENOENT/,
    );
    const previous = { semantic: result, additionalEntrypoints: [] };
    assert.doesNotThrow(() => assertNoNewCoverageGaps(previous, previous));
    assert.throws(
      () =>
        assertNoNewCoverageGaps(previous, {
          semantic: { ...result, unreviewedToolBindings: ["legacy", "new_write"] },
        }),
      /New operations/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source operations need exact reviewed bindings and cannot be silently refreshed", () => {
  const root = mkdtempSync(join(tmpdir(), "admin-ai-source-"));
  try {
    mkdirSync(join(root, "scripts"));
    writeFileSync(join(root, "scripts/test-example.ts"), "// acceptance");
    const source = {
      kind: "server_action",
      source: "src/app/actions.ts",
      operations: ["create", "remove"],
    };
    const operation = {
      id: "example.create",
      version: 1,
      scope: "workspace",
      entrypoints: [],
      sourceEntrypoints: [{ kind: "server_action", path: source.source, operation: "create" }],
      verification: ["scripts/test-example.ts"],
    };
    const result = operationBindings(
      root,
      [],
      [{ name: "create", serviceTarget: "example", operation }],
      [source],
    );
    assert.deepEqual(result.unreviewedSourceBindings, ["server_action src/app/actions.ts remove"]);
    assert.throws(
      () => operationBindings(root, [], [{ name: "create", operation }], []),
      /missing source operation/,
    );
    const previous = { semantic: result, additionalEntrypoints: [] };
    assert.throws(
      () =>
        assertNoNewCoverageGaps(previous, {
          semantic: {
            ...result,
            unreviewedSourceBindings: [
              ...result.unreviewedSourceBindings,
              "client_write src/app/editor.tsx delete:clients",
            ],
          },
        }),
      /New operations/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed on wildcard, destructured or malformed exports", () => {
  assert.throws(() => inspectRoute("export * from './other';"), /wildcard/);
  assert.throws(() => inspectRoute("export const { POST } = handlers;"), /destructured/);
  assert.throws(() => inspectRoute("export function POST( {"), /Cannot parse/);
  assert.deepEqual(
    inspectRoute("export function GET() { return <div>Preview</div>; }", "route.tsx").handlers,
    ["GET"],
  );
});

test("source fingerprint changes even when a handler name does not", () => {
  const a = inspectRoute("export const PATCH = () => save('one');");
  const b = inspectRoute("export const PATCH = () => save('two');");
  assert.deepEqual(a.handlers, b.handlers);
  assert.notEqual(a.sourceSha256, b.sourceSha256);
});

test("recursive inventory detects additions and removals with stable serialization", () => {
  const root = mkdtempSync(join(tmpdir(), "admin-ai-inventory-"));
  try {
    const directory = join(root, "src/app/api/admin/example/[id]");
    mkdirSync(directory, { recursive: true });
    const file = join(directory, "route.ts");
    writeFileSync(file, "export const PATCH = () => {};");
    const first = inventory(root);
    assert.equal(first.routeCount, 1);
    assert.equal(first.mutationHandlerCount, 1);
    assert.equal(first.routes[0].source, "src/app/api/admin/example/[id]/route.ts");
    assert.equal(serializeInventory(first), serializeInventory(inventory(root)));
    writeFileSync(join(directory, "helper.ts"), "export const DELETE = () => {};");
    assert.equal(inventory(root).routeCount, 1);
    rmSync(file);
    assert.equal(inventory(root).routeCount, 0);
    assert.notEqual(serializeInventory(first), serializeInventory(inventory(root)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
