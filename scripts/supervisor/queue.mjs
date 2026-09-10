import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { audit, loadConfig, readJson, writeJson } from "./state.mjs";
import { pidOwned, selfIdentity } from "./identity.mjs";
import { evaluatePressure, samplePressure } from "./pressure.mjs";

// One machine-wide heavy-job queue shared across repositories. The holder
// lives in the same lock directory resource-run.mjs uses, so the legacy gate
// and the supervisor can never hold competing locks: management is exclusive
// by configuration, and the owner record names which mechanism holds it.
export function lockPath() {
  return join(tmpdir(), `accelerate-heavy-job-${process.getuid?.() ?? "user"}`);
}

function readHolder() {
  try {
    return JSON.parse(readFileSync(join(lockPath(), "owner.json"), "utf8"));
  } catch {
    return null;
  }
}

export function holderLive(holder) {
  if (!holder || typeof holder.pid !== "number") return { live: false, reason: "no holder record" };
  const check = pidOwned(holder.pid, holder.startTime ?? null);
  if (!check.owned) return { live: false, reason: check.reason, stale: true };
  return { live: true, startTime: check.startTime };
}

function loadQueue() {
  return readJson("queue.json", { holder: null, waiting: [], level: "normal" });
}

function saveQueue(queue) {
  writeJson("queue.json", queue);
}

export function requestTicket({ repo, kind }) {
  const config = loadConfig();
  const queue = loadQueue();
  const ticket = randomUUID();
  const entry = {
    ticket,
    repo: repo || process.cwd(),
    kind: kind || "heavy",
    requestedAt: new Date().toISOString(),
    requester: selfIdentity(),
  };
  queue.waiting.push(entry);
  saveQueue(queue);
  audit("queue.requested", { ticket, repo: entry.repo, kind: entry.kind, position: queue.waiting.length });
  return { ticket, position: queue.waiting.length, maxHeavyJobs: config.maxHeavyJobs };
}

// Non-blocking admission. Denials carry the reason and the recovery step;
// callers surface the receipt instead of retrying blindly.
export function admitTicket(ticket, { sample = null } = {}) {
  const config = loadConfig();
  const queue = loadQueue();
  const index = queue.waiting.findIndex((entry) => entry.ticket === ticket);
  if (index === -1) {
    // A direct holder (legacy path or another supervisor) may own the lock.
    const holder = readHolder();
    if (holder) {
      const live = holderLive(holder);
      return {
        admitted: false,
        reason: `Heavy slot held by ${holder.kind || "job"} in ${holder.repo || "unknown"} (pid ${holder.pid}).`,
        recovery: live.live
          ? "Wait for release or ask the holder to yield; no automatic takeover."
          : `Stale holder (${live.reason}). Run: supervisor recover --clear-stale-lock`,
        stale: !live.live,
      };
    }
    return { admitted: false, reason: `Unknown ticket ${ticket}.`, recovery: "Request a ticket first." };
  }
  const entry = queue.waiting[index];
  const pressure = sample ?? samplePressure(entry.repo);
  const evaluated = evaluatePressure(pressure, config.pressure, queue.level);
  if (evaluated.level !== queue.level) {
    queue.level = evaluated.level;
    saveQueue(queue);
    audit("pressure.level", { level: evaluated.level, reasons: evaluated.reasons });
  }
  if (evaluated.level !== "normal") {
    return {
      admitted: false,
      reason: `Pressure gate ${evaluated.level}: ${evaluated.reasons.join("; ")}.`,
      recovery: "Free memory or disk, or wait for pressure to clear past hysteresis bounds.",
      level: evaluated.level,
    };
  }
  const activeHolders = countActiveHolders(queue);
  if (activeHolders >= config.maxHeavyJobs) {
    const ahead = queue.waiting.slice(0, index);
    return {
      admitted: false,
      reason: `Heavy slot occupied (${activeHolders}/${config.maxHeavyJobs}); ${ahead.length} ticket(s) ahead.`,
      recovery: "Wait for the holder to release; the queue is FIFO across repositories.",
      position: index + 1,
    };
  }
  if (index !== 0) {
    return {
      admitted: false,
      reason: `Ticket is #${index + 1} in a FIFO queue; earlier tickets admit first.`,
      recovery: "Wait for earlier tickets to release.",
      position: index + 1,
    };
  }
  queue.waiting.splice(index, 1);
  const holder = {
    supervisor: true,
    ticket,
    pid: entry.requester.pid,
    startTime: entry.requester.startTime,
    repo: entry.repo,
    kind: entry.kind,
    since: new Date().toISOString(),
  };
  claimLockDir(holder);
  queue.holder = holder;
  saveQueue(queue);
  audit("queue.admitted", { ticket, repo: entry.repo, kind: entry.kind });
  return { admitted: true, ticket, holder };
}

function countActiveHolders(queue) {
  if (!queue.holder) return 0;
  return holderLive(queue.holder).live ? 1 : 0;
}

function claimLockDir(holder) {
  const directory = lockPath();
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existing = readHolder();
    if (existing) {
      const live = holderLive(existing);
      if (live.live)
        throw new Error(
          `Heavy slot held by ${existing.kind || "job"} in ${existing.repo || "unknown"} (pid ${existing.pid}). No automatic takeover.`,
        );
      throw new Error(
        `Stale lock held by pid ${existing.pid} (${live.reason}). Run: supervisor recover --clear-stale-lock`,
      );
    }
  }
  writeFileSync(join(directory, "owner.json"), JSON.stringify(holder), { mode: 0o600 });
}

export function releaseTicket(ticket) {
  const queue = loadQueue();
  const waitingIndex = queue.waiting.findIndex((entry) => entry.ticket === ticket);
  if (waitingIndex !== -1) {
    const [removed] = queue.waiting.splice(waitingIndex, 1);
    saveQueue(queue);
    audit("queue.withdrawn", { ticket });
    return { released: true, waiting: true, ticket, repo: removed.repo };
  }
  if (queue.holder && queue.holder.ticket === ticket) {
    const live = holderLive(queue.holder);
    try {
      rmSync(lockPath(), { recursive: true, force: true });
    } catch {
      /* best effort; receipt still closes the ticket */
    }
    queue.holder = null;
    saveQueue(queue);
    audit("queue.released", { ticket, holderWasLive: live.live });
    return { released: true, ticket };
  }
  return { released: false, ticket, reason: "Unknown ticket; nothing released." };
}

export function queueStatus({ sample = null } = {}) {
  const config = loadConfig();
  const queue = loadQueue();
  const holder = queue.holder
    ? { ...queue.holder, liveness: holderLive(queue.holder) }
    : readHolder()
      ? { ...readHolder(), liveness: holderLive(readHolder()), legacy: true }
      : null;
  const pressure = sample ?? samplePressure();
  const evaluated = evaluatePressure(pressure, config.pressure, queue.level);
  return {
    managed: config.manageHeavyJobs,
    maxHeavyJobs: config.maxHeavyJobs,
    level: evaluated.level,
    reasons: evaluated.reasons,
    holder,
    waiting: queue.waiting.map((entry, i) => ({ ...entry, position: i + 1 })),
    pressure: {
      memFreePct: pressure.memFreePct,
      swapUsedPct: pressure.swapUsedPct,
      diskAvailGiB: pressure.diskAvailGiB,
    },
  };
}

export function clearStaleLock() {
  const holder = readHolder();
  if (!holder) return { cleared: false, reason: "No lock held." };
  const live = holderLive(holder);
  if (live.live)
    throw new Error(
      `Refusing: lock holder pid ${holder.pid} is alive. Ask the holder to yield; locks are never taken by force.`,
    );
  try {
    rmSync(lockPath(), { recursive: true, force: true });
  } catch (error) {
    throw new Error(`Could not clear stale lock: ${error.message}`);
  }
  const queue = loadQueue();
  queue.holder = null;
  saveQueue(queue);
  audit("queue.stale_cleared", { pid: holder.pid, reason: live.reason });
  return { cleared: true, pid: holder.pid, reason: live.reason };
}

export function queueDir() {
  return dirname(lockPath());
}
