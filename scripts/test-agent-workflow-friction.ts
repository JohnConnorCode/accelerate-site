#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mutateWorkBoard, type WorkActor } from "../src/lib/revenue-os/work-board";

const calls: Record<string, unknown>[] = [];
const db = {
  rpc: async (_name: string, args: Record<string, unknown>) => {
    calls.push(args);
    return { data: { card: { id: "fixture" } }, error: null };
  },
} as never;
const actor: WorkActor = {
  id: "workflow-friction-test",
  projects: ["accelerate"],
  scopes: ["create"],
  reviewer: false,
  capabilities: [],
};

async function main() {
  await mutateWorkBoard(db, actor, {
    operation: "create",
    requestKey: randomUUID(),
    payload: { project_key: "accelerate", title: "Ordinary card" },
  });
  assert.deepEqual(
    (calls[0]!.p_payload as { work_spec: unknown }).work_spec,
    { requiredCapabilities: [] },
    "ordinary cards must carry an explicit empty capability list",
  );

  calls.length = 0;
  await mutateWorkBoard(db, actor, {
    operation: "create",
    requestKey: randomUUID(),
    payload: {
      project_key: "accelerate",
      title: "Special card",
      work_spec: { requiredCapabilities: ["postgres"] },
    },
  });
  assert.deepEqual(
    (calls[0]!.p_payload as { work_spec: unknown }).work_spec,
    { requiredCapabilities: ["postgres"] },
    "declared capabilities must remain unchanged",
  );
  console.log("Agent workflow friction contract passed: capability defaults and preservation");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
