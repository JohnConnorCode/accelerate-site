import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { acquireLock, runHeavyJob } from "./resource-run.mjs";
import { readJson } from "./supervisor/state.mjs";
import { evaluatePressure } from "./supervisor/pressure.mjs";
import { pidOwned } from "./supervisor/identity.mjs";
import { processStartTime } from "./supervisor/identity.mjs";
import {
  cancelDisposable,
  grantAdmission,
  overloadTier,
  pauseSession,
  releaseAdmission,
  resumeSession,
  validateAdmission,
} from "./supervisor/policy.mjs";
import {
  completeSession,
  heartbeatSession,
  listSessions,
  recoverSession,
  registerSession,
} from "./supervisor/sessions.mjs";

// Every test here runs against synthetic processes and a scratch supervisor
// directory. Nothing in this file may signal, pause, or Mick-test a real
// agent runtime: sleepers are spawned by the test itself and reaped by it.
const GiB = 1024 ** 3;
let scratch = null;
let sleepers = [];

function useScratch() {
  scratch = mkdtempSync(join(tmpdir(), "accelerate-supervisor-test-"));
  process.env.ACCELERATE_SUPERVISOR_DIR = scratch;
}

afterEach(() => {
  for (const child of sleepers) {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
  sleepers = [];
  delete process.env.ACCELERATE_SUPERVISOR_DIR;
  delete process.env.ACCELERATE_ADMISSION_ID;
  if (scratch) rmSync(scratch, { recursive: true, force: true });
  scratch = null;
});

function spawnSleeper(seconds = 30) {
  const child = spawn("sleep", [String(seconds)], { stdio: "ignore" });
  sleepers.push(child);
  return child;
}

async function exited(child) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  await new Promise((resolve) => child.once("exit", resolve));
  return true;
}

function psState(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "state="], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
  } catch {
    return "";
  }
}

const THRESHOLDS = {
  memFreeRefusePct: 20,
  memFreeClearPct: 28,
  memFreeCriticalPct: 10,
  swapUsedRefusePct: 80,
  swapUsedClearPct: 70,
  swapUsedCriticalPct: 92,
  diskMinGiB: 5,
  diskClearGiB: 7,
};

test("machine queue admits one heavy job and readmits after release", () => {
  useScratch();
  const first = grantAdmission({ maxHeavyJobs: 1 });
  assert.ok(first.id);
  assert.throws(() => grantAdmission({ maxHeavyJobs: 1 }), /queue full/);
  releaseAdmission(first.id);
  const second = grantAdmission({ maxHeavyJobs: 1 });
  assert.ok(second.id);
  releaseAdmission(second.id);
});

test("expired and foreign admissions fail closed", () => {
  useScratch();
  const stale = grantAdmission({ ttlMs: -1 });
  assert.throws(() => validateAdmission(stale.id), /expired/);
  const grant = grantAdmission();
  assert.throws(() => validateAdmission("no-such-id"), /Unknown admission/);
  releaseAdmission(grant.id);
  assert.deepEqual(readJson("admissions.json", {}), {});
});

test("pressure hysteresis refuses, holds, and clears without flapping", () => {
  const refuse = { memFreePct: 15, swapUsedPct: 10, diskAvailGiB: 50 };
  const stillLow = { memFreePct: 25, swapUsedPct: 10, diskAvailGiB: 50 };
  const clear = { memFreePct: 35, swapUsedPct: 10, diskAvailGiB: 50 };
  assert.equal(evaluatePressure(refuse, THRESHOLDS).level, "elevated");
  assert.equal(evaluatePressure(stillLow, THRESHOLDS, "elevated").level, "elevated");
  assert.equal(evaluatePressure(clear, THRESHOLDS, "elevated").level, "normal");
  assert.equal(
    evaluatePressure({ memFreePct: null, swapUsedPct: null, diskAvailGiB: null }, THRESHOLDS).level,
    "elevated",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 5, swapUsedPct: 95, diskAvailGiB: 1 }, THRESHOLDS).level,
    "critical",
  );
  assert.deepEqual(overloadTier("normal"), ["admit"]);
  assert.deepEqual(overloadTier("elevated"), ["refuse-admissions", "pause-producers"]);
  assert.deepEqual(overloadTier("critical"), [
    "refuse-admissions",
    "pause-producers",
    "cancel-disposable",
  ]);
});

test("sessions register, heartbeat, complete, and refuse duplicate writers", () => {
  useScratch();
  const first = registerSession({
    provider: "synthetic",
    threadId: "thread-1",
    repo: "/tmp/repo-a",
    worktree: "/tmp/repo-a",
    task: "synthetic contention proof",
    pid: process.pid,
  });
  assert.equal(first.status, "running");
  assert.throws(
    () =>
      registerSession({
        provider: "synthetic",
        threadId: "thread-1",
        repo: "/tmp/repo-b",
        worktree: "/tmp/repo-b",
        task: "second writer",
        pid: process.pid,
      }),
    /duplicate writer/,
  );
  heartbeatSession(first.id);
  completeSession(first.id);
  const second = registerSession({
    provider: "synthetic",
    threadId: "thread-1",
    repo: "/tmp/repo-b",
    worktree: "/tmp/repo-b",
    task: "after completion",
    pid: process.pid,
  });
  assert.equal(second.status, "running");
  completeSession(second.id);
  const dead = recoverSession(first.id, { candidatePid: 1 << 22 });
  assert.equal(dead.recovered, false);
});

test("a reused PID is rejected before any signal", () => {
  const check = pidOwned(process.pid, "Mon Jan  1 00:00:00 1990");
  assert.equal(check.owned, false);
  assert.match(check.reason, /reused/);
  const live = pidOwned(process.pid, null);
  assert.equal(live.owned, true);
});

test("pause and resume preserve a synthetic session without terminating it", async () => {
  useScratch();
  const sleeper = spawnSleeper();
  const session = registerSession({
    provider: "synthetic",
    threadId: "pause-proof",
    repo: "/tmp/repo",
    worktree: "/tmp/repo",
    task: "pause preserves liveness",
    pid: sleeper.pid,
  });
  pauseSession(session.id);
  const stopped = psState(sleeper.pid);
  assert.match(stopped, /T/, `expected stopped state, got ${JSON.stringify(stopped)}`);
  assert.equal(sleeper.exitCode, null);
  resumeSession(session.id);
  const running = psState(sleeper.pid);
  assert.doesNotMatch(running, /T/, `expected running state, got ${JSON.stringify(running)}`);
  sleeper.kill("SIGTERM");
  await exited(sleeper);
});

test("recovery never signals: stale holders are swept, live sessions untouched", async () => {
  useScratch();
  const sleeper = spawnSleeper();
  const session = registerSession({
    provider: "synthetic",
    threadId: "recover-proof",
    repo: "/tmp/repo",
    worktree: "/tmp/repo",
    task: "recovery does not kill",
    pid: sleeper.pid,
  });
  const stale = grantAdmission({ ttlMs: -1 });
  assert.ok(readJson("admissions.json", {})[stale.id]);
  const out = spawnSync(
    process.execPath,
    ["scripts/supervisor/supervisor.mjs", "recover"],
    { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
  );
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(readJson("admissions.json", {}), {});
  assert.equal(sleeper.exitCode, null);
  assert.match(psState(sleeper.pid), /\S/);
  sleeper.kill("SIGTERM");
  await exited(sleeper);
  void session;
});

test("unmanaged agent-like processes are reported, never signaled", () => {
  useScratch();
  const inventory = [
    { pid: 111, ppid: 1, startTime: "t", command: "/usr/local/bin/codex exec --task x" },
    { pid: 222, ppid: 1, startTime: "t", command: "node scripts/supervisor/supervisor.mjs status" },
    { pid: 333, ppid: 1, startTime: "t", command: "/bin/sleep 30" },
  ];
  const { managed, unmanaged } = listSessions({ inventory });
  assert.deepEqual(managed, []);
  assert.deepEqual(
    unmanaged.map((row) => row.pid),
    [111],
  );
});

test("disposable cancellation needs explicit policy and explicit PIDs", async () => {
  useScratch();
  const sleeper = spawnSleeper();
  const startTime = processStartTime(sleeper.pid);
  assert.ok(startTime);
  assert.throws(() => cancelDisposable([{ pid: sleeper.pid, startTime }]), /explicit/);
  const cancelled = cancelDisposable([{ pid: sleeper.pid, startTime }], { allowed: true });
  assert.deepEqual(cancelled, [sleeper.pid]);
  await exited(sleeper);
  assert.throws(
    () => cancelDisposable([{ pid: sleeper.pid, startTime }], { allowed: true }),
    /not running|reused/,
  );
});

test("reattach resumes one exited session at a time on its original thread", async () => {
  useScratch();
  const first = spawnSleeper();
  const session = registerSession({
    provider: "synthetic",
    threadId: "reattach-proof",
    repo: "/tmp/repo",
    worktree: "/tmp/repo",
    task: "restart recovery",
    pid: first.pid,
  });
  completeSession(session.id);
  first.kill("SIGTERM");
  await exited(first);
  const replacement = spawnSleeper();
  const out = spawnSync(
    process.execPath,
    ["scripts/supervisor/supervisor.mjs", "reattach", session.id, "--pid", String(replacement.pid)],
    { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
  );
  assert.equal(out.status, 0, out.stderr);
  const receipt = JSON.parse(out.stdout);
  assert.equal(receipt.ok, true);
  assert.match(receipt.context, /original provider thread/);
  assert.equal(getSessionRow(session.id).status, "running");
  const rival = registerSession({
    provider: "synthetic",
    threadId: "other-thread",
    repo: "/tmp/repo",
    worktree: "/tmp/repo",
    task: "rival",
    pid: process.pid,
  });
  void rival;
  const twice = spawnSync(
    process.execPath,
    ["scripts/supervisor/supervisor.mjs", "reattach", session.id, "--pid", String(process.pid)],
    { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
  );
  assert.notEqual(twice.status, 0);
  assert.match(twice.stdout, /not running|running, not exited/);
  replacement.kill("SIGTERM");
  await exited(replacement);
});

function getSessionRow(id) {
  return { status: listSessions().managed.find((row) => row.id === id)?.status };
}

test("resource-run honors a supervisor admission instead of a second lock", async () => {
  useScratch();
  const parent = mkdtempSync(join(tmpdir(), "accelerate-admission-test-"));
  try {
    const holdLegacy = acquireLock(join(parent, "lock"));
    const grant = grantAdmission({ maxHeavyJobs: 1 });
    process.env.ACCELERATE_ADMISSION_ID = grant.id;
    const code = await runHeavyJob(process.execPath, ["-e", "process.exit(0)"], {
      directory: join(parent, "other-lock"),
      readCapacity: () => ({ availableBytes: 6 * GiB, freePercent: 50 }),
    });
    assert.equal(code, 0);
    holdLegacy();
    process.env.ACCELERATE_ADMISSION_ID = "bogus";
    await assert.rejects(
      runHeavyJob(process.execPath, ["-e", "process.exit(0)"], {
        directory: join(parent, "other-lock"),
        readCapacity: () => ({ availableBytes: 6 * GiB, freePercent: 50 }),
      }),
      /Unknown admission/,
    );
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("uninstall resumes supervisor-paused work and leaves no locks", async () => {
  useScratch();
  const sleeper = spawnSleeper();
  const session = registerSession({
    provider: "synthetic",
    threadId: "uninstall-proof",
    repo: "/tmp/repo",
    worktree: "/tmp/repo",
    task: "uninstall resumes",
    pid: sleeper.pid,
  });
  pauseSession(session.id);
  grantAdmission({ maxHeavyJobs: 1 });
  const out = spawnSync(
    process.execPath,
    ["scripts/supervisor/supervisor.mjs", "uninstall"],
    { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
  );
  assert.equal(out.status, 0, out.stderr);
  assert.match(out.stdout, /"strandedPaused":\[\]/);
  assert.match(psState(sleeper.pid), /\S/);
  assert.doesNotMatch(psState(sleeper.pid), /T/);
  sleeper.kill("SIGTERM");
  await exited(sleeper);
});

test("status and doctor CLIs emit compact receipts", () => {
  useScratch();
  for (const command of ["status", "doctor"]) {
    const out = spawnSync(
      process.execPath,
      ["scripts/supervisor/supervisor.mjs", command],
      { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
    );
    assert.equal(out.status, 0, out.stderr);
    const receipt = JSON.parse(out.stdout);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.command, command);
  }
  const noSession = spawnSync(
    process.execPath,
    ["scripts/supervisor/supervisor.mjs", "pause", "no-such-id"],
    { encoding: "utf8", env: { ...process.env, ACCELERATE_SUPERVISOR_DIR: scratch } },
  );
  assert.notEqual(noSession.status, 0);
  assert.equal(JSON.parse(noSession.stdout).ok, false);
});
