import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemorySupabase } from "./lib/memory-supabase";
import { settleWorkItem, type WorkItem } from "../src/lib/revenue-os/work-items";
import { deferWork } from "../src/lib/revenue-os/work-result";
const port = process.env.WORK_TEST_PG_PORT;
if (!port || !/^\d+$/.test(port))
  throw new Error("Start through the isolated PostgreSQL test runner");
const exec = promisify(execFile);
const literal = (value: unknown): string =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const column = (value: string) => {
  if (!/^[a-z_]+$/.test(value)) throw new Error("Invalid test column");
  return `"${value}"`;
};
async function sql(query: string): Promise<string> {
  const { stdout } = await exec("psql", [
    "-X",
    "-h",
    "127.0.0.1",
    "-p",
    port!,
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-t",
    "-A",
    "-c",
    query,
  ]);
  return stdout.trim();
}
const memory = new MemorySupabase();
// Execute the production transition builder's filters against real PostgreSQL.
// Non-state ledgers stay in memory to assert they are not emitted on lost claims.
const client = {
  from(table: string) {
    if (table !== "work_items") return (memory.client as SupabaseClient).from(table);
    const filters: string[] = [];
    let changes: Record<string, unknown> = {};
    const query = {
      update(value: Record<string, unknown>) {
        changes = value;
        return query;
      },
      eq(name: string, value: unknown) {
        filters.push(`${column(name)} = ${literal(value)}`);
        return query;
      },
      gt(name: string, value: unknown) {
        filters.push(`${column(name)} > ${literal(value)}`);
        return query;
      },
      in(name: string, values: unknown[]) {
        filters.push(`${column(name)} IN (${values.map(literal).join(",")})`);
        return query;
      },
      select() {
        return query;
      },
      async maybeSingle() {
        const setters = Object.entries(changes)
          .map(([name, value]) => `${column(name)} = ${literal(value)}`)
          .join(",");
        const output = await sql(
          `WITH changed AS (UPDATE work_items SET ${setters} WHERE ${filters.join(" AND ")} RETURNING id) SELECT row_to_json(changed) FROM changed`,
        );
        return { data: output ? JSON.parse(output) : null, error: null };
      },
    };
    return query;
  },
} as unknown as SupabaseClient;
let sequence = 0;
async function claimed(): Promise<WorkItem> {
  const kind = `test_${++sequence}`;
  await sql(
    `INSERT INTO work_items (tenant_id,kind,objective,reason,source) VALUES (private.request_tenant_id(),${literal(kind)},'Test work','Fixture','test')`,
  );
  await sql(`SELECT * FROM claim_work_item(${literal(kind)},NULL,'worker-a',60000)`);
  return JSON.parse(
    await sql(`SELECT row_to_json(w) FROM work_items w WHERE kind=${literal(kind)}`),
  );
}
async function row(item: WorkItem) {
  return JSON.parse(
    await sql(`SELECT row_to_json(w) FROM work_items w WHERE id=${literal(item.id)}`),
  );
}
async function main() {
  const winner = await claimed();
  const races = await Promise.allSettled([
    settleWorkItem(client, winner, { status: "completed", outcome: "Finished once" }),
    settleWorkItem(client, winner, { status: "completed", outcome: "Duplicate" }),
  ]);
  assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(memory.rows("activities").length, 1);
  assert.equal((await row(winner)).status, "completed");
  for (const changes of [
    "status='cancelled'",
    "lease_owner='worker-b', attempt_count=2",
    "lease_expires_at=now()-interval '1 second'",
    "tenant_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'",
  ]) {
    const wi = await claimed();
    await sql(`UPDATE work_items SET ${changes} WHERE id=${literal(wi.id)}`);
    await assert.rejects(
      () => settleWorkItem(client, wi, { status: "completed", outcome: "Must not commit" }),
      /claim/,
    );
  }
  const wi = await claimed();
  await settleWorkItem(client, wi, deferWork("Connect Google"));
  assert.equal((await row(wi)).status, "waiting");
  assert.equal((await row(wi)).attempt_count, 0);
  const claim = JSON.parse(
    await sql(
      `SELECT row_to_json(c) FROM claim_work_item(${literal(wi.kind)},NULL,'worker-b',60000) c`,
    ),
  );
  assert.equal(claim.claimed, false);
  const failed = await claimed();
  await settleWorkItem(client, failed, {
    status: "partial",
    outcome: "Draft staged; remainder pending",
    artifacts: [{ type: "action", id: "proposal-1" }],
  });
  assert.equal((await row(failed)).status, "pending");
  assert.match((await row(failed)).outcome, /proposal-1/);
  assert.equal(memory.rows("activities").length, 1);
  console.log(
    JSON.stringify({
      result: "passed",
      cases: 8,
      database: "isolated PostgreSQL",
      concurrentCompletionWinners: 1,
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
