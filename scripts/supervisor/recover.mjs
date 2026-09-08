import { audit, readJson, writeJson, withStateTransaction } from "./state.mjs";
import { pidOwned, processState } from "./identity.mjs";
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
