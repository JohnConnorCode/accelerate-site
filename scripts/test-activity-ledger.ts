#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ACTIVITY_LEDGER_CONTRACT, loadActivityTimeline, recordActivity } from "../src/lib/revenue-os/activities";

type Row = Record<string, unknown>;

function activityStore() {
  const rows: Row[] = [];
  let failInsert = false;
  const matches = (row: Row, filters: Array<[string, unknown]>) => filters.every(([key, value]) => row[key] === value);
  const from = (table: string) => {
    assert.equal(table, "activities");
    const filters: Array<[string, unknown]> = [];
    let inserted: Row | null = null;
    let before: string | null = null;
    let take = 50;
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      lt: (_key: string, value: string) => { before = value; return builder; },
      insert: (row: Row) => { inserted = row; return builder; },
      order: () => builder,
      limit: (value: number) => { take = value; return Promise.resolve({ data: rows.filter((row) => matches(row, filters) && (!before || String(row.occurred_at) < before)).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)) || String(b.id).localeCompare(String(a.id))).slice(0, take), error: null }); },
      maybeSingle: async () => ({ data: rows.find((row) => matches(row, filters)) ?? null, error: null }),
      single: async () => {
        if (!inserted) return { data: null, error: { message: "No insert" } };
        if (failInsert) return { data: null, error: { message: "database unavailable" } };
        const duplicate = rows.find((row) => row.source === inserted?.source && row.external_id === inserted?.external_id);
        if (duplicate) return { data: null, error: { message: "duplicate", code: "23505" } };
        const row = { id: `activity-${rows.length + 1}`, created_at: new Date().toISOString(), ...inserted };
        rows.push(row);
        return { data: row, error: null };
      },
    };
    return builder;
  };
  return { client: { from } as never, rows, setFailInsert(value: boolean) { failInsert = value; } };
}

async function main() {
  assert.equal(ACTIVITY_LEDGER_CONTRACT, "revenue-os-activity-ledger.v1");
  const store = activityStore();
  const base = { activityType: "task_created", title: "Task created: confirm owner", source: "admin", externalId: "task:1:created", opportunityId: "opp-1", occurredAt: "2026-08-23T12:00:00.000Z", metadata: { task_id: "1" } };
  const first = await recordActivity(store.client, base);
  assert.equal(first.duplicate, false);
  assert.equal(store.rows.length, 1);
  const replay = await recordActivity(store.client, { ...base, title: "A retry must not rewrite history" });
  assert.equal(replay.duplicate, true);
  assert.equal(replay.activity.title, base.title);
  assert.equal(store.rows.length, 1);

  await recordActivity(store.client, { ...base, activityType: "founder_note", title: "Older note", externalId: "note:older", occurredAt: "2026-08-22T12:00:00.000Z" });
  await recordActivity(store.client, { ...base, activityType: "email_sent", title: "Newer email", externalId: "email:newer", occurredAt: "2026-08-24T12:00:00.000Z" });
  const timeline = await loadActivityTimeline(store.client, { opportunityId: "opp-1", limit: 2 });
  assert.deepEqual(timeline.map((row) => row.title), ["Newer email", base.title]);
  const older = await loadActivityTimeline(store.client, { opportunityId: "opp-1", before: "2026-08-23T12:00:00.000Z" });
  assert.deepEqual(older.map((row) => row.title), ["Older note"]);

  await assert.rejects(recordActivity(store.client, { ...base, activityType: "Bad Type", externalId: "bad:type" }), /snake_case/);
  await assert.rejects(recordActivity(store.client, { ...base, title: "", externalId: "bad:title" }), /title is required/);
  await assert.rejects(recordActivity(store.client, { ...base, externalId: "" }), /external ID is required/);
  await assert.rejects(loadActivityTimeline(store.client, {}), /canonical record ID/);
  await assert.rejects(loadActivityTimeline(store.client, { opportunityId: "opp-1", before: "not-a-date" }), /cursor is invalid/);

  const failed = activityStore();
  failed.setFailInsert(true);
  await assert.rejects(recordActivity(failed.client, base), /database unavailable/);
  assert.equal(failed.rows.length, 0);

  const sourceFiles: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(path);
    }
  };
  walk("src");
  const directWriters = sourceFiles.filter((path) => path !== "src/lib/revenue-os/activities.ts" && /from\(["']activities["']\)\.insert\(/.test(readFileSync(path, "utf8")));
  assert.deepEqual(directWriters, [], "all activity receipts must use the authoritative ledger writer");
  assert.match(readFileSync("src/app/api/admin/contacts/timeline/route.ts", "utf8"), /loadActivityTimeline/, "record timelines must use the canonical ordered reader");
  assert.match(readFileSync("src/lib/revenue-os/ai-tools.ts", "utf8"), /get_record_timeline[\s\S]*loadActivityTimeline/, "AI record context must use the same canonical ordered reader");
  const activityRoute = readFileSync("src/app/api/admin/revenue-os/activity/route.ts", "utf8");
  assert.match(activityRoute, /requireAdmin/, "the canonical activity API must remain founder-only");
  assert.match(activityRoute, /loadActivityTimeline/, "the canonical activity API must use the bounded ordered reader");

  console.log(JSON.stringify({ result: "passed", contract: ACTIVITY_LEDGER_CONTRACT, checks: ["validated normalization", "stable replay receipt", "concurrent-safe reread boundary", "ordered bounded timeline", "cursor validation", "database failure truth", "single writer ownership", "founder-only API", "record and AI reader parity"] }, null, 2));
}

main().catch((error) => { console.error(error); process.exit(1); });
