import { queueStatus, clearStaleLock } from "./queue.mjs";
import { execFileSync } from "node:child_process";
import { audit, loadConfig, readJson, withStateTransaction, saveConfig } from "./state.mjs";
import { assertOwned, pidOwned, processState } from "./identity.mjs";
import { listSessions, findSession, setSessionStatus } from "./sessions.mjs";

// Overload policy, in escalating tiers. The inviolable rules:
// - Agent runtimes are never SIGTERM/SIGKILLed by the supervisor; pause
//   (SIGSTOP) preserves the live session and resume (SIGCONT) restores it.
// - Only explicitly registered disposable child jobs may be cancelled, only
//   when disposableCancel policy is enabled, and only after ownership plus
//   process start-identity validation.
// - Processes are never selected by broad name matching. Every signal names
//   an explicit PID validated immediately before the call.
function signalOwned(pid, startTime, signal, purpose) {
  assertOwned(pid, startTime, purpose);
  process.kill(pid, signal);
}

function pauseProducerLocked(session) {
  assertCurrentSession(session);
  audit("producer.pause_intent", {
    provider: session.provider,
    threadId: session.threadId,
    pid: session.pid,
  });
  if (!session.startTime)
    throw new Error(
      `Refusing pause of thread ${session.threadId}: no start-time identity recorded.`,
    );
  signalOwned(
    session.pid,
    session.startTime,
    "SIGSTOP",
    `pause of ${session.provider} thread ${session.threadId}`,
  );
  setSessionStatus(session.threadId, "paused", session.provider, session);
  audit("producer.paused", {
    provider: session.provider,
    threadId: session.threadId,
    pid: session.pid,
  });
  return { paused: true, threadId: session.threadId, pid: session.pid };
}

function resumeProducerLocked(session) {
  const pressure = queueStatus();
  if (pressure.level !== "normal")
    throw new Error("Pressure has not cleared; producer remains paused");
  assertCurrentSession(session);
  audit("producer.resume_intent", {
    provider: session.provider,
    threadId: session.threadId,
    pid: session.pid,
  });
  if (!session.startTime)
    throw new Error(
      `Refusing resume of thread ${session.threadId}: no start-time identity recorded.`,
    );
  signalOwned(
    session.pid,
    session.startTime,
    "SIGCONT",
    `resume of ${session.provider} thread ${session.threadId}`,
  );
  setSessionStatus(session.threadId, "running", session.provider, session);
  audit("producer.resumed", {
    provider: session.provider,
    threadId: session.threadId,
    pid: session.pid,
  });
  return { resumed: true, threadId: session.threadId, pid: session.pid };
}

// Tier 1 is admission refusal (handled by the queue). Tier 2 pauses enrolled
// producers. Tier 3 cancels identified disposable children under explicit
// policy. Each tier records a receipt; overload never acts silently.
export async function enforceOverload({
  level,
  reasons,
  disposableJobs = [],
  allowDisposableCancel = false,
}) {
  if (!["normal", "elevated", "critical"].includes(level))
    throw new Error("Unknown overload level; no signal sent");
  const receipts = [];
  if (level === "normal") return { tier: 0, action: "none", receipts };
  if (level === "elevated") {
    audit("overload.elevated", { reasons });
    return { tier: 1, action: "refuse_admission", receipts, reasons };
  }
  const paused = [];
  for (const session of listSessions()) {
    if (session.status !== "running" || !session.live || !session.startTime) continue;
    try {
      pauseProducer({
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
        startTime: session.startTime,
      });
      paused.push(session.threadId);
    } catch (error) {
      receipts.push({ threadId: session.threadId, paused: false, reason: error.message });
    }
  }
  audit("overload.critical", { reasons, paused });
  const cancelled = [];
  if (allowDisposableCancel) {
    for (const job of disposableJobs) {
      try {
        await cancelDisposable(job);
        cancelled.push(job.id);
      } catch (error) {
        receipts.push({ job: job.id, cancelled: false, reason: error.message });
      }
    }
  }
  return {
    tier: allowDisposableCancel ? 3 : 2,
    action: "pause_producers",
    paused,
    cancelled,
    receipts,
    reasons,
  };
}

function pidGone(pid) {
  try {
    execFileSync("ps", ["-p", String(pid)], { stdio: "ignore", timeout: 2000 });
    return false;
  } catch {
    return true;
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function cancelDisposable(job, { graceMs = 5000 } = {}) {
  if (!job || job.disposable !== true)
    throw new Error(`Refusing cancellation: job ${job?.id ?? "?"} is not registered disposable.`);
  if (!Number.isInteger(job.pid) || job.pid <= 0)
    throw new Error("Refusing cancellation: invalid pid.");
  withStateTransaction(() => assertDisposable(job));
  try {
    withStateTransaction(() => {
      assertDisposable(job);
      audit("disposable.cancel_intent", { id: job.id, pid: job.pid });
      process.kill(job.pid, "SIGTERM");
    });
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
    return { cancelled: true, id: job.id, alreadyExited: true };
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (pidGone(job.pid)) {
      audit("disposable.cancelled", { id: job.id, pid: job.pid, via: "SIGTERM" });
      return { cancelled: true, id: job.id };
    }
    await wait(200);
  }
  withStateTransaction(() => {
    assertDisposable(job);
    process.kill(job.pid, "SIGKILL");
  });
  audit("disposable.cancelled", { id: job.id, pid: job.pid, via: "SIGKILL" });
  return { cancelled: true, id: job.id, escalated: true };
}

function assertCurrentSession(session) {
  const current = findSession(session.threadId, session.provider);
  if (!current || current.pid !== session.pid || current.startTime !== session.startTime)
    throw new Error("Session owner changed; no signal sent");
}
export function pauseProducer(session) {
  return withStateTransaction(() => pauseProducerLocked(session));
}
export function resumeProducer(session) {
  return withStateTransaction(() => resumeProducerLocked(session));
}
function assertDisposable(job) {
  if (!loadConfig().disposableCancel) throw new Error("Disposable cancellation is disabled");
  const registered = readJson("jobs.json", { jobs: [] }).jobs.find((item) => item.id === job?.id);
  if (
    !registered ||
    !job.startTime ||
    registered.pid !== job.pid ||
    registered.startTime !== job.startTime ||
    registered.disposable !== true
  )
    throw new Error("Disposable job is not registered with this exact process identity");
  if (listSessions().some((session) => session.pid === job.pid && session.live))
    throw new Error("Agent sessions are never cancelled");
  if (!registered.parentStartTime) throw new Error("Disposable parent identity unavailable");
  assertOwned(registered.parentPid, registered.parentStartTime, "disposable parent ownership");
  assertOwned(job.pid, job.startTime, "disposable cancellation");
}

/** Disable only after every owned stopped producer is safely running again. */
export function uninstallManagement() {
  const resumed = [];
  // Each completed signal/status receipt commits independently. A later
  // refusal must not roll back the registry for an already-resumed producer.
  for (const session of listSessions()) {
    if (!session.live) continue;
    withStateTransaction(() => {
      if (!pidOwned(session.pid, session.startTime).owned) return;
      const actual = processState(session.pid);
      if (!actual)
        throw new Error(`Cannot inspect thread ${session.threadId}; management remains enabled`);
      if (!actual.includes("T")) return;
      if (queueStatus().level !== "normal")
        throw new Error("Pressure has not cleared; producer remains paused");
      // Even an ended registration may still own a stopped process. A signal
      // is authorized by retained exact PID identity, never the status label.
      if (
        !listSessions().some(
          (current) => current.pid === session.pid && current.startTime === session.startTime,
        )
      )
        throw new Error("Session ownership changed; management remains enabled");
      audit("producer.resume_intent", {
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
      });
      signalOwned(session.pid, session.startTime, "SIGCONT", "supervisor uninstall");
      const current = findSession(session.threadId, session.provider);
      if (current?.pid === session.pid && current.startTime === session.startTime)
        setSessionStatus(session.threadId, "running", session.provider, session);
      audit("producer.resumed", {
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
      });
      resumed.push({ provider: session.provider, threadId: session.threadId, pid: session.pid });
    });
  }
  return withStateTransaction(() => {
    const continuation = readJson("continuation.json", null);
    if (continuation && pidOwned(continuation.pid, continuation.startTime).owned)
      throw new Error(
        "A supervised provider continuation is running; leave management enabled until it exits",
      );
    for (const session of listSessions()) {
      if (!session.live) continue;
      const actual = processState(session.pid);
      if (!actual || actual.includes("T"))
        throw new Error(
          "An owned producer is still stopped or unreadable; management remains enabled",
        );
    }
    const status = queueStatus();
    if (status.holder) {
      if (status.holder.liveness.live)
        throw new Error(
          "A heavy job still owns the slot; management remains enabled until it releases",
        );
      clearStaleLock();
    }
    if (queueStatus().waiting.length)
      throw new Error(
        "Heavy jobs are still waiting; management remains enabled until they finish or withdraw",
      );
    saveConfig({ manageHeavyJobs: false });
    audit("supervisor.uninstalled", { resumed });
    return { manageHeavyJobs: false, resumed };
  });
}
