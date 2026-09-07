import assert from "node:assert/strict";
import {
  pageOptions,
  receipt,
  taskPacket,
  taskConfigSchema,
  recentProgress,
  shellQuote,
} from "./lib/task-context";
assert.deepEqual(pageOptions({}), { limit: 25, offset: 0 });
for (const flags of [
  { limit: "0" },
  { limit: "101" },
  { offset: "-1" },
  { limit: "foo" },
] as Record<string, string>[])
  assert.throws(() => pageOptions(flags));
const card = {
  id: "one",
  seed_key: "chosen",
  title: "Chosen task",
  status: "in_progress",
  revision: 7,
  description: "Outcome",
  work_spec: {
    acceptance: [{ id: "AC1", criterion: "Required outcome" }],
    references: [{ path: "owner.ts", reason: "Shared owner" }],
  },
  notes: "x".repeat(100000),
  work_delivery: { checks: "x".repeat(100000) },
};
assert(JSON.stringify(receipt(card)).length < 300);
assert(!JSON.stringify(receipt(card)).includes("acceptance"));
assert.deepEqual(taskPacket(card).contract, card.work_spec);
assert.equal(taskPacket(card).notes, card.notes, "Focused packets must retain authoritative notes");
assert.equal(
  taskPacket({ ...card, work_spec: {}, acceptance_criteria: "Legacy requirement" })
    .legacyAcceptance,
  "Legacy requirement",
);
const config = {
  version: 1,
  transport: "local-operator",
  project: "accelerate",
  envFile: "/private/existing.env",
};
assert.deepEqual(taskConfigSchema.parse(config), config);
assert.deepEqual(
  taskConfigSchema.parse({ version: 1, transport: "https", envFile: "/private/remote.env" }),
  { version: 1, transport: "https", envFile: "/private/remote.env" },
);
for (const bad of [
  { ...config, token: "secret" },
  { ...config, project: "*" },
  { ...config, envFile: "relative.env" },
])
  assert.throws(() => taskConfigSchema.parse(bad));
const events = Array.from({ length: 10 }, (_, i) => ({
  operation: "progress",
  created_at: String(i),
  payload: { message: "step".repeat(1000) },
}));
assert.equal(recentProgress(events).length, 3);
assert.equal(recentProgress(events)[0]!.message.length, 2000);
assert.equal(shellQuote("a'b"), "'a'\\''b'");
console.log(
  "Task context bounds, packet completeness, progress and secret-free configuration passed",
);
