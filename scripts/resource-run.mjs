import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Shared across this user's worktrees, not just one checkout.
export const lockPath = join(tmpdir(), `accelerate-heavy-job-${process.getuid?.() ?? "user"}`);
const GiB = 1024 ** 3;

export function acquireLock(directory = lockPath) {
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
      JSON.stringify({ pid: process.pid, cwd: process.cwd(), started: new Date().toISOString() }),
      { mode: 0o600 },
    );
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
  return () => rmSync(directory, { recursive: true, force: true });
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

export async function runHeavyJob(
  command,
  args,
  { directory = lockPath, readCapacity = capacity, monitorInterval = 10000 } = {},
) {
  if (!command) throw new Error("Usage: npm run resources:run -- <command> [args...]");
  const release = acquireLock(directory);
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
    // Descendants belong to this invocation, including an abandoned QA browser.
    signal("SIGKILL");
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    release();
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
