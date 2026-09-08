import { execFileSync } from "node:child_process";

// Process identity for safe signaling. PIDs are recycled by the kernel, so a
// bare PID never authorizes a signal: every signal site must first validate
// that the live process with that PID is the same one that was registered.
// A mismatch fails closed with a named error. Never signal on mismatch.
export function processStartTime(pid) {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "lstart="], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

export function processState(pid) {
  try {
    const output = execFileSync("ps", ["-p", String(pid), "-o", "state="], {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

export function pidOwned(pid, startTime) {
  const current = processStartTime(pid);
  if (!current) return { owned: false, reason: `pid ${pid} is not running` };
  if (startTime && current !== startTime)
    return {
      owned: false,
      reason: `pid ${pid} was reused (registered ${startTime}, now ${current})`,
    };
  return { owned: true, startTime: current };
}

export function assertOwned(pid, startTime, purpose) {
  const check = pidOwned(pid, startTime);
  if (!check.owned) throw new Error(`Refusing ${purpose}: ${check.reason}.`);
  return check.startTime;
}

export function selfIdentity() {
  return { pid: process.pid, startTime: processStartTime(process.pid) };
}

const PS_LINE = /^\s*(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/;

// Read-only process inventory. Listing is observation, never control: callers
// that act on these rows must re-validate ownership first.
export function listProcesses(run = execFileSync) {
  let output;
  try {
    output = run("ps", ["-axo", "pid=,ppid=,lstart=,command="], {
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    return [];
  }
  const rows = [];
  for (const line of String(output).split("\n")) {
    const match = PS_LINE.exec(line);
    if (!match) continue;
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      startTime: match[3].trim(),
      command: match[4].trim(),
    });
  }
  return rows;
}
