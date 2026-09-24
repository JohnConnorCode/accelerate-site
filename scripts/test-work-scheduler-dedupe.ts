#!/usr/bin/env tsx
/**
 * Pins two defects that filled production with ~1,000 failed work items a day:
 *
 *   - **Work was queued for coworkers that did not exist.** Coworkers are only
 *     created when the founder approves their bootstrap, but the scheduler
 *     queued their daily work regardless, and every item failed with
 *     "Coworker not found".
 *   - **Daily work re-ran every cycle.** Dedupe only matched open items, so as
 *     soon as today's item finished (or failed) the next 15-minute cycle
 *     created it again.
 */
import assert from "node:assert/strict";
import { scheduleDailyWork } from "../src/lib/revenue-os/work-scheduler";
import { createWorkItem } from "../src/lib/revenue-os/work-items";
import { bindTenantDatabaseForTest } from "../src/lib/supabase/server";
import { ACCELERATE_TENANT_ID } from "../src/lib/tenancy/context";

type Row = Record<string, unknown>;

/** In-memory Supabase stand-in that honours eq/in filters, which is all the
 * scheduler's dedupe and coworker lookups depend on. */
function memoryDatabase(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = { ...seed };
  let nextId = 1;

  function query(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let inserted: Row | null = null;
    let conflict = false;
    let single = false;
    let limit = Infinity;
    const self: Record<string, unknown> = {};
    const chain = () => self;
    for (const method of ["select", "order", "neq", "gte", "lt", "lte", "gt", "is", "not", "or"])
      self[method] = chain;
    self.eq = (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return self;
    };
    self.in = (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return self;
    };
    self.contains = chain;
    self.limit = (count: number) => {
      limit = count;
      return self;
    };
    self.maybeSingle = () => {
      single = true;
      return self;
    };
    self.single = self.maybeSingle;
    self.insert = (payload: Row) => {
      // Mirrors the partial unique index on pending action_queue dedupe keys.
      conflict =
        table === "action_queue" &&
        (tables[table] ?? []).some(
          (row) => row.status === "pending" && row.dedupe_key === payload.dedupe_key,
        );
      if (conflict) return self;
      inserted = { id: `row-${nextId++}`, status: "pending", ...payload };
      (tables[table] ??= []).push(inserted);
      return self;
    };
    self.update = chain;
    self.upsert = chain;
    self.then = (resolve: (result: { data: unknown; error: unknown }) => unknown) => {
      if (conflict)
        return resolve({ data: null, error: { code: "23505", message: "duplicate key" } });
      if (inserted) return resolve({ data: inserted, error: null });
      const rows = (tables[table] ?? []).filter((row) => filters.every((keep) => keep(row)));
      const limited = rows.slice(0, limit);
      return resolve({ data: single ? (limited[0] ?? null) : limited, error: null });
    };
    return self;
  }

  const client = bindTenantDatabaseForTest(
    { from: (table: string) => query(table) } as never,
    ACCELERATE_TENANT_ID,
  );
  return { client, tables };
}

async function main() {
  // ---- No coworkers bootstrapped: only non-coworker work is queued ---------
  const empty = memoryDatabase({ coworkers: [], work_items: [] });
  const summary = await scheduleDailyWork(empty.client);
  const kinds = (empty.tables.work_items ?? []).map((row) => row.kind);
  assert.deepEqual(
    kinds,
    ["proactive_intelligence_brief"],
    `only the non-coworker brief may be queued before any coworker is approved; got ${JSON.stringify(kinds)}`,
  );
  assert.equal(
    summary.skipped,
    9,
    "the nine coworker-owned daily jobs must be reported as skipped",
  );
  const proposals = (empty.tables.action_queue ?? []).map((row) => row.dedupe_key).sort();
  assert.deepEqual(
    proposals,
    [
      "bootstrap-coworker:business_pulse",
      "bootstrap-coworker:finance",
      "bootstrap-coworker:meeting_intel",
      "bootstrap-coworker:operations",
      "bootstrap-coworker:sales",
    ],
    "each missing coworker gets one approval request instead of a silent bootstrap",
  );
  assert.equal(empty.tables.coworkers!.length, 0, "no coworker is registered without approval");
  await scheduleDailyWork(empty.client);
  assert.equal(
    empty.tables.action_queue!.length,
    5,
    "a pending bootstrap approval is not proposed again on the next cycle",
  );

  // ---- An active coworker gets its work -----------------------------------
  const pulse = memoryDatabase({
    coworkers: [{ id: "business-pulse", status: "active", name: "Business Pulse" }],
    work_items: [],
  });
  await scheduleDailyWork(pulse.client);
  const pulseKinds = (pulse.tables.work_items ?? []).map((row) => row.kind).sort();
  assert.deepEqual(pulseKinds, [
    "daily_digest",
    "detect_stage_bottleneck",
    "detect_stale_deals",
    "detect_velocity_change",
    "proactive_intelligence_brief",
  ]);

  // ---- A finished period-keyed item blocks re-creation the same day -------
  const today = new Date().toISOString().slice(0, 10);
  for (const status of ["completed", "failed"]) {
    const db = memoryDatabase({
      coworkers: [],
      work_items: [
        {
          id: "done",
          kind: "proactive_intelligence_brief",
          status,
          dedupe_key: `proactive-intel:brief:${today}`,
        },
      ],
    });
    await scheduleDailyWork(db.client);
    assert.equal(
      db.tables.work_items!.length,
      1,
      `a ${status} daily item must not be re-created on the next cycle`,
    );
  }

  // ---- Event-keyed work still re-opens once the prior item finished --------
  const reopen = memoryDatabase({
    work_items: [{ id: "old", kind: "follow_up", status: "completed", dedupe_key: "follow:1" }],
  });
  const { deduplicated } = await createWorkItem(reopen.client, {
    kind: "follow_up",
    objective: "Follow up",
    reason: "Test",
    source: "test",
    dedupeKey: "follow:1",
    surfaceInInbox: false,
  });
  assert.equal(deduplicated, false, "open-only dedupe remains the default for event-keyed work");

  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks: [
          "inactive-coworkers-skipped",
          "missing-coworkers-proposed-once",
          "active-coworker-scheduled",
          "period-dedupe-across-statuses",
          "event-dedupe-open-only",
        ],
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
