import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mutateWorkBoard, type WorkActor } from "../src/lib/revenue-os/work-board";
const port = process.env.WORK_TEST_PG_PORT;
if (!port || !/^\d+$/.test(port)) throw new Error("Use isolated PostgreSQL runner");
const database = process.env.WORK_TEST_PG_DATABASE;
if (!database || !/^[a-z0-9_]+$/.test(database))
  throw new Error("Use isolated PostgreSQL runner database");
const exec = promisify(execFile);
const lit = (v: unknown) => (v === null ? "NULL" : `'${String(v).replaceAll("'", "''")}'`);
async function sql(query: string) {
  const { stdout } = await exec("psql", [
    "-X",
    "-h",
    "127.0.0.1",
    "-p",
    port!,
    "-U",
    "postgres",
    "-d",
    database!,
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
const db = {
  rpc: async (name: string, p: Record<string, unknown>) => {
    const values = [
      p.p_actor,
      p.p_operation,
      p.p_id,
      p.p_expected_revision,
      p.p_request_key,
      p.p_request_hash,
      JSON.stringify(p.p_payload),
      `{${(p.p_projects as string[]).join(",")}}`,
      p.p_reviewer,
    ];
    try {
      return {
        data: JSON.parse(await sql(`SELECT public.${name}(${values.map(lit).join(",")})`)),
        error: null,
      };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message, code: "PT409" } };
    }
  },
} as unknown as SupabaseClient;
const worker: WorkActor = {
  id: "worker:a",
  projects: ["test"],
  scopes: ["*"],
  reviewer: false,
  capabilities: ["code"],
};
const other = { ...worker, id: "worker:b" };
const operator = { ...worker, id: "operator", reviewer: true };
let passed = 0;
async function reject(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, pattern);
  passed++;
}
async function call(
  operation: string,
  id?: string,
  payload: Record<string, unknown> = {},
  revision?: number,
  actor = worker,
  key = randomUUID(),
) {
  return mutateWorkBoard(db, actor, { operation, id, payload, revision, requestKey: key });
}
const base = "a".repeat(40),
  token = "A".repeat(43),
  successorToken = "B".repeat(43);
async function create() {
  return (
    await call("create", undefined, {
      project_key: "test",
      title: "Recovery scenario",
      description: "Recover a stopped worker",
      acceptance_criteria: "Preserve its work",
      work_kind: "operations",
      work_spec: {
        requiredCapabilities: ["code"],
        repository: { url: "https://example.test/repo", baseBranch: "main", baseCommit: base },
      },
    })
  ).card;
}
async function main() {
  const c = await create();
  let r = await call("claim", c.id, { claimToken: token });
  assert.ok(r.card.work_attempt_id);
  passed++;
  const firstAttempt = r.card.work_attempt_id;
  await reject(
    call(
      "recovery-policy",
      c.id,
      { enabled: true, message: "Enable controlled recovery" },
      r.card.revision,
    ),
    /operator authority/,
  );
  r = await call(
    "recovery-policy",
    c.id,
    { enabled: true, message: "Enable controlled recovery" },
    r.card.revision,
    operator,
  );
  const checkpoint = {
    commitSha: "b".repeat(40),
    baseCommit: base,
    branch: `agent/checkpoints/${c.id}/${firstAttempt}/${randomUUID()}`,
    summary: "Partial implementation checkpoint",
    completed: ["source saved"],
    remaining: ["verification"],
    artifacts: [],
  };
  await reject(call("checkpoint", c.id, { claimToken: token, checkpoint }), /Revision required/);
  r = await call("checkpoint", c.id, { claimToken: token, checkpoint }, r.card.revision);
  assert.equal(r.card.work_checkpoint.attemptId, firstAttempt);
  passed++;
  await reject(
    call("resume", c.id, { claimToken: successorToken }, r.card.revision, other),
    /expired execution lease/,
  );
  await sql(
    `UPDATE feature_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${lit(c.id)}`,
  );
  let rev = Number(await sql(`SELECT revision FROM feature_requests WHERE id=${lit(c.id)}`));
  await reject(
    call("resume", c.id, { claimToken: successorToken }, rev, { ...other, capabilities: [] }),
    /lacks required capabilities/,
  );
  await reject(
    call("resume", c.id, { claimToken: successorToken }, rev, { ...other, projects: ["other"] }),
    /Project denied/,
  );
  await reject(call("resume", c.id, { claimToken: token }, rev, other), /rotate/);
  const key = randomUUID(),
    racingKey = randomUUID();
  const outcomes = await Promise.allSettled([
    call("resume", c.id, { claimToken: successorToken }, rev, other, key),
    call(
      "resume",
      c.id,
      { claimToken: "C".repeat(43) },
      rev,
      { ...worker, id: "worker:c" },
      racingKey,
    ),
  ]);
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  passed++;
  // Whichever racer won fences the predecessor; retry the winner's exact request below when B won.
  const winner = outcomes.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<
    Awaited<ReturnType<typeof call>>
  >;
  r = winner.value;
  assert.notEqual(r.card.work_attempt_id, firstAttempt);
  passed++;
  const bWon = outcomes[0].status === "fulfilled";
  const replay = await call(
    "resume",
    c.id,
    { claimToken: bWon ? successorToken : "C".repeat(43) },
    rev,
    bWon ? other : { ...worker, id: "worker:c" },
    bWon ? key : racingKey,
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.card.work_attempt_id, r.card.work_attempt_id);
  passed++;
  for (const op of ["heartbeat", "progress", "release", "submit", "checkpoint"])
    await reject(
      call(
        op,
        c.id,
        {
          claimToken: token,
          ...(op === "progress" ? { message: "Stale agent progress" } : {}),
          ...(op === "submit"
            ? {
                evidence: {
                  summary: "Stale agent submission",
                  checks: [{ name: "test", status: "passed", evidence: "stale" }],
                },
              }
            : {}),
          ...(op === "checkpoint" ? { checkpoint } : {}),
        },
        r.card.revision,
      ),
      /does not own/,
    );
  assert.equal(
    await sql(
      `SELECT predecessor_id FROM work_board_attempts WHERE id=${lit(r.card.work_attempt_id)}`,
    ),
    firstAttempt,
  );
  passed++;
  const missing = await create();
  await call("claim", missing.id, { claimToken: token });
  await sql(
    `UPDATE feature_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${lit(missing.id)}`,
  );
  rev = Number(await sql(`SELECT revision FROM feature_requests WHERE id=${lit(missing.id)}`));
  await reject(
    call("resume", missing.id, { claimToken: successorToken }, rev, other),
    /Missing checkpoint/,
  );
  // A third attempt cannot reuse the first token, even under the same credential identity.
  const winnerActor = bWon ? other : { ...worker, id: "worker:c" };
  const winnerToken = bWon ? successorToken : "C".repeat(43);
  await sql(
    `UPDATE feature_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${lit(c.id)}`,
  );
  const thirdRev = Number(await sql(`SELECT revision FROM feature_requests WHERE id=${lit(c.id)}`));
  await reject(call("resume", c.id, { claimToken: token }, thirdRev, worker), /rotate/);
  const third = await call("resume", c.id, { claimToken: "D".repeat(43) }, thirdRev, worker);
  await reject(
    call("heartbeat", c.id, { claimToken: token }, third.card.revision, worker),
    /does not own/,
  );
  await reject(
    call("heartbeat", c.id, { claimToken: winnerToken }, third.card.revision, winnerActor),
    /does not own/,
  );
  await reject(
    call(
      "checkpoint",
      c.id,
      { claimToken: "D".repeat(43), checkpoint },
      third.card.revision,
      worker,
    ),
    /this card and attempt/,
  );
  await reject(
    call(
      "checkpoint",
      c.id,
      {
        claimToken: "D".repeat(43),
        checkpoint: {
          ...checkpoint,
          branch: `agent/checkpoints/${randomUUID()}/${third.card.work_attempt_id}/${randomUUID()}`,
        },
      },
      third.card.revision,
      worker,
    ),
    /this card/,
  );
  assert.equal(
    await sql(
      `SELECT count(*) FROM work_board_attempts WHERE card_id=${lit(c.id)} AND claim_token_hash IS NOT NULL`,
    ),
    "3",
  );
  passed++;
  assert.equal(
    await sql(
      `SELECT count(*) FROM work_board_events WHERE payload::text LIKE '%claim_token_hash%'`,
    ),
    "0",
  );
  passed++;
  // Legacy claims adopt a durable attempt before checkpoint publication.
  const legacy = await create();
  await sql(
    `UPDATE feature_requests SET status='in_progress',lease_owner='worker:a',claim_token_hash=${lit("unused")},lease_expires_at=clock_timestamp()+interval '30 minutes' WHERE id=${lit(legacy.id)}`,
  );
  await sql(
    `UPDATE feature_requests SET claim_token_hash=${lit((await import("../src/lib/revenue-os/work-board")).digest(token))} WHERE id=${lit(legacy.id)}`,
  );
  rev = Number(await sql(`SELECT revision FROM feature_requests WHERE id=${lit(legacy.id)}`));
  let adopted = await call("heartbeat", legacy.id, { claimToken: token });
  const legacyCheckpoint = {
    ...checkpoint,
    branch: `agent/checkpoints/${legacy.id}/${adopted.card.work_attempt_id}/${randomUUID()}`,
  };
  adopted = await call(
    "checkpoint",
    legacy.id,
    { claimToken: token, checkpoint: legacyCheckpoint },
    adopted.card.revision,
  );
  assert.ok(adopted.card.work_attempt_id);
  passed++;
  await reject(
    call(
      "checkpoint",
      legacy.id,
      { claimToken: token, checkpoint: { ...legacyCheckpoint, baseCommit: "c".repeat(40) } },
      adopted.card.revision,
    ),
    /Invalid checkpoint source/,
  );
  adopted = await call(
    "recovery-policy",
    legacy.id,
    { enabled: false, message: "Disable controlled recovery" },
    adopted.card.revision,
    operator,
  );
  await sql(
    `UPDATE feature_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${lit(legacy.id)}`,
  );
  rev = Number(await sql(`SELECT revision FROM feature_requests WHERE id=${lit(legacy.id)}`));
  await reject(
    call("resume", legacy.id, { claimToken: successorToken }, rev, other),
    /recovery is disabled/,
  );
  // Explicit continuation works with policy disabled and no checkpoint, but
  // the predecessor is adopted and fenced. No automatic fallback is permitted.
  const uncheckpointed = await create();
  const { digest } = await import("../src/lib/revenue-os/work-board");
  await sql(
    `UPDATE feature_requests SET status='in_progress',lease_owner='worker:a',claim_token_hash=${lit(digest(token))},lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=${lit(uncheckpointed.id)}`,
  );
  const expiredRevision = Number(
    await sql(`SELECT revision FROM feature_requests WHERE id=${lit(uncheckpointed.id)}`),
  );
  await reject(
    call("claim", uncheckpointed.id, { claimToken: successorToken }, expiredRevision - 1, other),
    /Revision conflict/,
  );
  await reject(
    call("claim", uncheckpointed.id, { claimToken: successorToken }, undefined, other),
    /Revision conflict/,
  );
  const continued = await call(
    "claim",
    uncheckpointed.id,
    { claimToken: successorToken },
    expiredRevision,
    other,
  );
  assert.ok(continued.card.work_attempt_id);
  assert.equal(
    await sql(`SELECT count(*) FROM work_board_attempts WHERE card_id=${lit(uncheckpointed.id)}`),
    "2",
  );
  assert.equal(
    await sql(
      `SELECT count(*) FROM work_board_attempts successor JOIN work_board_attempts predecessor ON predecessor.id=successor.predecessor_id WHERE successor.card_id=${lit(uncheckpointed.id)} AND predecessor.ended_at IS NOT NULL AND predecessor.claim_token_hash=${lit(digest(token))}`,
    ),
    "1",
  );
  assert.equal(continued.card.work_checkpoint, null);
  passed++;
  await reject(call("heartbeat", uncheckpointed.id, { claimToken: token }), /does not own|expired/);
  await reject(
    call("claim", uncheckpointed.id, { claimToken: "C".repeat(43) }, continued.card.revision),
    /Not ready/,
  );
  // Work volume is advisory: a seventh active claim is still admitted.
  await sql(
    `UPDATE feature_requests SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE status='in_progress'`,
  );
  for (let i = 0; i < 6; i++) {
    const row = await create();
    await call("claim", row.id, { claimToken: token });
  }
  const overflow = await create();
  assert.equal(
    (await call("claim", overflow.id, { claimToken: token })).card.status,
    "in_progress",
  );
  passed++;
  assert.equal(await sql(`SELECT count(*) FROM work_board_events WHERE operation='resume'`), "2");
  passed++;
  assert.equal(
    await sql(`SELECT has_table_privilege('authenticated','work_board_attempts','SELECT')`),
    "f",
  );
  passed++;
  assert.equal(
    await sql(
      `SELECT has_function_privilege('anon','mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean)','EXECUTE')`,
    ),
    "f",
  );
  passed++;
  console.log(
    JSON.stringify({
      passed,
      scenarios: [
        "atomic expiry takeover",
        "idempotency",
        "token fencing",
        "revision",
        "capabilities",
        "project scope",
        "operator policy",
        "checkpoint preservation",
        "missing checkpoint",
        "advisory work volume",
        "explicit legacy expired continuation",
        "restricted SQL privileges",
        "idempotent migration",
      ],
    }),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
