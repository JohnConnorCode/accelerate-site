import assert from "node:assert/strict";
import {
  cleanSubtasks,
  hydrateSubtasks,
  isFeatureOverdue,
  moveSubtask,
  parseAcceptanceLines,
  remainingSubtasks,
  renameSubtask,
  subtaskProgress,
  toggleSubtask,
} from "../src/lib/feature-board";
import { parseWipLimit } from "../src/lib/kanban/types";

assert.deepEqual(parseAcceptanceLines("- One\n- Two\n"), ["One", "Two"]);
assert.deepEqual(parseAcceptanceLines("- [ ] Open\n- [x] Done"), ["Open", "Done"]);
assert.deepEqual(parseAcceptanceLines("   \n"), []);

const cleaned = cleanSubtasks([
  { id: "a", title: "  Ship it  ", done: true },
  { title: "", done: true },
  { id: "b", title: "Write tests", done: "yes" },
  null,
]);
assert.equal(cleaned.length, 2);
assert.equal(cleaned[0]?.title, "Ship it");
assert.equal(cleaned[0]?.done, true);
assert.equal(cleaned[1]?.done, false);

const hydratedFromAcceptance = hydrateSubtasks({
  id: "feat-1",
  subtasks: [],
  acceptance_criteria: "- Filter the inbox\n- Prove it in a browser",
});
assert.equal(hydratedFromAcceptance.length, 2);
assert.equal(hydratedFromAcceptance[0]?.id, "feat-1:acceptance:0");
assert.equal(hydratedFromAcceptance[0]?.done, false);

const storedWins = hydrateSubtasks({
  id: "feat-1",
  subtasks: [{ id: "x", title: "Manual", done: true }],
  acceptance_criteria: "- Ignored",
});
assert.equal(storedWins.length, 1);
assert.equal(storedWins[0]?.title, "Manual");

assert.deepEqual(subtaskProgress(storedWins), { done: 1, total: 1 });
assert.deepEqual(subtaskProgress([]), { done: 0, total: 0 });

const toggled = toggleSubtask(
  [
    { id: "a", title: "One", done: false },
    { id: "b", title: "Two", done: true },
  ],
  "a",
);
assert.equal(toggled[0]?.done, true);
assert.equal(toggled[1]?.done, true);

const renamed = renameSubtask(toggled, "b", "  Two renamed  ");
assert.equal(renamed[1]?.title, "Two renamed");
assert.equal(renameSubtask(renamed, "b", "   ").length, 1);

const moved = moveSubtask(
  [
    { id: "a", title: "One", done: false },
    { id: "b", title: "Two", done: false },
    { id: "c", title: "Three", done: false },
  ],
  "c",
  -1,
);
assert.deepEqual(
  moved.map((item) => item.id),
  ["a", "c", "b"],
);
assert.deepEqual(
  moveSubtask(moved, "a", -1).map((item) => item.id),
  ["a", "c", "b"],
);

assert.equal(remainingSubtasks(toggled).length, 0);
assert.equal(isFeatureOverdue({ target_date: "2000-01-01", status: "planned" }), true);
assert.equal(isFeatureOverdue({ target_date: "2000-01-01", status: "shipped" }), false);
assert.equal(isFeatureOverdue({ target_date: "2999-01-01", status: "planned" }), false);

assert.equal(parseWipLimit({ wipLimit: 6 }), 6);
assert.equal(parseWipLimit({ wipLimit: 0 }), null);
assert.equal(parseWipLimit({ wipLimit: 120 }), 99);
assert.equal(parseWipLimit({}), null);

console.log("feature subtasks helpers passed");
