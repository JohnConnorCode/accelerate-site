#!/usr/bin/env tsx
/**
 * The founder can see what agents remember, correct it, and remove it, and
 * every change is auditable. Prompts get a de-duplicated view so a recurring
 * routine entry cannot crowd out everything else, and each run records which
 * memories it was given.
 */
import assert from "node:assert/strict";
import {
  forgetAgentMemory,
  listAgentMemoryForReview,
  memoryReceipt,
  recentDistinctAgentMemory,
  updateAgentMemory,
} from "../src/lib/revenue-os/memory";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";
import { MemorySupabase } from "./lib/memory-supabase";

const hour = 3_600_000;
const at = (offsetHours: number) => new Date(Date.now() + offsetHours * hour).toISOString();
const row = (id: string, subject: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenant_id: ACCELERATE_TENANT_ID,
  coworker_id: null,
  agent_run_id: null,
  category: "prior_work",
  subject,
  body: `${subject} details`,
  entity_type: null,
  entity_id: null,
  relevance_horizon: "daily",
  created_at: at(-1),
  expires_at: at(10),
  ...extra,
});

async function main() {
  const memory = new MemorySupabase({
    agent_memory: [
      row("m1", "proactive_intel_brief: 2026-09-23", { created_at: at(-1) }),
      row("m2", "proactive_intel_brief: 2026-09-22", { created_at: at(-2) }),
      row("m3", "Dana prefers email over calls", {
        category: "prior_research",
        agent_run_id: "run-7",
        created_at: at(-3),
        relevance_horizon: "permanent",
        expires_at: null,
      }),
      row("m4", "Expired note", { created_at: at(-4), expires_at: at(-1) }),
    ],
    audit_log: [],
  });
  const db = bindTenantDatabaseForTest(memory.client, ACCELERATE_TENANT_ID);

  const visible = await listAgentMemoryForReview(db);
  assert.deepEqual(
    visible.map((entry) => entry.id),
    ["m1", "m2", "m3"],
    "review defaults to what agents can currently see, newest first",
  );
  assert.equal((await listAgentMemoryForReview(db, { includeExpired: true })).length, 4);
  assert.deepEqual(
    (await listAgentMemoryForReview(db, { category: "prior_research" })).map((entry) => entry.id),
    ["m3"],
  );
  await assert.rejects(() => listAgentMemoryForReview(db, { category: "secrets" }), /unknown/i);

  const distinct = await recentDistinctAgentMemory(db, { limit: 5 });
  assert.deepEqual(
    distinct.map((entry) => entry.id),
    ["m1", "m3"],
    "a routine entry repeated per day occupies one prompt slot",
  );
  assert.deepEqual(memoryReceipt(distinct).memory[1], {
    id: "m3",
    category: "prior_research",
    subject: "Dana prefers email over calls",
    sourceRunId: "run-7",
  });

  const corrected = await updateAgentMemory(
    db,
    "m3",
    { body: "Dana prefers text messages after 5pm", relevanceHorizon: "weekly" },
    "founder@example.com",
  );
  assert.equal(corrected.body, "Dana prefers text messages after 5pm");
  assert.ok(corrected.expires_at, "changing the horizon re-derives expiry");
  const correction = memory
    .rows("audit_log")
    .find((entry) => entry.action === "agent_memory.corrected");
  assert.equal(
    (correction?.before_state as Record<string, unknown>)?.body,
    "Dana prefers email over calls details",
    "the text a correction replaced stays in the audit log",
  );
  await assert.rejects(
    () => updateAgentMemory(db, "m3", {}, "founder@example.com"),
    /no memory change/i,
  );
  await assert.rejects(
    () => updateAgentMemory(db, "missing", { body: "x" }, "founder@example.com"),
    /not found/i,
  );

  await forgetAgentMemory(db, "m1", "founder@example.com");
  assert.ok(!memory.rows("agent_memory").some((entry) => entry.id === "m1"));
  assert.ok(
    memory.rows("audit_log").some((entry) => entry.action === "agent_memory.forgotten"),
    "a removal is recorded",
  );
  await assert.rejects(() => forgetAgentMemory(db, "m1", "founder@example.com"), /not found/i);

  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: ["review-scope", "distinct-prompt-memory", "run-receipt", "correct", "forget"],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
