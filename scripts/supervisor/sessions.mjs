import { withStateTransaction } from "./state.mjs";
import { audit, readJson, writeJson } from "./state.mjs";
import { assertOwned, pidOwned, processStartTime, listProcesses } from "./identity.mjs";

const PROVIDERS = new Set(["codex", "claude", "opencode", "npm", "browser", "other"]);

// Agent session registry. Records identity and liveness only: provider,
// durable thread ID, repository, task, PID plus process start identity.
// Transcripts, prompts, secrets, and tool payloads are never stored here.
function loadSessions() {
  return readJson("sessions.json", { sessions: [] });
}

function saveSessions(state) {
  writeJson("sessions.json", state);
}

export function sessionProviders() {
  return [...PROVIDERS];
}

function registerSessionLocked(input) {
  const { provider, threadId, repo, worktree, task, pid } = input;
  if (!PROVIDERS.has(provider))
    throw new Error(`Unknown provider ${provider}; expected one of ${[...PROVIDERS].join(", ")}.`);
  if (!threadId || !String(threadId).trim()) throw new Error("A durable thread ID is required.");
  if (!Number.isInteger(pid) || pid <= 0) throw new Error("A live process ID is required.");
  const startTime = assertOwned(pid, null, "session registration");
  const state = loadSessions();
  const clash = [...state.sessions]
    .reverse()
    .find(
      (session) =>
        session.provider === provider &&
        session.threadId === String(threadId) &&
        !["ended", "superseded"].includes(session.status),
    );
  if (clash) {
    const live = pidOwned(clash.pid, clash.startTime);
    if (live.owned)
      throw new Error(
        `Duplicate writer refused: ${provider} thread ${threadId} is already owned by live pid ${clash.pid}.`,
      );
    clash.status = "superseded";
    audit("session.superseded", { provider, threadId, oldPid: clash.pid, reason: live.reason });
  }
  const session = {
    provider,
    threadId: String(threadId),
    repo: repo || process.cwd(),
    worktree: worktree || null,
    task: task || null,
    pid,
    startTime,
    status: "running",
    registeredAt: new Date().toISOString(),
    lastHeartbeat: new Date().toISOString(),
  };
  state.sessions.push(session);
  saveSessions(state);
  audit("session.registered", { provider, threadId: session.threadId, pid, repo: session.repo });
  return session;
}

function heartbeatSessionLocked(threadId, pid, provider = null) {
  findSession(threadId, provider);
  const state = loadSessions();
  const session = [...state.sessions]
    .reverse()
    .find(
      (entry) =>
        entry.threadId === String(threadId) &&
        !["ended", "superseded"].includes(entry.status) &&
        (!provider || entry.provider === provider),
    );
  if (!session) throw new Error(`No live session for thread ${threadId}.`);
  assertOwned(session.pid, session.startTime, `heartbeat for thread ${threadId}`);
  if (pid !== session.pid)
    throw new Error(
      `Heartbeat pid ${pid} does not match registered owner pid ${session.pid}; duplicate writers are refused.`,
    );
  session.lastHeartbeat = new Date().toISOString();
  saveSessions(state);
  return session;
}

export function findSession(threadId, provider = null) {
  const state = loadSessions();
  const matches = [...state.sessions]
    .reverse()
    .filter(
      (entry) =>
        entry.threadId === String(threadId) &&
        !["ended", "superseded"].includes(entry.status) &&
        (!provider || entry.provider === provider),
    );
  if (!provider && new Set(matches.map((entry) => entry.provider)).size > 1)
    throw new Error("Thread ID exists for several providers; specify the provider");
  return matches[0] || null;
}

function setSessionStatusLocked(threadId, status, provider = null, expected = null) {
  findSession(threadId, provider);
  if (!["running", "paused", "interrupted", "ended"].includes(status))
    throw new Error("Invalid session status");
  const state = loadSessions();
  const session = [...state.sessions]
    .reverse()
    .find(
      (entry) =>
        entry.threadId === String(threadId) &&
        !["ended", "superseded"].includes(entry.status) &&
        (!provider || entry.provider === provider),
    );
  if (!session) throw new Error(`No live session for thread ${threadId}.`);
  if (expected && (session.pid !== expected.pid || session.startTime !== expected.startTime))
    throw new Error("Session owner changed; no status mutation applied");
  session.status = status;
  saveSessions(state);
  audit("session.status", { provider: session.provider, threadId, status });
  return session;
}

export function endSession(threadId, provider = null) {
  return setSessionStatus(threadId, "ended", provider);
}

export function listSessions() {
  const state = loadSessions();
  return state.sessions.map((session) => {
    const live = pidOwned(session.pid, session.startTime);
    return {
      provider: session.provider,
      threadId: session.threadId,
      repo: session.repo,
      worktree: session.worktree,
      task: session.task,
      pid: session.pid,
      // Start-time identity is part of the safety record: it is what makes
      // pause, resume, and heartbeat validation PID-reuse safe.
      startTime: session.startTime,
      status: session.status,
      live: live.owned,
      liveness: live.owned ? "alive" : `stale: ${live.reason}`,
      registeredAt: session.registeredAt,
      lastHeartbeat: session.lastHeartbeat,
    };
  });
}

export { processStartTime };

export function registerSession(...args) {
  return withStateTransaction(() => registerSessionLocked(...args));
}

export function heartbeatSession(...args) {
  return withStateTransaction(() => heartbeatSessionLocked(...args));
}

export function setSessionStatus(...args) {
  return withStateTransaction(() => setSessionStatusLocked(...args));
}

export function registerDisposableJob(input) {
  return withStateTransaction(() => {
    if (
      !input?.id ||
      typeof input.id !== "string" ||
      !Number.isSafeInteger(input.pid) ||
      input.pid <= 0 ||
      !input.startTime
    )
      throw new Error("Disposable jobs need an ID, PID and exact start identity");
    assertOwned(input.pid, input.startTime, "disposable registration");
    const sessions = listSessions();
    if (sessions.some((session) => session.pid === input.pid && session.live))
      throw new Error("An agent session cannot be registered disposable");
    const processRow = listProcesses().find((row) => row.pid === input.pid);
    if (
      !processRow ||
      (processRow.ppid !== process.pid &&
        !sessions.some((session) => session.pid === processRow.ppid && session.live))
    )
      throw new Error(
        "Only disposable children of this caller or a registered live producer may be registered",
      );
    const state = readJson("jobs.json", { jobs: [] });
    const prior = state.jobs.find((job) => job.id === input.id);
    if (prior && (prior.pid !== input.pid || prior.startTime !== input.startTime))
      throw new Error("Disposable job ID already belongs to another process");
    const job = {
      id: input.id,
      pid: input.pid,
      startTime: input.startTime,
      disposable: true,
      parentPid: processRow.ppid,
      parentStartTime: processStartTime(processRow.ppid),
      registeredAt: new Date().toISOString(),
    };
    if (!prior) state.jobs.push(job);
    writeJson("jobs.json", state);
    audit("disposable.registered", job);
    return prior || job;
  });
}
