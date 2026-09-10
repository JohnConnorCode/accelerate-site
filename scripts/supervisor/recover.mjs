import { audit, readJson, writeJson } from "./state.mjs";
import { pidOwned } from "./identity.mjs";

// Restart recovery. The supervisor cannot resurrect dead agent runtimes, and
// it must not pretend otherwise: recovery classifies every registered
// session, blocks duplicate writers, and resumes eligible sessions one at a
// time with an audit entry each. Missing or unflushed context is reported
// honestly instead of reconstructed.
export function planRecovery() {
  const state = readJson("sessions.json", { sessions: [] });
  const plan = [];
  const seenThreads = new Map();
  for (const session of state.sessions) {
    if (session.status === "ended") continue;
    const key = `${session.provider}:${session.threadId}`;
    if (seenThreads.has(key)) {
      plan.push({
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
        disposition: "duplicate_writer_blocked",
        reason: `A newer registration for ${key} already owns the thread; this record stays superseded.`,
      });
      continue;
    }
    seenThreads.set(key, session);
    const live = pidOwned(session.pid, session.startTime);
    if (live.owned) {
      const ageMs = Date.now() - Date.parse(session.lastHeartbeat || session.registeredAt || 0);
      plan.push({
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
        disposition: "resume_eligible",
        reason: `Owner alive; last heartbeat ${Number.isFinite(ageMs) ? Math.round(ageMs / 1000) : "?"}s ago.`,
      });
    } else {
      plan.push({
        provider: session.provider,
        threadId: session.threadId,
        pid: session.pid,
        disposition: "owner_dead",
        reason: `Owner dead (${live.reason}). Context after the last heartbeat is unflushed and reported, not reconstructed.`,
        lastHeartbeat: session.lastHeartbeat || null,
      });
    }
  }
  return plan;
}

// Applies the plan strictly one session at a time. Resume-eligible sessions
// return to running; dead owners become interrupted (re-registration with the
// original provider thread ID re-admits them through duplicate-writer
// protection); duplicates stay blocked.
export function applyRecovery(plan = planRecovery()) {
  const applied = [];
  const state = readJson("sessions.json", { sessions: [] });
  for (const item of plan) {
    const session = state.sessions.find(
      (entry) =>
        entry.provider === item.provider &&
        entry.threadId === item.threadId &&
        entry.pid === item.pid &&
        entry.status !== "ended",
    );
    if (!session) {
      applied.push({ ...item, applied: false, reason: "Record changed during recovery; skipping." });
      continue;
    }
    if (item.disposition === "resume_eligible") {
      session.status = "running";
      session.lastHeartbeat = new Date().toISOString();
      audit("recovery.resumed", { provider: item.provider, threadId: item.threadId, pid: item.pid });
      applied.push({ ...item, applied: true });
    } else if (item.disposition === "owner_dead") {
      session.status = "interrupted";
      audit("recovery.interrupted", {
        provider: item.provider,
        threadId: item.threadId,
        pid: item.pid,
        lastHeartbeat: item.lastHeartbeat,
      });
      applied.push({ ...item, applied: true });
    } else {
      audit("recovery.blocked", { provider: item.provider, threadId: item.threadId, reason: item.reason });
      applied.push({ ...item, applied: false });
    }
  }
  writeJson("sessions.json", state);
  return applied;
}
