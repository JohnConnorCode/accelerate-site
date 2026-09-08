import { randomUUID } from "node:crypto";
import { readJson, writeJson, audit } from "./state.mjs";
import { listProcesses, processStartTime } from "./identity.mjs";

// Agent session registry. Records are metadata only: provider, durable
// thread ID, repository/worktree, task label, PID plus process start
// identity, and lifecycle status. Transcripts, prompts, tool output, and
// secrets are never fields here and must never be added.
const STORE = "sessions.json";

function load() {
  const stored = readJson(STORE, null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  return stored;
}

function save(sessions) {
  writeJson(STORE, sessions);
}

function livePid(pid) {
  return Number.isInteger(pid) && pid > 0 && processStartTime(pid) !== null;
}

export function registerSession(record) {
  const { provider, threadId, repo, worktree, task, pid, disposable = false } = record ?? {};
  for (const [key, value] of Object.entries({ provider, threadId, repo, task })) {
    if (typeof value !== "string" || !value.trim())
      throw new Error(`Cannot register session: ${key} is required.`);
  }
  if (!livePid(pid)) throw new Error(`Cannot register session: pid ${pid} is not running.`);
  const startTime = processStartTime(pid);
  const sessions = load();
  for (const existing of Object.values(sessions)) {
    if (
      existing.status !== "exited" &&
      existing.provider === provider &&
      existing.threadId === threadId &&
      livePid(existing.pid) &&
      processStartTime(existing.pid) === existing.startTime
    ) {
      throw new Error(
        `Refusing duplicate writer for ${provider} thread ${threadId}: session ${existing.id} still owns it.`,
      );
    }
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  sessions[id] = {
    id,
    provider,
    threadId,
    repo: repo ?? null,
    worktree: worktree ?? null,
    task,
    pid,
    startTime,
    disposable,
    managed: true,
    status: "running",
    pausedBy: null,
    createdAt: now,
    updatedAt: now,
  };
  save(sessions);
  audit("session.registered", { id, provider, threadId, pid });
  return sessions[id];
}

export function heartbeatSession(id) {
  const sessions = load();
  const session = sessions[id];
  if (!session) throw new Error(`Unknown session ${id}.`);
  if (!livePid(session.pid) || processStartTime(session.pid) !== session.startTime) {
    session.status = "exited";
    session.updatedAt = new Date().toISOString();
    save(sessions);
    audit("session.exited", { id });
    return session;
  }
  session.updatedAt = new Date().toISOString();
  save(sessions);
  return session;
}

export function completeSession(id) {
  const sessions = load();
  const session = sessions[id];
  if (!session) throw new Error(`Unknown session ${id}.`);
  session.status = "exited";
  session.updatedAt = new Date().toISOString();
  save(sessions);
  audit("session.completed", { id });
  return session;
}

export function getSession(id) {
  const session = load()[id];
  if (!session) throw new Error(`Unknown session ${id}.`);
  return session;
}

export function setSessionStatus(id, status, extra = {}) {
  const sessions = load();
  const session = sessions[id];
  if (!session) throw new Error(`Unknown session ${id}.`);
  Object.assign(session, { status, updatedAt: new Date().toISOString() }, extra);
  save(sessions);
  return session;
}

// Read-only join of the registry against live processes. Unmanaged rows are
// observation only: callers must re-validate ownership before any signal.
export function listSessions({ inventory = null } = {}) {
  const sessions = Object.values(load());
  const live = new Map((inventory ?? listProcesses()).map((row) => [row.pid, row]));
  const managedPids = new Set();
  const managed = sessions.map((session) => {
    const row = live.get(session.pid);
    const alive = Boolean(row) && row.startTime === session.startTime;
    if (alive) managedPids.add(session.pid);
    return { ...session, alive, managed: true };
  });
  const unmanaged = [];
  for (const row of live.values()) {
    if (managedPids.has(row.pid)) continue;
    if (looksLikeAgent(row.command)) unmanaged.push({ ...row, managed: false });
  }
  return { managed, unmanaged };
}

const AGENT_COMMAND_HINTS = [
  /(^|\/)(codex)(\s|$)/,
  /(^|\/)(claude)(\s|$)/,
  /opencode/,
  /cursor-agent/,
  /aider/,
];

export function looksLikeAgent(command) {
  const text = String(command ?? "");
  if (/node .*supervisor\.mjs/.test(text)) return false;
  return AGENT_COMMAND_HINTS.some((hint) => hint.test(text));
}

// Restart recovery: reattach an exited-registry session to a replacement
// process using the original provider session ID (provider plus thread ID).
// Exactly one live claimant may hold a thread: any other live session for
// the same thread refuses the recovery as a duplicate writer. The new PID is
// adopted with its fresh start identity and audited; callers must pass a PID
// they spawned themselves, because a recycled PID cannot be distinguished
// from the replacement by inspection alone. Ongoing heartbeats re-validate.
export function recoverSession(id, { candidatePid = null } = {}) {
  const sessions = load();
  const session = sessions[id];
  if (!session) throw new Error(`Unknown session ${id}.`);
  if (session.status !== "exited") throw new Error(`Session ${id} is ${session.status}, not exited.`);
  for (const other of Object.values(sessions)) {
    if (
      other.id !== id &&
      other.status !== "exited" &&
      other.provider === session.provider &&
      other.threadId === session.threadId &&
      livePid(other.pid) &&
      processStartTime(other.pid) === other.startTime
    ) {
      throw new Error(
        `Refusing recovery of ${id}: session ${other.id} already writes ${session.provider} thread ${session.threadId}.`,
      );
    }
  }
  if (!livePid(candidatePid))
    return {
      recovered: false,
      reason: `candidate pid ${candidatePid} is not running`,
      context: "registry holds metadata only; missing or unflushed context is never reconstructed",
    };
  session.pid = candidatePid;
  session.startTime = processStartTime(candidatePid);
  session.status = "running";
  session.pausedBy = null;
  session.updatedAt = new Date().toISOString();
  save(sessions);
  audit("session.recovered", { id, pid: candidatePid });
  return {
    recovered: true,
    session,
    context: "resumed from the original provider thread ID; verify provider-side state before trusting recent context",
  };
}
