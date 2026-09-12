import { realpathSync, statSync } from "node:fs";
import { providerResumeCommand } from "./adapters.mjs";
import { queueStatus } from "./queue.mjs";
import { findSession, registerSession, setSessionStatus } from "./sessions.mjs";
import { audit, readJson, writeJson, withStateTransaction, loadConfig } from "./state.mjs";
import { pidOwned, processState, processStartTime } from "./identity.mjs";
export function planRecovery() {
  return withStateTransaction(() => {
    const { sessions } = readJson("sessions.json", { sessions: [] });
    const seen = new Set();
    return [...sessions]
      .reverse()
      .filter((session) => !["ended", "superseded"].includes(session.status))
      .map((session) => {
        const key = JSON.stringify([session.provider, session.threadId]);
        const identity = {
          provider: session.provider,
          threadId: session.threadId,
          pid: session.pid,
          startTime: session.startTime,
        };
        if (seen.has(key))
          return {
            ...identity,
            disposition: "duplicate_writer_blocked",
            reason: "A newer registration owns this thread",
          };
        seen.add(key);
        const live = session.startTime && pidOwned(session.pid, session.startTime).owned;
        if (!live)
          return {
            ...identity,
            disposition: "owner_dead",
            reason:
              "Owner unavailable; context after the last heartbeat is unflushed, not reconstructed",
            lastHeartbeat: session.lastHeartbeat,
          };
        const state = processState(session.pid);
        if (!state)
          return {
            ...identity,
            disposition: "owner_dead",
            reason:
              "Process state is unavailable; preserve context and inspect the owner before resuming",
          };
        return {
          ...identity,
          disposition: state?.includes("T") ? "paused" : "running",
          reason: state?.includes("T")
            ? "Owner remains paused; resume explicitly after pressure clears"
            : "Original owner is running; no replacement launched",
        };
      });
  });
}
export function applyRecovery(plan = planRecovery()) {
  return withStateTransaction(() => {
    const state = readJson("sessions.json", { sessions: [] });
    const current = planRecovery();
    const applied = plan.map((item) => {
      const fresh = current.find(
        (x) =>
          x.provider === item.provider &&
          x.threadId === item.threadId &&
          x.pid === item.pid &&
          x.startTime === item.startTime,
      );
      const session = state.sessions.find(
        (x) =>
          x.provider === item.provider &&
          x.threadId === item.threadId &&
          x.pid === item.pid &&
          x.startTime === item.startTime &&
          !["ended", "superseded"].includes(x.status),
      );
      if (
        !fresh ||
        !session ||
        fresh.disposition !== item.disposition ||
        fresh.disposition === "duplicate_writer_blocked"
      )
        return {
          ...item,
          applied: false,
          reason: "Recovery snapshot changed or duplicate owner; preserved current record",
        };
      session.status = fresh.disposition === "owner_dead" ? "interrupted" : fresh.disposition;
      audit("recovery.classified", { ...fresh, status: session.status });
      return { ...fresh, applied: true };
    });
    writeJson("sessions.json", state);
    return applied;
  });
}

/** Replace this foreground process: its registered PID survives provider exec.
 * No child-launch window, detached daemon, transcript copy, or permission bypass. */
export function continueOriginalThread(
  provider,
  threadId,
  { exec = process.execve, commandFor = providerResumeCommand } = {},
) {
  if (typeof exec !== "function")
    throw new Error(
      "SETUP_REQUIRED: foreground provider continuation requires Node process.execve",
    );
  const command = commandFor(provider, threadId);
  const next = withStateTransaction(() => {
    const session = findSession(threadId, provider);
    if (!session) throw new Error("Original registered provider thread is unavailable");
    if (!session.startTime)
      throw new Error("Original process identity is missing; inspect retained owner");
    if (pidOwned(session.pid, session.startTime).owned)
      throw new Error("Original thread still has a live owner; resume that process instead");
    if (!loadConfig().manageHeavyJobs) throw new Error("Supervised management is disabled");
    if (queueStatus().level !== "normal")
      throw new Error("Pressure has not cleared; continuation refused");
    const previous = readJson("continuation.json", null);
    if (previous && pidOwned(previous.pid, previous.startTime).owned)
      throw new Error("A provider continuation is already running; continue one session at a time");
    const directory = realpathSync(session.worktree || session.repo);
    if (
      !loadConfig().enrolledRepos.some(
        (repo) =>
          realpathSync(repo) === directory || realpathSync(repo) === realpathSync(session.repo),
      )
    )
      throw new Error("Retained repository is not enrolled for supervised launch");
    if (!statSync(directory).isDirectory()) throw new Error("Retained checkout is unavailable");
    const identity = {
      provider,
      threadId,
      pid: process.pid,
      startTime: processStartTime(process.pid),
    };
    if (!identity.startTime) throw new Error("Continuation process identity is unavailable");
    audit("continuation.intent", { ...identity, directory });
    registerSession({ ...session, ...identity });
    writeJson("continuation.json", identity);
    return { ...identity, directory };
  });
  // The registered process is already live throughout this interval. A crash
  // leaves a provably dead PID; another caller never has an unrecorded child.
  try {
    process.chdir(next.directory);
    exec(command.executable, [command.executable, ...command.args], process.env);
    throw new Error("Provider exec unexpectedly returned without replacing the process");
  } catch (error) {
    setSessionStatus(threadId, "interrupted", provider, next);
    withStateTransaction(() => {
      const current = readJson("continuation.json", null);
      if (current?.pid === next.pid && current?.startTime === next.startTime)
        writeJson("continuation.json", null);
    });
    audit("continuation.failed", { provider, threadId, pid: next.pid });
    throw error;
  }
}
