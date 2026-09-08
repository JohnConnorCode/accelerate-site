import { mkdirSync, readFileSync, appendFileSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function stateDir() {
  return process.env.ACCELERATE_SUPERVISOR_DIR || join(homedir(), ".accelerate-supervisor");
}
export function ensureStateDir() {
  mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
}
let connection = null;
let connectionDir = null;
/** One bounded cross-process transaction covers the whole read/modify/write.
 * SQLite releases a crashed owner's lock; no PID-based lock takeover is needed. */
export function withStateTransaction(work) {
  if (connection) {
    if (connectionDir !== stateDir())
      throw new Error("Supervisor state directory changed inside a transaction");
    return work();
  }
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 16))
    throw new Error("Machine supervision requires Node.js 22.16 or newer");
  ensureStateDir();
  const { DatabaseSync } = require("node:sqlite");
  const path = join(stateDir(), "state.sqlite");
  const db = new DatabaseSync(path, { timeout: 5000 });
  chmodSync(path, 0o600);
  try {
    db.exec(
      "PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (name TEXT PRIMARY KEY, value TEXT NOT NULL); BEGIN IMMEDIATE;",
    );
    connection = db;
    connectionDir = stateDir();
    const result = work();
    if (result && typeof result.then === "function")
      throw new Error("Supervisor transactions must be synchronous");
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* BEGIN may have refused a busy database. */
    }
    throw error;
  } finally {
    connection = null;
    connectionDir = null;
    db.close();
  }
}
export function readJson(name, fallback) {
  return withStateTransaction(() => {
    if (!/^[a-z-]+\.json$/.test(name)) throw new Error("Invalid supervisor state name");
    const row = connection.prepare("SELECT value FROM state WHERE name=?").get(name);
    if (row) return JSON.parse(row.value);
    // Import a prior handoff's JSON once; preserve it as historical evidence.
    let value = fallback;
    try {
      value = JSON.parse(readFileSync(join(stateDir(), name), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          `Supervisor ${name} is unreadable; preserve and repair the state before continuing`,
        );
    }
    connection
      .prepare("INSERT INTO state(name,value) VALUES(?,?)")
      .run(name, JSON.stringify(value));
    return structuredClone(value);
  });
}
export function writeJson(name, value) {
  return withStateTransaction(() => {
    if (!/^[a-z-]+\.json$/.test(name)) throw new Error("Invalid supervisor state name");
    connection
      .prepare(
        "INSERT INTO state(name,value) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value",
      )
      .run(name, JSON.stringify(value));
  });
}
export function audit(event, detail = {}) {
  ensureStateDir();
  // Audit failure is surfaced. Process-control callers record intent before
  // signaling and an outcome after; they never manufacture a successful receipt.
  appendFileSync(
    join(stateDir(), "audit.log.jsonl"),
    JSON.stringify({ ts: new Date().toISOString(), pid: process.pid, event, detail }) + "\n",
    { mode: 0o600 },
  );
}
export function defaultConfig() {
  return {
    version: 2,
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
  const defaults = defaultConfig();
  const config = stored
    ? { ...defaults, ...stored, pressure: { ...defaults.pressure, ...stored.pressure } }
    : defaults;
  if (
    config.maxHeavyJobs !== 1 ||
    typeof config.manageHeavyJobs !== "boolean" ||
    typeof config.disposableCancel !== "boolean" ||
    !Array.isArray(config.enrolledRepos) ||
    config.enrolledRepos.some((repo) => typeof repo !== "string")
  )
    throw new Error("Invalid supervisor configuration; exactly one heavy slot is supported");
  for (const [key, value] of Object.entries(config.pressure))
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid pressure threshold ${key}`);
  if (config.pressure.diskMinGiB < 5 || config.pressure.memFreeRefusePct < 20)
    throw new Error("Supervisor thresholds cannot weaken the shared resource gate");
  const p = config.pressure;
  if (!(
    p.memFreeCriticalPct <= p.memFreeRefusePct &&
    p.memFreeRefusePct < p.memFreeClearPct &&
    p.memFreeClearPct <= 100 &&
    p.swapUsedClearPct < p.swapUsedRefusePct &&
    p.swapUsedRefusePct < p.swapUsedCriticalPct &&
    p.swapUsedCriticalPct <= 100 &&
    p.diskClearGiB >= p.diskMinGiB
  ))
    throw new Error("Invalid pressure hysteresis bands");
  return config;
}
export function saveConfig(patch) {
  return withStateTransaction(() => {
    const next = { ...loadConfig(), ...patch };
    writeJson("config.json", next);
    const validated = loadConfig();
    audit("config.saved", {
      manageHeavyJobs: validated.manageHeavyJobs,
      maxHeavyJobs: validated.maxHeavyJobs,
    });
    return validated;
  });
}
export function installed() {
  return readJson("config.json", null) !== null;
}
