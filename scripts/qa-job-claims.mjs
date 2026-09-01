import { randomUUID } from "node:crypto";
import { runPsql } from "./lib/accelerate-database.mjs";

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}
function query(sql) {
  const scopedSql = `SET LOCAL request.headers = '{"x-tenant-id":"acce1e8e-0000-4000-8000-000000000001"}'; SET LOCAL request.jwt.claim.role = 'service_role'; ${sql}`;
  const result = runPsql(["--single-transaction", "-q", "-t", "-A", "--command", scopedSql]);
  if (result.status !== 0)
    throw new Error((result.stderr || result.stdout || "Database query failed").trim());
  return result.stdout.trim();
}
function claim(jobKey, claimKey = null) {
  const output = query(
    `SELECT json_build_object('run_id', run_id, 'claimed', claimed, 'existing_status', existing_status) FROM public.claim_revenue_job_run(${sqlLiteral(jobKey)}, ${claimKey ? sqlLiteral(claimKey) : "NULL"});`,
  );
  return JSON.parse(output);
}

const prefix = `qa-job-claim-${randomUUID()}`;
try {
  const first = claim(`${prefix}-active`);
  if (!first.claimed || first.existing_status !== "running")
    throw new Error("First job claim was not acquired");
  const duplicate = claim(`${prefix}-active`);
  if (
    duplicate.claimed ||
    duplicate.run_id !== first.run_id ||
    duplicate.existing_status !== "running"
  )
    throw new Error("Concurrent duplicate did not safely return the active claim");

  query(
    `UPDATE public.job_runs SET status = 'success', finished_at = now() WHERE id = ${sqlLiteral(first.run_id)}::uuid`,
  );
  const idempotencyKey = `${prefix}:replay`;
  const replayFirst = claim(`${prefix}-replay`, idempotencyKey);
  if (!replayFirst.claimed) throw new Error("Initial idempotent job claim was not acquired");
  query(
    `UPDATE public.job_runs SET status = 'success', finished_at = now() WHERE id = ${sqlLiteral(replayFirst.run_id)}::uuid`,
  );
  const replayDuplicate = claim(`${prefix}-replay`, idempotencyKey);
  if (
    replayDuplicate.claimed ||
    replayDuplicate.run_id !== replayFirst.run_id ||
    replayDuplicate.existing_status !== "success"
  )
    throw new Error("Idempotent replay did not return the completed receipt");

  console.log(
    JSON.stringify({
      activeClaim: first.run_id,
      replayClaim: replayFirst.run_id,
      result: "atomic claim and replay receipt passed",
    }),
  );
} finally {
  query(`DELETE FROM public.job_runs WHERE job_key LIKE ${sqlLiteral(`${prefix}%`)}`);
}
