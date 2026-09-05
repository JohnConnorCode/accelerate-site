import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspectRoute, inventory, serializeInventory } from "./admin-ai-inventory.mjs";

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

test("fails closed on wildcard, destructured or malformed exports", () => {
  assert.throws(() => inspectRoute("export * from './other';"), /wildcard/);
  assert.throws(() => inspectRoute("export const { POST } = handlers;"), /destructured/);
  assert.throws(() => inspectRoute("export function POST( {"), /Cannot parse/);
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
