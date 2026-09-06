import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { inventoryPath, verifyInventory } from "./admin-route-inventory.mjs";

const original = JSON.parse(readFileSync(inventoryPath, "utf8"));
const copy = () => structuredClone(original);

test("every admin page has a current source boundary", () => {
  assert.deepEqual(verifyInventory(original), []);
});
test("a newly omitted route blocks handoff", () => {
  const inventory = copy();
  inventory.routes.pop();
  assert.ok(verifyInventory(inventory).some((error) => error.startsWith("Missing route:")));
});
test("duplicate rows cannot disguise a missing route", () => {
  const inventory = copy();
  inventory.routes[inventory.routes.length - 1] = inventory.routes[0];
  const errors = verifyInventory(inventory);
  assert.ok(errors.some((error) => error.startsWith("Duplicate route:")));
  assert.ok(errors.some((error) => error.startsWith("Missing route:")));
});
test("changed source evidence requires a new boundary review", () => {
  const inventory = copy();
  inventory.sources[inventory.routes[0].page] = "0".repeat(64);
  assert.ok(verifyInventory(inventory).some((error) => error.startsWith("Source changed;")));
});
test("a route needs an executable action and an explicit service disposition", () => {
  const inventory = copy();
  inventory.routes[0].primaryAction = "";
  inventory.routes[0].specialBoundary = null;
  const errors = verifyInventory(inventory);
  assert.ok(errors.some((error) => error.startsWith("Missing action/boundary:")));
  assert.ok(errors.some((error) => error.startsWith("Missing service disposition:")));
});
test("parity work must retain its canonical card identifier", () => {
  const inventory = copy();
  inventory.routes.find((row) => row.followUp).followUp.id = "unknown";
  assert.ok(verifyInventory(inventory).some((error) => error.startsWith("Invalid linked work:")));
});

test("table and domain observations cannot silently disappear", () => {
  const inventory = copy();
  inventory.routes.find((row) => row.route === "/admin/revenue").adapters[0].directTables = [];
  assert.ok(
    verifyInventory(inventory).some((error) => error.startsWith("Stale adapter observations:")),
  );
});
