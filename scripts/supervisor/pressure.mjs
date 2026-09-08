import { execFileSync, execSync } from "node:child_process";
import { statfsSync } from "node:fs";

const GiB = 1024 ** 3;

// Pressure sampling for admission and overload tiers. Every dimension is
// best-effort and reported honestly: an unreadable dimension is null, never
// zero, and gates that need it fail closed with a named reason.
export function sampleMemory() {
  if (process.platform === "darwin") {
    try {
      const output = execFileSync("/usr/bin/memory_pressure", [], {
        encoding: "utf8",
        timeout: 5000,
      });
      const free = output.match(/System-wide memory free percentage:\s*(\d+)%/);
      const swap = execFileSync("sysctl", ["-n", "vm.swapusage"], {
        encoding: "utf8",
        timeout: 5000,
      });
      const used = swap.match(/used\s*=\s*([\d.]+)M/i);
      const total = swap.match(/total\s*=\s*([\d.]+)M/i);
      return {
        memFreePct: free ? Number(free[1]) : null,
        swapUsedPct:
          used && total && Number(total[1]) > 0 ? (Number(used[1]) / Number(total[1])) * 100 : null,
      };
    } catch {
      return { memFreePct: null, swapUsedPct: null };
    }
  }
  try {
    const text = execSync("cat /proc/meminfo", { encoding: "utf8", timeout: 5000 });
    const get = (key) => {
      const match = text.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match ? Number(match[1]) : null;
    };
    const total = get("MemTotal");
    const available = get("MemAvailable");
    const swapTotal = get("SwapTotal");
    const swapFree = get("SwapFree");
    return {
      memFreePct: total && available !== null ? (available / total) * 100 : null,
      swapUsedPct:
        swapTotal && swapFree !== null && swapTotal > 0
          ? ((swapTotal - swapFree) / swapTotal) * 100
          : null,
    };
  } catch {
    return { memFreePct: null, swapUsedPct: null };
  }
}

export function sampleDisk(path = process.cwd()) {
  try {
    const disk = statfsSync(path);
    return { diskAvailGiB: (disk.bavail * disk.bsize) / GiB };
  } catch {
    return { diskAvailGiB: null };
  }
}

export function samplePressure(path) {
  return { ...sampleMemory(), ...sampleDisk(path), sampledAt: new Date().toISOString() };
}

// Hysteresis: elevated engages at refuse thresholds and clears only at the
// wider clear thresholds, so admission does not flap at the boundary.
// Returns { level: "normal"|"elevated"|"critical", reasons[] }.
export function evaluatePressure(sample, thresholds, previous = "normal") {
  const reasons = [];
  let level = "normal";
  const memRefuse = thresholds.memFreeRefusePct;
  const memClear = thresholds.memFreeClearPct;
  const memCritical = thresholds.memFreeCriticalPct;
  if (sample.memFreePct === null) {
    reasons.push("memory pressure unreadable; memory gate fails closed");
    level = "elevated";
  } else if (sample.memFreePct < memCritical) {
    reasons.push(`memory free ${sample.memFreePct.toFixed(1)}% below critical ${memCritical}%`);
    level = "critical";
  } else if (sample.memFreePct < memRefuse) {
    reasons.push(`memory free ${sample.memFreePct.toFixed(1)}% below refuse ${memRefuse}%`);
    level = level === "critical" ? level : "elevated";
  } else if (previous !== "normal" && sample.memFreePct < memClear) {
    reasons.push(`memory free ${sample.memFreePct.toFixed(1)}% still below clear ${memClear}%`);
    level = previous === "critical" && sample.memFreePct < memRefuse ? "critical" : "elevated";
  }
  if (sample.swapUsedPct !== null) {
    if (sample.swapUsedPct > thresholds.swapUsedCriticalPct) {
      reasons.push(`swap use ${sample.swapUsedPct.toFixed(1)}% above critical`);
      level = "critical";
    } else if (sample.swapUsedPct > thresholds.swapUsedRefusePct) {
      reasons.push(`swap use ${sample.swapUsedPct.toFixed(1)}% above refuse`);
      if (level === "normal") level = "elevated";
    } else if (previous !== "normal" && sample.swapUsedPct > thresholds.swapUsedClearPct) {
      reasons.push(`swap use still above clear threshold`);
      if (level === "normal") level = "elevated";
    }
  }
  if (sample.diskAvailGiB === null) {
    reasons.push("disk availability unreadable; disk gate fails closed");
    if (level === "normal") level = "elevated";
  } else if (sample.diskAvailGiB < 2) {
    reasons.push(`disk ${sample.diskAvailGiB.toFixed(1)} GiB below critical floor`);
    level = "critical";
  } else if (sample.diskAvailGiB < thresholds.diskMinGiB) {
    reasons.push(`disk ${sample.diskAvailGiB.toFixed(1)} GiB below minimum`);
    if (level === "normal") level = "elevated";
  } else if (previous !== "normal" && sample.diskAvailGiB < thresholds.diskClearGiB) {
    reasons.push(`disk still below clear threshold`);
    if (level === "normal") level = "elevated";
  }
  return { level, reasons };
}
