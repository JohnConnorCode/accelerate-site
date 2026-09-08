import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  audit,
  ensureStateDir,
  installed,
  loadConfig,
  readJson,
  saveConfig,
  writeJson,
} from "./state.mjs";
import { evaluatePressure, samplePressure } from "./pressure.mjs";
import {
  completeSession,
  getSession,
  heartbeatSession,
  listSessions,
  recoverSession,
  registerSession,
  setSessionStatus,
} from "./sessions.mjs";
import { overloadTier, pauseSession, resumeSession } from "./policy.mjs";
import { assertOwned } from "./identity.mjs";
import { coverageReport } from "./adapters.mjs";

// Machine-wide agent resource supervisor CLI. Stays light by design so it
// remains usable during low memory: status, pause, and resume import only
// these local modules and never load application code. Every command prints
// one compact JSON receipt; lifecycle changes also append to the audit log.
function receipt(command, detail = {}) {
  const out = { ok: true, command, at: new Date().toISOString(), ...detail };
  console.log(JSON.stringify(out));
  return out;
}

function fail(message) {
  console.log(JSON.stringify({ ok: false, error: message, at: new Date().toISOString() }));
  process.exitCode = 1;
}

function status() {
  ensureStateDir();
  const config = loadConfig();
  const pressure = samplePressure();
  const { level, reasons } = evaluatePressure(pressure, config.pressure);
  const { managed, unmanaged } = listSessions();
  const admissions = readJson("admissions.json", {});
  return receipt("status", {
    installed: installed(),
    manageHeavyJobs: config.manageHeavyJobs,
    maxHeavyJobs: config.maxHeavyJobs,
    pressure: { ...pressure, level, reasons },
    overloadTier: overloadTier(level),
    admissions: Object.keys(admissions).length,
    sessions: {
      running: managed.filter((s) => s.status === "running").length,
      paused: managed.filter((s) => s.status === "paused").length,
      exited: managed.filter((s) => s.status === "exited").length,
      unmanaged: unmanaged.length,
    },
  });
}

function pause(id) {
  ensureStateDir();
  try {
    const session = pauseSession(id);
    return receipt("pause", { id, status: session.status });
  } catch (error) {
    return fail(error.message);
  }
}

function resume(id) {
  ensureStateDir();
  try {
    const session = resumeSession(id);
    return receipt("resume", { id, status: session.status });
  } catch (error) {
    return fail(error.message);
  }
}

function enroll(repo, provider = "opencode") {
  ensureStateDir();
  const config = loadConfig();
  if (!config.enrolledRepos.some((entry) => entry.repo === repo)) {
    config.enrolledRepos.push({ repo, provider, enrolledAt: new Date().toISOString() });
    saveConfig({ enrolledRepos: config.enrolledRepos });
  }
  audit("repo.enrolled", { repo, provider });
  return receipt("enroll", { repo, provider });
}

function manage(on) {
  ensureStateDir();
  const config = saveConfig({ manageHeavyJobs: on });
  return receipt(on ? "install" : "uninstall-step", { manageHeavyJobs: config.manageHeavyJobs });
}

function uninstall() {
  ensureStateDir();
  const { managed } = listSessions();
  const resumed = [];
  for (const session of managed) {
    if (session.status !== "paused" || session.pausedBy?.startsWith("supervisor:") !== true)
      continue;
    try {
      resumeSession(session.id);
      resumed.push(session.id);
    } catch (error) {
      audit("uninstall.stranded", { id: session.id, reason: error.message });
    }
  }
  writeJson("admissions.json", {});
  saveConfig({ manageHeavyJobs: false });
  audit("supervisor.uninstalled", { resumed });
  const remaining = listSessions().managed.filter((s) => s.status === "paused");
  return receipt("uninstall", { resumed, strandedPaused: remaining.map((s) => s.id) });
}

function recover() {
  ensureStateDir();
  const { managed } = listSessions();
  const reconciled = [];
  for (const session of managed) {
    if (session.status !== "exited" && session.alive) continue;
    if (session.status !== "exited") {
      setSessionStatus(session.id, "exited");
      reconciled.push({ id: session.id, outcome: "marked-exited" });
      continue;
    }
    reconciled.push({ id: session.id, outcome: "already-exited" });
  }
  const admissions = readJson("admissions.json", {});
  const liveAdmissions = {};
  for (const [id, grant] of Object.entries(admissions)) {
    try {
      assertOwned(grant.pid, grant.startTime, `retain admission ${id}`);
      if (Date.now() > grant.expiresAt) throw new Error(`admission ${id} expired`);
      liveAdmissions[id] = grant;
    } catch {
      audit("admission.released-stale", { id });
    }
  }
  writeJson("admissions.json", liveAdmissions);
  audit("supervisor.recovered", { reconciled: reconciled.length });
  return receipt("recover", { reconciled, liveAdmissions: Object.keys(liveAdmissions).length });
}

function doctor() {
  ensureStateDir();
  const coverage = coverageReport();
  const config = loadConfig();
  return receipt("doctor", {
    installed: installed(),
    manageHeavyJobs: config.manageHeavyJobs,
    enrolledRepos: config.enrolledRepos,
    coverage,
  });
}

function register(args) {
  ensureStateDir();
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i]?.startsWith("--")) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    }
  }
  for (const key of ["provider", "thread", "repo", "task", "pid"]) {
    if (!flags[key]) return fail(`register requires --${key}`);
  }
  try {
    const session = registerSession({
      provider: flags.provider,
      threadId: flags.thread,
      repo: flags.repo,
      worktree: flags.worktree ?? flags.repo,
      task: flags.task,
      pid: Number(flags.pid),
      disposable: flags.disposable === "true",
    });
    return receipt("register", { id: session.id, status: session.status });
  } catch (error) {
    return fail(error.message);
  }
}

function reattach(id, args) {
  ensureStateDir();
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i]?.startsWith("--")) {
      const key = args[i].slice(2);
      flags[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    }
  }
  if (!flags.pid) return fail("reattach requires --pid <replacement process you started>");
  try {
    const result = recoverSession(id, { candidatePid: Number(flags.pid) });
    if (!result.recovered) return fail(`Recovery of ${id} not applied: ${result.reason}`);
    return receipt("reattach", {
      id,
      status: result.session.status,
      context: result.context,
      note: "one session per invocation; repeat deliberately for each thread",
    });
  } catch (error) {
    return fail(error.message);
  }
}

const COMMANDS = {
  status,
  pause,
  resume,
  enroll,
  install: manage,
  uninstall,
  doctor,
  recover,
  reattach,
  register,
};

export function run(argv) {
  const [command, ...rest] = argv;
  if (!command || !COMMANDS[command]) {
    fail(
      "Usage: supervisor.mjs <status|pause|resume|register|reattach|enroll|install|uninstall|recover|doctor> [...]",
    );
    return;
  }
  if (command === "pause" || command === "resume") {
    if (!rest[0]) return fail(`${command} requires a session id`);
    return COMMANDS[command](rest[0]);
  }
  if (command === "reattach") {
    if (!rest[0]) return fail("reattach requires a session id");
    return reattach(rest[0], rest.slice(1));
  }
  if (command === "enroll") {
    if (!rest[0]) return fail("enroll requires a repo path");
    return enroll(rest[0], rest[1]);
  }
  if (command === "install") return manage(true);
  if (command === "uninstall") return uninstall();
  if (command === "register") return register(rest);
  return COMMANDS[command]();
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run(process.argv.slice(2));
}

export { completeSession, getSession, heartbeatSession, recoverSession };
