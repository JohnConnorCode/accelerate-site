import { createRequire } from "node:module";
import {
  existsSync,
  accessSync,
  constants,
  realpathSync,
  readFileSync,
  openSync,
  readSync,
  closeSync,
} from "node:fs";
import { join, delimiter, dirname } from "node:path";
import { homedir } from "node:os";
import { audit, loadConfig, saveConfig } from "./state.mjs";
import { listProcesses } from "./identity.mjs";
import { listSessions } from "./sessions.mjs";

// Provider launch-path inventory and scoped enrollment. Detection is
// observation: which CLIs exist, which launch paths bypass supervision.
// Enrollment never modifies a target repository: it records consent in the
// supervisor config, preserving existing edits. Anything launched outside an
// enrolled path stays visible as unmanaged rather than silently governed.
const ADAPTERS = [
  {
    id: "codex",
    kind: "agent",
    probes: ["codex"],
    launchPaths: ["codex CLI sessions", "codex unattended runs"],
    managedHow:
      "Resume the registered original thread with supervisor recover --provider <id> --thread <id>; run its heavy tools through scripts/resource-run.mjs.",
  },
  {
    id: "claude",
    kind: "agent",
    probes: ["claude"],
    launchPaths: ["claude CLI sessions", "claude non-interactive runs"],
    managedHow:
      "Resume the registered original thread with supervisor recover --provider <id> --thread <id>; run its heavy tools through scripts/resource-run.mjs.",
  },
  {
    id: "opencode",
    kind: "agent",
    probes: ["opencode"],
    launchPaths: ["opencode interactive and headless sessions"],
    managedHow:
      "Resume the registered original thread with supervisor recover --provider <id> --thread <id>; run its heavy tools through scripts/resource-run.mjs.",
  },
  {
    id: "npm",
    kind: "direct",
    probes: ["npm", "npx"],
    launchPaths: ["direct npm/npx invocations outside any agent"],
    managedHow: "Route heavy commands through the supervised runner.",
  },
  {
    id: "browser",
    kind: "browser",
    probes: ["playwright", "chrome", "chromium", "firefox"],
    launchPaths: ["Playwright suites and headed browser jobs"],
    managedHow: "Run browser suites as admitted heavy jobs with receipts.",
  },
];

export function adapterCatalog() {
  return ADAPTERS.map((adapter) => ({ ...adapter }));
}

function whichBinary(name, run) {
  if (run) {
    try {
      return String(
        run("which", [name], {
          encoding: "utf8",
          timeout: 5000,
          stdio: ["ignore", "pipe", "ignore"],
        }),
      )
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  return (process.env.PATH || "")
    .split(delimiter)
    .filter(Boolean)
    .map((dir) => join(dir, name))
    .filter((path) => {
      try {
        accessSync(path, constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });
}

export function detectAdapters({ run } = {}) {
  const config = loadConfig();
  return ADAPTERS.map((adapter) => {
    const found = adapter.probes.flatMap((probe) =>
      whichBinary(probe, run).map((path) => ({ probe, path })),
    );
    return {
      id: adapter.id,
      kind: adapter.kind,
      found: found.length > 0,
      paths: found,
      launchPaths: adapter.launchPaths,
      managedHow: adapter.managedHow,
      bypasses: found.length
        ? [
            `${adapter.id} can still launch outside supervision via: ${found.map((f) => f.path).join(", ")}`,
          ]
        : [],
      enrolledRepos: config.enrolledRepos,
    };
  });
}

// Exact coverage report: what is managed, what can bypass, and what stronger
// isolation would be needed for hard enforcement. Never claims universal
// enforcement while bypasses exist.
export function coverageReport(options = {}) {
  const adapters = detectAdapters(options);
  const bypasses = adapters.flatMap((adapter) => adapter.bypasses);
  return {
    adapters: adapters.map(({ id, kind, found, paths, launchPaths, managedHow }) => ({
      id,
      kind,
      found,
      paths,
      launchPaths,
      managedHow,
    })),
    bypasses,
    continuation: {
      mode: "foreground-execve",
      supported: typeof process.execve === "function",
      originalThreadOnly: true,
      providerAccountAndHistory: "not-probed",
    },
    toolEntryPoint: "node scripts/resource-run.mjs <command> [args...]",
    universalEnforcement: false,
    hardEnforcementRequires: [
      "OS-level sandboxing (macOS Seatbelt profile or Linux containers/cgroups) around agent runtimes.",
      "Mandatory supervised spawn: shell integration that routes tool launches through the supervisor.",
      "Kernel or cgroup memory accounting instead of cooperative admission.",
    ],
    note: "Cooperative supervision governs enrolled paths; unrestricted agents can bypass the broker until the isolation above exists.",
  };
}

export function enrollRepo(repoPath) {
  const requested = String(repoPath || "").trim();
  const resolved = requested ? realpathSync(requested) : "";
  if (!resolved) throw new Error("A repository path is required to enroll.");
  if (!existsSync(resolved)) throw new Error(`Cannot enroll ${resolved}: path does not exist.`);
  const config = loadConfig();
  if (!config.enrolledRepos.includes(resolved)) {
    config.enrolledRepos.push(resolved);
    saveConfig({ enrolledRepos: config.enrolledRepos });
    audit("repo.enrolled", { repo: resolved });
  }
  return { enrolled: true, repo: resolved };
}

export function unenrollRepo(repoPath) {
  const config = loadConfig();
  const next = config.enrolledRepos.filter((repo) => repo !== repoPath);
  saveConfig({ enrolledRepos: next });
  audit("repo.unenrolled", { repo: repoPath });
  return { enrolled: false, repo: repoPath };
}

// Read-only cross-project inventory. Heavy-process candidates surface with
// PID, repo guess, and command; acting on them is a separate explicit step.
const HEAVY_PATTERNS = [
  /node\b.*(build|tsc|next|playwright|vitest|webpack)/,
  /\b(tsc|next|playwright|webpack|esbuild|turbopack)\b/,
  /npm\b.*run\b.*(build|test)/,
];

export function inventoryHeavyProcesses({ processes = null } = {}) {
  const rows = processes ?? listProcesses();
  const registered = new Set(
    listSessions()
      .filter((s) => s.live)
      .map((s) => s.pid),
  );
  return rows
    .filter(
      (row) =>
        HEAVY_PATTERNS.some((pattern) => pattern.test(row.command)) && row.pid !== process.pid,
    )
    .map((row) => ({
      pid: row.pid,
      ppid: row.ppid,
      startTime: row.startTime,
      command: row.command.trim().split(/\s+/)[0].slice(0, 120),
      managed: registered.has(row.pid),
    }));
}

export function githubRoots() {
  return [join(homedir(), "Documents", "GitHub")].filter((root) => existsSync(root));
}

/** Fixed provider commands preserve the original ID and the provider's permissions. */
export function providerResumeCommand(provider, threadId) {
  if (typeof threadId !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(threadId))
    throw new Error("A valid exact original thread ID is required");
  const prompt =
    "Continue the existing authorized task from the saved conversation. Inspect retained work before changing it; report missing context honestly.";
  const args = {
    codex: ["exec", "resume", threadId, prompt],
    claude: ["--resume", threadId, "--print", prompt],
    opencode: ["run", "--session", threadId, prompt],
  }[provider];
  if (!args) throw new Error("Original-thread continuation supports codex, claude and opencode");
  const executable = whichBinary(provider)[0];
  if (!executable) throw new Error(`SETUP_REQUIRED: ${provider} CLI is unavailable on PATH`);
  return { executable: directProviderExecutable(provider, executable), args };
}

function nativeExecutable(path) {
  const fd = openSync(path, "r");
  try {
    const bytes = Buffer.alloc(4);
    readSync(fd, bytes, 0, 4, 0);
    return [
      "7f454c46",
      "cffaedfe",
      "cefaedfe",
      "feedfacf",
      "feedface",
      "cafebabe",
      "bebafeca",
    ].includes(bytes.toString("hex"));
  } finally {
    closeSync(fd);
  }
}
export function directProviderExecutable(provider, executable) {
  let path = realpathSync(executable);
  if (nativeExecutable(path)) return path;
  // The official Codex npm shim spawns its native producer. Execute that
  // packaged binary directly so SIGSTOP reaches the registered producer PID.
  if (provider === "codex") {
    const packageRoot = dirname(dirname(path));
    const manifest = join(packageRoot, "package.json");
    try {
      if (JSON.parse(readFileSync(manifest, "utf8")).name !== "@openai/codex")
        throw new Error("Unrecognized Codex launcher");
      const architecture = { arm64: "aarch64", x64: "x86_64" }[process.arch];
      const target =
        process.platform === "darwin"
          ? `${architecture}-apple-darwin`
          : process.platform === "linux"
            ? `${architecture}-unknown-linux-musl`
            : null;
      if (!architecture || !target) throw new Error("Unsupported native provider platform");
      let vendor = join(packageRoot, "vendor");
      try {
        const nativePackage = createRequire(manifest).resolve(
          `@openai/codex-${process.platform}-${process.arch}/package.json`,
        );
        vendor = join(dirname(nativePackage), "vendor");
      } catch {
        /* Older official packages contain vendor directly. */
      }
      path = realpathSync(join(vendor, target, "bin", "codex"));
      accessSync(path, constants.X_OK);
      if (nativeExecutable(path)) return path;
    } catch {
      /* Never fall back to signaling a spawning wrapper. */
    }
  }
  throw new Error(
    `SETUP_REQUIRED: ${provider} needs a direct native executable; launcher wrappers cannot preserve producer ownership`,
  );
}
