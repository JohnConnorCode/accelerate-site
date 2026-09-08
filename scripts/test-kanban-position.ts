import assert from "node:assert/strict";
import { moveKanbanItem } from "../src/lib/kanban/position";
type Card = { id: string; column: string; order: number };
const access = {
  id: (i: Card) => i.id,
  column: (i: Card) => i.column,
  order: (i: Card) => i.order,
  position: (i: Card, column: string, order: number) => ({ ...i, column, order }),
};
const initial = [
  { id: "a", column: "one", order: 1000 },
  { id: "b", column: "one", order: 2000 },
  { id: "c", column: "one", order: 3000 },
  { id: "d", column: "two", order: 1000 },
];
const ids = (items: Card[], column: string) =>
  items
    .filter((i) => i.column === column)
    .sort((a, b) => a.order - b.order)
    .map((i) => i.id);
let moved = moveKanbanItem(initial, "a", "one", "c", true, access);
assert.deepEqual(ids(moved, "one"), ["b", "c", "a"]);
moved = moveKanbanItem(initial, "c", "one", "a", false, access);
assert.deepEqual(ids(moved, "one"), ["c", "a", "b"]);
moved = moveKanbanItem(initial, "b", "two", "d", false, access);
assert.deepEqual(ids(moved, "two"), ["b", "d"]);
assert.deepEqual(ids(moved, "one"), ["a", "c"]);
moved = moveKanbanItem(initial, "a", "empty", null, false, access);
assert.deepEqual(ids(moved, "empty"), ["a"]);
assert.equal(moved.find((i) => i.id === "a")!.order, 1000);
assert.equal(moveKanbanItem(initial, "missing", "two", null, false, access), initial);
assert.equal(moveKanbanItem(initial, "a", "one", "a", false, access), initial);
assert.equal(moveKanbanItem(initial, "a", "one", "b", false, access), initial);
assert.equal(
  moveKanbanItem(moved, "a", "empty", null, false, access),
  moved,
  "Repeated collision is stable",
);
assert.deepEqual(ids(initial, "one"), ["a", "b", "c"], "Preview never mutates durable input");
assert.equal(new Set(moved.map((i) => i.id)).size, initial.length, "No duplicate/lost cards");
console.log(
  "Kanban insertion passed: before/after, same/cross/empty columns, stable collisions and immutable input.",
);
