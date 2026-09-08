import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// The whole battery runs against per-test state directories and an isolated
// lock directory; the real machine-wide slot is never touched.
const here = new URL(".", import.meta.url).pathname;
const root = mkdtempSync(join(tmpdir(), "supervisor-test-"));
process.env.ACCELERATE_SUPERVISOR_DIR = join(root, "state");
process.env.ACCELERATE_HEAVY_LOCK_DIR = join(root, "lock");
delete process.env.ACCELERATE_SUPERVISOR_DISABLE;

const queue = await import("./supervisor/queue.mjs");
const sessions = await import("./supervisor/sessions.mjs");
const policy = await import("./supervisor/policy.mjs");
const recover = await import("./supervisor/recover.mjs");
const identity = await import("./supervisor/identity.mjs");
const { evaluatePressure } = await import("./supervisor/pressure.mjs");
const { saveConfig, loadConfig, writeJson, readJson } = await import("./supervisor/state.mjs");
const { inventoryHeavyProcesses } = await import("./supervisor/adapters.mjs");

const PRESSURE = {
  memFreeRefusePct: 20,
  memFreeClearPct: 28,
  memFreeCriticalPct: 10,
  swapUsedRefusePct: 80,
  swapUsedClearPct: 70,
  swapUsedCriticalPct: 92,
  diskMinGiB: 5,
  diskClearGiB: 7,
};
const normalSample = { memFreePct: 55, swapUsedPct: 5, diskAvailGiB: 50 };
queue.setPressureSource(() => normalSample);

const children = [];
function sleepChild() {
  const child = spawn("sleep", ["120"], { stdio: "ignore" });
  children.push(child);
  return new Promise((resolve) => child.once("spawn", () => resolve(child)));
}
after(() => {
  for (const child of children) {
    try {
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
  }
  rmSync(root, { recursive: true, force: true });
});

function resetQueue() {
  const dir = process.env.ACCELERATE_HEAVY_LOCK_DIR;
  rmSync(dir, { recursive: true, force: true });
  writeJson("queue.json", { holder: null, waiting: [], level: "normal" });
}
before(() => {
  mkdirSync(process.env.ACCELERATE_SUPERVISOR_DIR, { recursive: true });
  saveConfig({ manageHeavyJobs: true, disposableCancel: false, pressure: PRESSURE });
});
test("AC8 cross-repository contention: one slot, FIFO across repos, release admits next", async () => {
  resetQueue();
  const a = queue.requestTicket({ repo: "/repo/a", kind: "build" });
  const b = queue.requestTicket({ repo: "/repo/b", kind: "test" });
  assert.equal(a.position, 1);
  assert.equal(b.position, 2);
  const outOfOrder = queue.admitTicket(b.ticket, { sample: normalSample });
  assert.equal(outOfOrder.admitted, false);
  assert.match(outOfOrder.reason, /earlier tickets admit first|FIFO/i);
  const admitted = queue.admitTicket(a.ticket, { sample: normalSample });
  assert.equal(admitted.admitted, true);
  const second = queue.admitTicket(b.ticket, { sample: normalSample });
  assert.equal(second.admitted, false);
  assert.match(second.reason, /occupied/);
  assert.equal(existsSync(queue.lockPath()), true, "admission took the shared lock dir");
  const status = queue.queueStatus({ sample: normalSample });
  assert.equal(status.holder.repo, "/repo/a");
  assert.equal(status.waiting.length, 1);
  assert.equal(queue.releaseTicket(a.ticket).released, true);
  const next = queue.admitTicket(b.ticket, { sample: normalSample });
  assert.equal(next.admitted, true, "released slot passes to the next repo");
  queue.releaseTicket(b.ticket);
  resetQueue();
});
test("AC8 pressure hysteresis: refuse at thresholds, hold until clear band, fail closed when unreadable", () => {
  assert.equal(
    evaluatePressure({ memFreePct: 50, swapUsedPct: 5, diskAvailGiB: 50 }, PRESSURE).level,
    "normal",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 15, swapUsedPct: 5, diskAvailGiB: 50 }, PRESSURE).level,
    "elevated",
  );
  // 25% is above the refuse line (20) but below clear (28): an elevated
  // machine must NOT flap back to normal.
  assert.equal(
    evaluatePressure({ memFreePct: 25, swapUsedPct: 5, diskAvailGiB: 50 }, PRESSURE, "elevated")
      .level,
    "elevated",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 30, swapUsedPct: 5, diskAvailGiB: 50 }, PRESSURE, "elevated")
      .level,
    "normal",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 5, swapUsedPct: 5, diskAvailGiB: 50 }, PRESSURE).level,
    "critical",
  );
  assert.equal(
    evaluatePressure({ memFreePct: null, swapUsedPct: null, diskAvailGiB: 50 }, PRESSURE).level,
    "elevated",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 50, swapUsedPct: 95, diskAvailGiB: 50 }, PRESSURE).level,
    "critical",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 50, swapUsedPct: 75, diskAvailGiB: 50 }, PRESSURE, "elevated")
      .level,
    "elevated",
  );
  assert.equal(
    evaluatePressure({ memFreePct: 50, swapUsedPct: 5, diskAvailGiB: 4 }, PRESSURE).level,
    "elevated",
  );
  const refusal = queue.requestTicket({ repo: "/repo/pressure", kind: "build" });
  const denied = queue.admitTicket(refusal.ticket, {
    sample: { memFreePct: 15, swapUsedPct: 5, diskAvailGiB: 50 },
  });
  assert.equal(denied.admitted, false);
  assert.match(denied.reason, /Pressure gate elevated/);
  queue.releaseTicket(refusal.ticket);
});
test("AC8 PID reuse rejection: every signal path re-validates process start identity", async () => {
  const child = await sleepChild();
  const realStart = identity.processStartTime(child.pid);
  assert.ok(realStart, "ps reports start identity for a live pid");
  assert.throws(
    () => identity.assertOwned(child.pid, "Thu Jan  1 00:00:00 2026", "pause"),
    /reused/,
  );
  assert.throws(
    () =>
      policy.pauseProducer({
        provider: "codex",
        threadId: "t-reuse",
        pid: child.pid,
        startTime: "Thu Jan  1 00:00:00 2026",
      }),
    /owner changed/,
  );
  assert.equal(identity.pidOwned(99998, null).owned, false);
  await assert.rejects(
    () =>
      policy.cancelDisposable({ id: "x", pid: child.pid, disposable: true, startTime: "wrong" }),
    /disabled/,
  );
});
test("AC8 no automatic termination: critical pressure pauses live agents (SIGSTOP) and never kills", async () => {
  resetQueue();
  const child = await sleepChild();
  sessions.registerSession({
    provider: "claude",
    threadId: "t-pause",
    pid: child.pid,
    repo: "/repo/pause",
  });
  const registered = sessions.findSession("t-pause");
  const result = await policy.enforceOverload({
    level: "critical",
    reasons: ["memory exhausted"],
    disposableJobs: [],
    allowDisposableCancel: false,
  });
  assert.equal(result.action, "pause_producers");
  assert.deepEqual(result.paused, ["t-pause"]);
  assert.equal(
    identity.processState(child.pid)?.startsWith("T"),
    true,
    "paused agent holds memory but cannot execute",
  );
  const row = sessions.listSessions().find((s) => s.threadId === "t-pause");
  assert.equal(row.status, "paused");
  const resumed = await policy.enforceOverload({ level: "normal", reasons: [] });
  assert.equal(resumed.action, "none");
  policy.resumeProducer(registered);
  assert.match(identity.processState(child.pid) || "", /S|R/, "resumed agent runs again");
  sessions.endSession("t-pause");
});
test("AC8 disposable cancellation is explicit, policy-gated, and identity-checked", async () => {
  const child = await sleepChild();
  const identityStart = identity.processStartTime(child.pid);
  await assert.rejects(
    policy.cancelDisposable({ id: "not-disposable", pid: child.pid, startTime: identityStart }),
    /not registered disposable/,
  );
  const job = { id: "worker", pid: child.pid, startTime: identityStart, disposable: true };
  await assert.rejects(policy.cancelDisposable(job), /disabled/);
  saveConfig({ disposableCancel: true });
  await assert.rejects(policy.cancelDisposable(job), /not registered/);
  sessions.registerDisposableJob(job);
  const cancelled = await policy.cancelDisposable(
    { id: "worker", pid: child.pid, startTime: identityStart, disposable: true },
    { graceMs: 1500 },
  );
  assert.equal(cancelled.cancelled, true);
  saveConfig({ disposableCancel: false });
  assert.equal(child.exitCode !== null || child.signalCode !== null, true);
  // A dead holder is never cancelled by name matching; only disposable PIDs.
});
test("AC8 supervisor restart: queue state is durable, stale holders are reported not stolen", async () => {
  resetQueue();
  const child = await sleepChild();
  const holder = { pid: child.pid, repo: "/repo/dead", kind: "build", ticket: "t" };
  writeJson("queue.json", { holder, waiting: [], level: "normal" });
  mkdirSync(queue.lockPath(), { recursive: true });
  writeFileSync(
    join(queue.lockPath(), "owner.json"),
    JSON.stringify({ pid: child.pid, repo: "/repo/dead", kind: "build" }),
  );
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("exit", resolve));
  const status = queue.queueStatus({ sample: normalSample });
  assert.equal(status.holder.liveness.live, false, "dead holder detected via start identity");
  const ticket = queue.requestTicket({ repo: "/repo/blocked", kind: "test" });
  const denied = queue.admitTicket(ticket.ticket, { sample: normalSample });
  assert.equal(denied.admitted, false);
  assert.equal(denied.stale, true, "stale lock reported with operator recovery step");
  assert.match(denied.recovery || "", /recover --clear-stale-lock/);
  queue.releaseTicket(ticket.ticket);
  const cleared = queue.clearStaleLock();
  assert.equal(cleared.cleared, true);
});
test("AC8 unmanaged jobs stay visible", () => {
  resetQueue();
  const fake = [
    { pid: 4001, ppid: 1, startTime: "X", command: "node /repo/build.js" },
    { pid: 4002, ppid: 1, startTime: "Y", command: "npm run test:core" },
    { pid: 4003, ppid: 1, startTime: "Z", command: "sleep 1" },
  ];
  const found = inventoryHeavyProcesses({ processes: fake });
  assert.deepEqual(
    found.map((j) => j.pid),
    [4001, 4002],
  );
  assert.equal(
    found.every((j) => j.managed === false),
    true,
  );
});
test("AC8 original-thread recovery: duplicate writers blocked, dead owners interrupted, resume one at a time", async () => {
  const child = await sleepChild();
  sessions.registerSession({
    provider: "codex",
    threadId: "thread-1",
    pid: process.pid,
    repo: "/repo/r",
    worktree: "/wt",
    task: "AC8",
  });
  const dup = () =>
    sessions.registerSession({
      provider: "codex",
      threadId: "thread-1",
      pid: child.pid,
      repo: "/repo/r",
    });
  assert.throws(dup, /Duplicate writer refused/, "live owner keeps the thread");
  // Kill the ORIGINAL owner's heartbeat by ending it, then re-register with
  // the same durable thread id from the recovery caller (the pattern restart
  // recovery must permit).
  sessions.endSession("thread-1");
  const rereg = sessions.registerSession({
    provider: "codex",
    threadId: "thread-1",
    pid: child.pid,
    repo: "/repo/r",
  });
  assert.equal(rereg.pid, child.pid);
  const deadOwner = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGKILL");
  await deadOwner;
  const plan = recover.planRecovery();
  const item = plan.find((p) => p.provider === "codex" && p.threadId === "thread-1");
  assert.equal(item.disposition, "owner_dead");
  assert.match(item.reason, /unflushed/, "context is reported honestly, never reconstructed");
  const applied = recover.applyRecovery(plan);
  assert.equal(applied.find((a) => a.threadId === "thread-1").applied, true);
  assert.equal(
    sessions
      .listSessions()
      .filter((x) => x.threadId === "thread-1")
      .at(-1).status,
    "interrupted",
  );
  // A fresh registration with the same durable thread id succeeds once the
  // stale record is no longer live.
  const revived = sessions.registerSession({
    provider: "codex",
    threadId: "thread-1",
    pid: process.pid,
    repo: "/repo/r",
  });
  assert.ok(revived);
  sessions.endSession("thread-1");
});
test("AC7 CLI produces compact receipts; install/uninstall toggle cleanly; status exposes sessions", async () => {
  const run = (...argv) =>
    JSON.parse(
      spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { setPressureSource } from ${JSON.stringify(new URL("./supervisor/queue.mjs", import.meta.url).href)};setPressureSource(() => (${JSON.stringify(normalSample)}));process.argv = [process.execPath, "supervisor", ...${JSON.stringify(argv)}];await import(${JSON.stringify(new URL("./supervisor/cli.mjs", import.meta.url).href)});`,
        ],
        {
          encoding: "utf8",
          env: process.env,
        },
      ).stdout,
    );
  assert.equal(run("install").manageHeavyJobs, true);
  const status = run("status");
  assert.equal(status.ok, true);
  assert.ok(Array.isArray(status.sessions));
  assert.equal(typeof status.pressure.memFreePct, "number");
  // Pause a synthetic child, never the test process itself.
  const cliChild = await sleepChild();
  const register = run(
    "register",
    "--provider",
    "opencode",
    "--thread",
    "cli-1",
    "--pid",
    String(cliChild.pid),
    "--repo",
    "/repo/cli",
  );
  assert.equal(register.ok, true);
  const listed = run("status");
  assert.equal(
    listed.sessions.some((s) => s.threadId === "cli-1"),
    true,
  );
  assert.equal(run("heartbeat", "--thread", "cli-1", "--pid", String(cliChild.pid)).ok, true);
  const paused = run("pause", "--thread", "cli-1");
  assert.equal(paused.paused, true, "CLI pause exercises the validated signal path");
  assert.equal(identity.processState(cliChild.pid)?.startsWith("T"), true);
  assert.equal(run("resume", "--thread", "cli-1").resumed, true);
  run("end", "--thread", "cli-1");
  assert.equal(run("uninstall").manageHeavyJobs, false);
  assert.equal(loadConfig().manageHeavyJobs, false);
  assert.equal(run("enroll", "--repo", here).enrolled, true);
  assert.equal(
    JSON.parse(
      readFileSync(join(process.env.ACCELERATE_SUPERVISOR_DIR, "audit.log.jsonl"), "utf8")
        .split("\n")
        .filter(Boolean)
        .at(-1),
    ).event,
    "repo.enrolled",
  );
  saveConfig({ manageHeavyJobs: true });
});
test("AC1 gate integration: runHeavyJob delegates, fails fast on stale locks, runs after explicit recovery", async () => {
  resetQueue();
  const { runHeavyJob } = await import("./resource-run.mjs");
  // A proven-stale holder: dead pid recorded in both queue state and owner.
  const dead = await sleepChild();
  const deadPid = dead.pid;
  const exited = new Promise((resolve) => dead.once("exit", resolve));
  dead.kill("SIGKILL");
  await exited;
  mkdirSync(queue.lockPath(), { recursive: true });
  writeFileSync(
    join(queue.lockPath(), "owner.json"),
    JSON.stringify({ pid: deadPid, repo: "/repo/dead", kind: "heavy" }),
  );
  writeJson("queue.json", {
    holder: { pid: deadPid, repo: "/repo/dead", kind: "heavy", ticket: "stale" },
    waiting: [],
    level: "normal",
  });
  await assert.rejects(
    () =>
      runHeavyJob(process.execPath, ["-e", "process.exit(0)"], {
        supervise: true,
        readCapacity: () => ({ availableBytes: 50 * 1024 ** 3, freePercent: 55 }),
      }),
    /[Ss]tale/,
    "stale locks surface instead of spinning",
  );
  const cleared = queue.clearStaleLock();
  assert.equal(cleared.cleared, true);
  const code = await runHeavyJob(process.execPath, ["-e", "process.exit(0)"], {
    supervise: true,
    readCapacity: () => ({ availableBytes: 50 * 1024 ** 3, freePercent: 55 }),
  });
  assert.equal(code, 0, "recovered queue admits the next heavy job");
  assert.equal(existsSync(queue.lockPath()), false, "supervised release frees the shared slot");
});
test("AC6 coverage names every adapter, its bypass, and denies universal enforcement", () => {
  const report = spawnSync(process.execPath, [join(here, "supervisor", "cli.mjs"), "coverage"], {
    encoding: "utf8",
    env: process.env,
  });
  const parsed = JSON.parse(report.stdout);
  assert.equal(parsed.universalEnforcement, false);
  const ids = parsed.adapters.map((a) => a.id);
  for (const required of ["codex", "claude", "opencode", "npm", "browser"])
    assert.ok(ids.includes(required), `adapter ${required} reported`);
  assert.ok(parsed.hardEnforcementRequires.length > 0);
  assert.ok(parsed.bypasses.length > 0, "installed CLIs are listed as bypasses honestly");
});

test("Concurrent processes preserve every state update and duplicate writer admission", async () => {
  writeJson("counter.json", { value: 0 });
  const stateUrl = new URL("./supervisor/state.mjs", import.meta.url).href;
  const sessionsUrl = new URL("./supervisor/sessions.mjs", import.meta.url).href;
  const worker = (code) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      children.push(child);
      let out = "",
        err = "";
      child.stdout.on("data", (value) => (out += value));
      child.stderr.on("data", (value) => (err += value));
      child.on("error", reject);
      child.on("exit", (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err))));
    });
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, () =>
      worker(`
    import { withStateTransaction, readJson, writeJson } from ${JSON.stringify(stateUrl)};
    import { registerSession } from ${JSON.stringify(sessionsUrl)};
    for (let i=0;i<30;i++) withStateTransaction(() => { const value=readJson("counter.json",{value:0});value.value++;writeJson("counter.json",value); });
    try { registerSession({provider:"codex",threadId:"concurrent-owner",pid:${process.pid}}); console.log("admitted"); }
    catch(error) { if(!error.message.includes("Duplicate writer refused")) throw error; console.log("refused"); }
  `),
    ),
  );
  assert.equal(readJson("counter.json", null).value, 240);
  assert.equal(outcomes.filter((value) => value === "admitted").length, 1);
  assert.equal(outcomes.filter((value) => value === "refused").length, 7);
  sessions.endSession("concurrent-owner", "codex");
  const crash = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `import {withStateTransaction,writeJson} from ${JSON.stringify(stateUrl)};withStateTransaction(()=>{writeJson("counter.json",{value:999});process.exit(17)});`,
  ]);
  assert.equal(crash.status, 17);
  assert.equal(
    readJson("counter.json", null).value,
    240,
    "crashed transaction rolls back and unlocks without a stale-lock prompt",
  );
});

test("Stale releases preserve replacement owners in queue and direct resource gate", async () => {
  resetQueue();
  const ticket = queue.requestTicket({ repo: "/test" });
  assert.equal(queue.admitTicket(ticket.ticket, { sample: normalSample }).admitted, true);
  const replacement = { ...identity.selfIdentity(), ticket: "replacement", kind: "synthetic" };
  writeFileSync(join(queue.lockPath(), "owner.json"), JSON.stringify(replacement));
  assert.equal(queue.releaseTicket(ticket.ticket).released, false);
  assert.equal(
    JSON.parse(readFileSync(join(queue.lockPath(), "owner.json"))).ticket,
    "replacement",
  );
  resetQueue();
  const { acquireLock } = await import("./resource-run.mjs");
  const release = acquireLock(queue.lockPath());
  writeFileSync(join(queue.lockPath(), "owner.json"), JSON.stringify(replacement));
  assert.throws(release, /owner changed/);
  assert.equal(existsSync(queue.lockPath()), true);
  resetQueue();
});

test("Recovery ignores superseded history, preserves paused owners and rejects stale plans", async () => {
  const child = await sleepChild();
  const owner = sessions.registerSession({
    provider: "opencode",
    threadId: "replace-me",
    pid: child.pid,
  });
  const state = readJson("sessions.json", { sessions: [] });
  state.sessions.unshift({ ...owner, pid: 99999, startTime: "old", status: "superseded" });
  writeJson("sessions.json", state);
  sessions.heartbeatSession(owner.threadId, child.pid, "opencode");
  let plan = recover.planRecovery();
  assert.equal(plan.filter((item) => item.threadId === owner.threadId).length, 1);
  assert.equal(plan.find((item) => item.threadId === owner.threadId).pid, child.pid);
  policy.pauseProducer(owner);
  assert.equal(
    recover.applyRecovery(plan).find((item) => item.threadId === owner.threadId).applied,
    false,
  );
  plan = recover.planRecovery();
  assert.equal(plan.find((item) => item.threadId === owner.threadId).disposition, "paused");
  recover.applyRecovery(plan);
  assert.equal(sessions.findSession(owner.threadId, "opencode").status, "paused");
  assert.throws(
    () =>
      sessions.registerDisposableJob({
        id: "agent-is-not-disposable",
        pid: child.pid,
        startTime: owner.startTime,
      }),
    /agent session/i,
  );
  policy.resumeProducer(owner);
  sessions.endSession(owner.threadId, "opencode");
});
