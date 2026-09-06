import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

/** Executes real reservation RPCs in the native two-tenant runtime fixture. */
export async function proveModelBudgets({ sql, asyncSql, context, a, b }) {
  const config = JSON.stringify({ modules: { "opportunity-radar": true } });
  sql(
    `UPDATE tenants SET status='active',config='${config}'; DELETE FROM budget_limits; DELETE FROM budget_receipts; DELETE FROM budget_usage;`,
  );
  const reserve = (operation, cache = "a".repeat(64), cost = 0.02, daily = 0.04, calls = 2) =>
    `SELECT reserve_model_call('opportunity-radar','${operation}','${cache}','fixture/low',${cost},2000,500,${calls},${daily},0.03,'${config}',null)`;
  const settle = (
    id,
    state = "completed",
    usage = '{"cost":0.01}',
    model = "fixture/low",
    generation = `gen-${id}`,
  ) =>
    `SELECT complete_model_call('${id}','${state}','${model}','${generation}','${usage}','{"observations":[]}',null)`;
  const read = (query, tenant = a) => JSON.parse(sql(`${context(tenant)} ${query}`));
  const key = randomUUID();
  const competing = await Promise.all(
    [key, randomUUID()].map((operation) =>
      asyncSql(`${context()} BEGIN; ${reserve(operation)}; SELECT pg_sleep(0.02); COMMIT;`),
    ),
  );
  const admitted = competing.map((output) => JSON.parse(output.split("\n")[0]));
  assert.deepEqual(admitted.map((item) => item.status).sort(), ["deferred", "reserved"]);
  const first = admitted.find((item) => item.status === "reserved").receipt;
  assert.equal(sql(`SELECT count(*) FROM budget_receipts WHERE tenant_id='${a}'`), "2");
  assert.equal(read(reserve(first.operation_key)).status, "deferred");
  assert.throws(() => read(reserve(first.operation_key, "b".repeat(64))), /identity conflict/);
  assert.throws(() => read(settle(first.id), b), /unavailable/);
  assert.equal(read(settle(first.id)).state, "completed");
  assert.equal(read(settle(first.id)).state, "completed");
  assert.equal(sql(`SELECT count(*) FROM model_call_events WHERE receipt_id='${first.id}'`), "2");
  assert.equal(read(reserve(randomUUID())).status, "cached");
  assert.equal(sql(`SELECT count(*) FROM budget_receipts WHERE tenant_id='${a}'`), "2");
  const second = read(reserve(randomUUID(), "b".repeat(64))).receipt;
  assert.equal(read(settle(second.id, "uncertain", "{}")).state, "uncertain");
  assert.equal(read(reserve(randomUUID(), "c".repeat(64))).status, "deferred");
  assert.throws(
    () => read(settle(second.id, "failed", '{"cost":0.01}', "fixture/other")),
    /stored provider/,
  );
  assert.equal(read(settle(second.id, "failed", '{"cost":0.01}')).state, "failed");
  assert.equal(
    read(reserve(randomUUID(), "c".repeat(64))).status,
    "deferred",
    "call cap includes failed requests",
  );
  const other = read(reserve(randomUUID()), b);
  assert.equal(other.status, "reserved", "tenant cache and daily caps must be isolated");
  assert.equal(read(settle(other.receipt.id, "completed", '{"cost":0.05}'), b).state, "failed");
  assert.equal(
    sql(`SELECT used_value FROM budget_usage WHERE tenant_id='${b}' AND budget_kind='model_spend'`),
    "0.05",
  );
  read(settle(other.receipt.id, "completed", '{"cost":0.05}'), b);
  assert.equal(
    sql(
      `SELECT count(*) FROM budget_receipts WHERE tenant_id='${b}' AND operation_key LIKE 'model-overrun:%'`,
    ),
    "1",
  );
  assert.equal(
    read(reserve(randomUUID(), "c".repeat(64), 0.01, 0.05), b).status,
    "deferred",
    "actual overrun consumes the daily limit",
  );
  sql(`UPDATE tenants SET config='{}' WHERE id='${a}';`);
  assert.equal(read(reserve(randomUUID())).status, "deferred");
  sql(
    `UPDATE tenants SET config='${config}' WHERE id='${a}'; INSERT INTO budget_limits(tenant_id,coworker_id,budget_kind,limit_value,period) VALUES('${a}','*','vendor_api_calls',2,'daily');`,
  );
  const before = sql(
    `SELECT used_value FROM budget_usage WHERE tenant_id='${a}' AND budget_kind='model_spend'`,
  );
  assert.throws(
    () => read(reserve(randomUUID(), "d".repeat(64), 0.01, 0.1, 10)),
    /Budget exhausted/,
  );
  assert.equal(
    sql(`SELECT used_value FROM budget_usage WHERE tenant_id='${a}' AND budget_kind='model_spend'`),
    before,
    "request quota refusal rolls back spend reservation",
  );
  assert.throws(
    () => read(reserve(randomUUID()).replace(",2000,500,", ",NULL,500,")),
    /Invalid model reservation/,
  );
  assert.throws(
    () =>
      sql(
        `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; ${reserve(randomUUID())}`,
      ),
    /permission denied/,
  );
  sql(
    `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.sub='${a}'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT count(*) FROM model_call_receipts WHERE tenant_id='${b}';`,
  );
  assert.equal(
    sql(
      `SET request.headers='{"x-tenant-id":"${a}"}'; SET request.jwt.claim.sub='${a}'; SET request.jwt.claim.role='authenticated'; SET ROLE authenticated; SELECT count(*) FROM model_call_receipts WHERE tenant_id='${b}';`,
    ),
    "0",
  );
  return [
    "model-concurrent-admission",
    "model-atomic-dual-quota",
    "model-cache-and-replay",
    "model-unknown-cost-reconciliation",
    "model-overrun-accounting",
    "model-config-and-tenant-isolation",
  ];
}
