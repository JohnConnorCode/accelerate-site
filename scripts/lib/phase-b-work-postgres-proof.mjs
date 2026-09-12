import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";

/** Real processes, actual work service, native PostgreSQL and a durable effect. */
export async function provePhaseBWork({ sql, args, context, a }) {
  sql(`UPDATE tenants SET status='active';
    CREATE TABLE audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid DEFAULT private.authorized_request_tenant_id(),actor_email text,action text,entity_type text,entity_id text,source text,before_state jsonb,after_state jsonb,metadata jsonb,created_at timestamptz);
    CREATE TABLE activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid DEFAULT private.authorized_request_tenant_id(),activity_type text,title text,summary text,contact_id uuid,company_id uuid,opportunity_id uuid,conversation_id uuid,proposal_id uuid,campaign_id uuid,source text,actor_email text,external_id text,metadata jsonb,occurred_at timestamptz,created_at timestamptz DEFAULT now(),UNIQUE(tenant_id,source,external_id));
    GRANT ALL ON audit_log,activities TO service_role;
    INSERT INTO budget_limits(tenant_id,coworker_id,budget_kind,limit_value,period) VALUES('${a}','sales','vendor_api_calls',100,'daily');`);
  const children = new Set();
  function worker(kind, mode) {
    const child = fork(new URL("./phase-b-work-worker.mjs", import.meta.url), [], {
      execArgv: ["--conditions=react-server", "--import", "tsx"],
      env: {
        ...process.env,
        PHASE_B_WORK_FIXTURE: JSON.stringify({ args, context: context(), kind, mode }),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    children.add(child);
    const messages = [],
      waiters = [];
    let stderr = "";
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.stdout.resume();
    child.on("message", (message) => {
      messages.push(message);
      for (const wake of [...waiters]) wake();
    });
    const exited = new Promise((resolve) =>
      child.once("exit", (code, signal) => {
        children.delete(child);
        resolve({ code, signal, stderr });
        for (const wake of [...waiters]) wake();
      }),
    );
    const wait = (event) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => finish(new Error(`Worker ${event} timed out: ${stderr}`)),
          30_000,
        );
        function finish(error, message) {
          clearTimeout(timer);
          const index = waiters.indexOf(check);
          if (index >= 0) waiters.splice(index, 1);
          if (error) reject(error);
          else resolve(message);
        }
        function check() {
          const message = messages.find((entry) => entry.event === event);
          if (message) finish(null, message);
          else if (child.exitCode !== null || child.signalCode !== null)
            finish(new Error(`Worker exited before ${event}: ${stderr}`));
        }
        waiters.push(check);
        check();
      });
    return { child, exited, wait };
  }
  const seed = (kind, max = 3) => {
    const id = randomUUID();
    sql(
      `INSERT INTO work_items(id,tenant_id,kind,objective,reason,source,max_attempts) VALUES('${id}','${a}','${kind}','Controlled interruption proof','Verify persisted recovery','phase-b-proof',${max});`,
    );
    return id;
  };
  const state = (id) => JSON.parse(sql(`SELECT to_jsonb(w) FROM work_items w WHERE id='${id}'`));
  async function execute(kind, mode) {
    const w = worker(kind, mode);
    await w.wait("ready");
    w.child.send("go");
    const { result } = await w.wait("result");
    const end = await w.exited;
    assert.equal(end.code, 0, end.stderr);
    assert.deepEqual(result.errors, []);
    return result;
  }
  try {
    const id = seed("phase_b_interrupt");
    const original = worker("phase_b_interrupt", "interrupt");
    const contender = worker("phase_b_interrupt", "complete");
    // Both native workers are alive and parked at the same explicit barrier.
    await Promise.all([original.wait("ready"), contender.wait("ready")]);
    original.child.send("go");
    const effect = await original.wait("effect");
    assert.equal(effect.replayed, false);
    contender.child.send("go");
    const losing = await contender.wait("result");
    assert.equal(
      losing.result.claimed,
      false,
      "a concurrent live process cannot acquire the held claim",
    );
    assert.equal((await contender.exited).code, 0);
    assert.equal(state(id).status, "in_progress");
    assert.equal(
      sql(
        `SELECT count(*) FROM audit_log WHERE entity_id='${id}' AND action='work_item.completed'`,
      ),
      "0",
    );
    original.child.kill("SIGKILL");
    assert.equal((await original.exited).signal, "SIGKILL");
    // Honor the real supported minimum lease. No fixture UPDATE expires it.
    const remaining = Math.max(0, Date.parse(effect.leaseExpiresAt) - Date.now() + 50);
    await new Promise((resolve) => setTimeout(resolve, remaining));
    const recovered = await execute("phase_b_interrupt", "complete");
    assert.equal(recovered.recoveredStale, true);
    assert.equal(recovered.persisted, true);
    assert.equal(recovered.status, "completed", JSON.stringify(recovered));
    assert.equal(recovered.value.value.replayed, true);
    assert.equal(state(id).status, "completed");
    assert.equal(state(id).attempt_count, 2);
    assert.equal(
      sql(`SELECT count(*) FROM budget_receipts WHERE operation_key='phase-b:${id}'`),
      "1",
    );
    assert.equal(
      sql(
        `SELECT count(*) FROM audit_log WHERE entity_id='${id}' AND action='work_item.completed'`,
      ),
      "1",
    );
    assert.equal(
      sql(`SELECT count(*) FROM activities WHERE external_id='work_item:${id}:completed'`),
      "1",
    );
    assert.equal((await execute("phase_b_interrupt", "complete")).claimed, false);
    for (const [kind, mode, max, expected] of [
      ["phase_b_defer", "defer", 3, "waiting"],
      ["phase_b_retry", "fail", 3, "pending"],
      ["phase_b_exhausted", "fail", 1, "failed"],
    ]) {
      const other = seed(kind, max);
      const result = await execute(kind, mode);
      assert.equal(result.persisted, true);
      const row = state(other);
      assert.equal(row.status, expected);
      assert.match(row.outcome, /Controlled/);
      if (expected !== "failed") {
        assert.ok(Date.parse(row.next_check_at) > Date.now());
        assert.equal((await execute(kind, mode)).claimed, false);
      } else assert.ok(row.finished_at);
      assert.equal(sql(`SELECT count(*) FROM audit_log WHERE entity_id='${other}'`), "1");
    }
    return [
      "live-worker-contention-barrier",
      "SIGKILL-after-durable-effect",
      "natural-lease-expiry",
      "supported-service-recovery-single-effect",
      "durable-defer-retry-exhaustion-receipts",
    ];
  } finally {
    for (const child of children) child.kill("SIGKILL");
  }
}
