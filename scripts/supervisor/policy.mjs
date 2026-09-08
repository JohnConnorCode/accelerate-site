import { randomUUID } from "node:crypto";
import { audit, readJson, writeJson } from "./state.mjs";
import { assertOwned, processStartTime } from "./identity.mjs";
import { getSession, setSessionStatus } from "./sessions.mjs";

// Pause and resume preserve live sessions: SIGSTOP halts scheduling while
// the address space, file descriptors, and locks stay allocated. Pause is
// documented as preventing execution, never as releasing memory. Every
// signal site re-validates PID ownership first; a reused PID fails closed.
// The supervisor never terminates agent runtimes on its own: cancellation
// applies only to explicitly registered disposable children under explicit
// policy, and never by broad process-name matching.
function signalOwned(pid, startTime, signal, purpose) {
  assertOwned(pid, startTime, purpose);
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (error.code === "ESRCH") throw new Error(`Refusing ${purpose}: pid ${pid} exited.`);
    throw error;
  }
}

export function pauseSession(id) {
  const session = getSession(id);
  if (session.status === "paused") return session;
  if (session.status !== "running") throw new Error(`Session ${id} is ${session.status}.`);
  signalOwned(session.pid, session.startTime, "SIGSTOP", `pause session ${id}`);
  audit("session.paused", { id, note: "execution halted; memory retained" });
  return setSessionStatus(id, "paused", {
    pausedBy: `supervisor:${process.pid}`,
    pauseCaveats:
      "Wall-clock timeouts keep running while paused; held locks stay held; in-flight tool calls neither complete nor roll back. Resume does not replay missed time.",
  });
}

export function resumeSession(id) {
  const session = getSession(id);
  if (session.status !== "paused") throw new Error(`Session ${id} is ${session.status}, not paused.`);
  signalOwned(session.pid, session.startTime, "SIGCONT", `resume session ${id}`);
  audit("session.resumed", { id });
  return setSessionStatus(id, "running", { pausedBy: null });
}

// Machine-wide heavy-job admission. The supervisor holds at most
// maxHeavyJobs live grants; a granted job exports its admission ID as
// ACCELERATE_ADMISSION_ID and resource-run.mjs honors it instead of taking
// its own lock, so the two gates never compete. Grants expire so a dead
// holder cannot wedge the queue; recover() also sweeps them.
export function grantAdmission({ maxHeavyJobs = 1, ttlMs = 2 * 60 * 60 * 1000 } = {}) {
  const admissions = readJson("admissions.json", {});
  const live = {};
  for (const [id, grant] of Object.entries(admissions)) {
    try {
      assertOwned(grant.pid, grant.startTime, `retain admission ${id}`);
      if (Date.now() > grant.expiresAt) throw new Error("expired");
      live[id] = grant;
    } catch {
      audit("admission.released-stale", { id });
    }
  }
  if (Object.keys(live).length >= maxHeavyJobs) {
    const holders = Object.values(live).map((g) => g.pid);
    throw new Error(
      `Machine queue full: ${holders.length} heavy job(s) admitted (pids ${holders.join(", ")}).`,
    );
  }
  const id = randomUUID();
  live[id] = {
    id,
    pid: process.pid,
    startTime: processStartTime(process.pid),
    grantedAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
  };
  writeJson("admissions.json", live);
  audit("admission.granted", { id });
  return live[id];
}

export function validateAdmission(id) {
  const admissions = readJson("admissions.json", {});
  const grant = admissions[id];
  if (!grant) throw new Error(`Unknown admission ${id}.`);
  if (Date.now() > grant.expiresAt) throw new Error(`Admission ${id} expired.`);
  if (grant.pid !== process.pid)
    throw new Error(`Admission ${id} belongs to pid ${grant.pid}, not ${process.pid}.`);
  assertOwned(grant.pid, grant.startTime, `use admission ${id}`);
  return grant;
}

export function releaseAdmission(id) {
  const admissions = readJson("admissions.json", {});
  if (admissions[id]) {
    delete admissions[id];
    writeJson("admissions.json", admissions);
    audit("admission.released", { id });
  }
}
// Overload sequencing: first refuse new admissions, then pause producers,
// and only then cancel disposable children under explicit policy. Each tier
// is a recommendation; the CLI applies them in order and audits every step.
export function overloadTier(level) {
  if (level === "critical") return ["refuse-admissions", "pause-producers", "cancel-disposable"];
  if (level === "elevated") return ["refuse-admissions", "pause-producers"];
  return ["admit"];
}

export function cancelDisposable(children, { allowed = false } = {}) {
  if (!allowed)
    throw new Error("Disposable cancellation requires explicit disposableCancel policy.");
  const cancelled = [];
  for (const child of children ?? []) {
    assertOwned(child.pid, child.startTime, `cancel disposable job ${child.pid}`);
    try {
      process.kill(child.pid, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
    cancelled.push(child.pid);
    audit("disposable.cancelled", { pid: child.pid });
  }
  return cancelled;
}

export function reapChild(pid, startTime, { timeoutMs = 5000 } = {}) {
  assertOwned(pid, startTime, `reap child ${pid}`);
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return true;
      throw error;
    }
    Atomics.wait(sleeper, 0, 0, 100);
  }
  assertOwned(pid, startTime, `escalate child ${pid}`);
  process.kill(pid, "SIGKILL");
  return true;
}
