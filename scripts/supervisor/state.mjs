import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  appendFileSync,
  renameSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// All supervisor state lives per-user outside every repository: no locks,
// session records, or audit trails ever enter Git. Tests isolate with
// ACCELERATE_SUPERVISOR_DIR pointing at a scratch directory.
export function stateDir() {
  return process.env.ACCELERATE_SUPERVISOR_DIR || join(homedir(), ".accelerate-supervisor");
}

export function ensureStateDir() {
  mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
}

export function readJson(name, fallback) {
  try {
    return JSON.parse(readFileSync(join(stateDir(), name), "utf8"));
  } catch {
    return fallback;
  }
}

// Atomic durable writes: temp file plus rename, so a crash can never leave a
// half-written registry, queue, or config behind.
export function writeJson(name, value) {
  ensureStateDir();
  const target = join(stateDir(), name);
  const temp = `${target}.tmp.${process.pid}`;
  writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(temp, target);
}

// Append-only lifecycle audit. Failures to audit never break the caller: the
// audit trail is evidence, not a gate.
export function audit(event, detail = {}) {
  try {
    ensureStateDir();
    appendFileSync(
      join(stateDir(), "audit.log.jsonl"),
      `${JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, event, detail })}\n`,
      { mode: 0o600 },
    );
  } catch {
    /* evidence must not break execution */
  }
}

export function defaultConfig() {
  return {
    version: 1,
    manageHeavyJobs: false,
    maxHeavyJobs: 1,
    pressure: {
      memFreeRefusePct: 20,
      memFreeClearPct: 28,
      memFreeCriticalPct: 10,
      swapUsedRefusePct: 80,
      swapUsedClearPct: 70,
      swapUsedCriticalPct: 92,
      diskMinGiB: 5,
      diskClearGiB: 7,
    },
    disposableCancel: false,
    enrolledRepos: [],
  };
}

export function loadConfig() {
  const stored = readJson("config.json", null);
  if (!stored || typeof stored !== "object") return defaultConfig();
  return { ...defaultConfig(), ...stored, pressure: { ...defaultConfig().pressure, ...(stored.pressure || {}) } };
}

export function saveConfig(patch) {
  const next = { ...loadConfig(), ...patch };
  writeJson("config.json", next);
  audit("config.saved", { manageHeavyJobs: next.manageHeavyJobs, maxHeavyJobs: next.maxHeavyJobs });
  return next;
}

export function installed() {
  return readJson("config.json", null) !== null;
}
