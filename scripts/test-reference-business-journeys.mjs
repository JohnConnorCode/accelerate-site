import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const output = mkdtempSync(
  join(process.env.REFERENCE_JOURNEY_ROOT || tmpdir(), "accelerate-reference-journeys-"),
);
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  commitSha: git("rev-parse", "HEAD"),
  sourceTreeDirty: Boolean(git("status", "--porcelain", "--untracked-files=no")),
  environment: "local",
  output,
  status: "running",
  checks: [],
  journeys: {},
  limits: [
    "Controlled provider adapters; no real recipients or hosted provider proof.",
    "Native PostgreSQL proves database transactions and RLS; Auth delivery and PostgREST are outside this fixture.",
    "Elapsed times measure local automated checks, not production latency or human setup time.",
  ],
};
const checks = [
  ["test:gmail-draft-provider", ["AC1", "AC2", "AC3", "AC5"]],
  ["test:gmail-followup-workflow", ["AC1", "AC3"]],
  ["test:business-workflows", ["AC1", "AC2", "AC3", "AC5"]],
  ["test:stripe-workflow", ["AC1", "AC2", "AC3", "AC5"]],
  ["test:collections-reminders", ["AC3"]],
  ["test:collections-agent-tools", ["AC2", "AC3"]],
  ["test:runtime-record-permission-contract", ["AC3"]],
  ["test:first-value-business-journey", ["AC4", "AC6"]],
  ["test:collections-lifecycle", ["AC1", "AC2", "AC3", "AC5"]],
];
function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", command], {
      stdio: "inherit",
      env: {
        ...process.env,
        REFERENCE_JOURNEY_OUTPUT: output,
        COLLECTIONS_REMINDER_POSTGRES_PROOF: "1",
      },
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}
try {
  report.postgresVersion = execFileSync("pg_config", ["--version"], { encoding: "utf8" }).trim();
  assert.ok(
    Number(report.postgresVersion.match(/PostgreSQL (\d+)/)?.[1]) >= 15,
    "PostgreSQL 15 or newer is required; put its binaries on PATH",
  );
  for (const [command, acceptanceIds] of checks) {
    const start = performance.now(),
      startedAt = new Date().toISOString();
    const exitCode = await run(command);
    report.checks.push({
      command: `npm run ${command}`,
      acceptanceIds,
      startedAt,
      finishedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - start),
      exitCode,
      status: exitCode === 0 ? "passed" : "failed",
    });
    assert.equal(exitCode, 0, command);
  }
  for (const journey of ["sales", "onboarding", "invoice", "collections", "first-use"]) {
    const artifact = resolve(output, `${journey}.json`);
    assert.ok(existsSync(artifact), `Missing ${journey} evidence`);
    report.journeys[journey] = JSON.parse(readFileSync(artifact, "utf8"));
  }
  assert.equal(
    report.journeys.invoice.creationActionId,
    report.journeys.collections.creationActionId,
  );
  assert.equal(report.journeys.sales.workItem.status, "completed");
  assert.equal(report.journeys.onboarding.task.status, "completed");
  assert.equal(report.journeys.collections.finalCase.status, "settled");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = String(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(`Reference journey evidence: ${join(output, "report.json")}`);
}
