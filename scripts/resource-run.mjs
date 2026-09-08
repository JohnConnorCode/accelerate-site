import { withStateTransaction } from "./supervisor/state.mjs";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { processStartTime } from "./supervisor/identity.mjs";

// Shared across this user's worktrees, not just one checkout.
export const lockPath = join(tmpdir(), `accelerate-heavy-job-${process.getuid?.() ?? "user"}`);
const GiB = 1024 ** 3;

function acquireLockLocked(directory = lockPath) {
  const ownerToken = randomUUID();
  try {
    mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner = "Owner information unavailable.";
    try {
      owner = readFileSync(join(directory, "owner.json"), "utf8");
    } catch {
      /* fail closed */
    }
    throw new Error(
      `Another heavy job holds ${directory}. ${owner}\nInspect the owner before removing an abandoned lock; no automatic takeover.`,
    );
  }
  try {
    writeFileSync(
      join(directory, "owner.json"),
      JSON.stringify({
        ownerToken,
        pid: process.pid,
        cwd: process.cwd(),
        started: new Date().toISOString(),
        // Supervisor-visible identity fields. Extra fields are ignored by
        // older readers and let the machine-wide queue judge liveness
        // without relying on a bare PID, which the kernel recycles.
        kind: "heavy",
        repo: process.cwd(),
        startTime: processStartTime(process.pid),
      }),
      { mode: 0o600 },
    );
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return () =>
    withStateTransaction(() => {
      let current;
      try {
        current = JSON.parse(readFileSync(join(directory, "owner.json"), "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      if (current.ownerToken !== ownerToken)
        throw new Error("Resource slot owner changed; replacement holder preserved");
      rmSync(directory, { recursive: true, force: true });
    });
}

export function acquireLock(directory = lockPath) {
  return withStateTransaction(() => acquireLockLocked(directory));
}

export function checkCapacity({ availableBytes, freePercent }, starting = true) {
  const minimum = starting ? 5 : 2;
  if (availableBytes < minimum * GiB)
    throw new Error(
      `Only ${(availableBytes / GiB).toFixed(1)} GiB disk available; ${minimum} GiB required for ${starting ? "starting" : "continuing"} a heavy job.`,
    );
  if (freePercent !== null && freePercent < 20)
    throw new Error(
      `macOS memory availability is ${freePercent}%; heavy work requires at least 20%.`,
    );
}

function capacity() {
  const disk = statfsSync(process.cwd());
  let freePercent = null;
  if (process.platform === "darwin") {
    const output = execFileSync("/usr/bin/memory_pressure", [], {
      encoding: "utf8",
      timeout: 5000,
    });
    const match = output.match(/System-wide memory free percentage:\s*(\d+)%/);
    if (!match) throw new Error("Cannot determine macOS memory availability; heavy work paused.");
    freePercent = Number(match[1]);
  }
  return { availableBytes: disk.bavail * disk.bsize, freePercent };
}

export function groupRss(output, group) {
  return output
    .trim()
    .split("\n")
    .reduce((sum, line) => {
      const [pgid, rss] = line.trim().split(/\s+/).map(Number);
      return sum + (pgid === group && Number.isFinite(rss) ? rss * 1024 : 0);
    }, 0);
}

export function processGroupExists(output, group) {
  return output
    .trim()
    .split(/\s+/)
    .some((value) => Number(value) === group);
}

function readProcessGroups() {
  return execFileSync("ps", ["-axo", "pgid="], { encoding: "utf8", timeout: 5000 });
}

// Supervisor delegation: when installed and enabled, the machine-wide queue
// replaces the repository-scoped lock instead of stacking under it, so one
// admission point governs every enrolled repository. Callers passing an
// explicit directory (tests, special cases) keep the legacy lock. Admission
// refuses under pressure and waits FIFO; tickets from dead requesters are
// pruned by the queue, never taken over by force.
async function acquireGate({ directory, supervise }) {
  const { installed, loadConfig } = await import("./supervisor/state.mjs");
  const enabled =
    process.env.ACCELERATE_SUPERVISOR_DISABLE !== "1" &&
    (supervise === true ||
      (supervise === undefined && installed() && loadConfig().manageHeavyJobs));
  if (!enabled || (supervise === undefined && directory !== lockPath))
    return acquireLock(directory);
  const { requestTicket, admitTicket, releaseTicket } = await import("./supervisor/queue.mjs");
  const { ticket } = requestTicket({ repo: process.cwd(), kind: "heavy" });
  const requestedPoll = Number(process.env.ACCELERATE_SUPERVISOR_POLL_MS || 1000);
  const pollMs = Number.isFinite(requestedPoll)
    ? Math.max(250, Math.min(10000, requestedPoll))
    : 1000;
  for (;;) {
    const decision = admitTicket(ticket);
    if (decision.admitted) return () => releaseTicket(ticket);
    // A stale lock needs an explicit operator recovery; spinning on it would
    // hide the exact failure this supervisor exists to surface.
    if (decision.stale) {
      releaseTicket(ticket);
      throw new Error(`${decision.reason} ${decision.recovery || ""}`.trim());
    }
    console.log(
      `Heavy queue: not admitted (${decision.reason}${decision.recovery ? `; ${decision.recovery}` : ""}). Waiting.`,
    );
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

export async function runHeavyJob(
  command,
  args,
  {
    directory = lockPath,
    readCapacity = capacity,
    monitorInterval = 10000,
    readGroups = readProcessGroups,
    supervise,
  } = {},
) {
  if (!command) throw new Error("Usage: npm run resources:run -- <command> [args...]");
  const release = await acquireGate({ directory, supervise });
  let child;
  let timer;
  let killTimer;
  let stopped = false;
  const signal = (value) => {
    if (!child?.pid) return;
    try {
      if (process.platform === "win32") child.kill(value);
      else process.kill(-child.pid, value);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    signal("SIGTERM");
    killTimer = setTimeout(() => signal("SIGKILL"), 5000);
  };
  try {
    checkCapacity(readCapacity());
    console.log(
      "Resource gate: one heavy job, 2 GiB Node heap per process, 3 GiB process-group RSS ceiling, disk/memory monitoring.",
    );
    child = spawn(command, args, {
      stdio: "inherit",
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=2048`,
        UV_THREADPOOL_SIZE: "2",
      },
    });
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    timer = setInterval(() => {
      try {
        checkCapacity(readCapacity(), false);
        if (process.platform !== "win32") {
          const processes = execFileSync("ps", ["-axo", "pgid=,rss="], {
            encoding: "utf8",
            timeout: 5000,
          });
          if (groupRss(processes, child.pid) > 3 * GiB)
            throw new Error(
              "Heavy job exceeded 3 GiB resident memory; stopping its process group.",
            );
        }
      } catch (error) {
        console.error(error.message);
        stop();
      }
    }, monitorInterval);
    return await new Promise((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolveExit(stopped ? 1 : (code ?? 1)));
    });
  } finally {
    clearInterval(timer);
    clearTimeout(killTimer);
    try {
      // The leader has exited. Signal only a group that still has descendants;
      // Avoid signalling an already-retired process group.
      if (
        child?.pid &&
        (process.platform === "win32" || processGroupExists(readGroups(), child.pid))
      )
        signal("SIGKILL");
    } finally {
      // Failed cleanup remains a failed job, but cannot strand its global lock.
      process.removeListener("SIGINT", stop);
      process.removeListener("SIGTERM", stop);
      release();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [command, ...args] = process.argv.slice(2);
  runHeavyJob(command, args)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`Heavy work paused: ${error.message}`);
      process.exitCode = 1;
    });
}
