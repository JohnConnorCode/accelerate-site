import { execFileSync } from "node:child_process";

// Launch-path inventory for AC6. Each adapter names a way agent or heavy
// work can start on this machine, how to detect it, whether the supervisor
// can broker it, and — when it cannot — the exact bypass. No adapter claims
// universal enforcement: any agent with unrestricted shell access can start
// work outside the broker, and hard enforcement would require stronger
// isolation (a launcher shim on PATH, a Mandatory Access Control profile, or
// a contained runner) than cooperative tooling provides.
function commandPresent(command) {
  try {
    execFileSync("/bin/sh", ["-c", `command -v ${command}`], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

export const ADAPTERS = [
  {
    name: "codex",
    kind: "agent-cli",
    detect: () => commandPresent("codex"),
    managed: true,
    route: "Wrap heavy build/typecheck/browser steps with resources:run so they join the machine queue.",
    bypass: "codex exec with an inline shell command bypasses the broker unless the agent cooperates.",
  },
  {
    name: "claude-code",
    kind: "agent-cli",
    detect: () => commandPresent("claude"),
    managed: true,
    route: "Same as codex: heavy steps go through resources:run.",
    bypass: "Bash tool calls run outside the broker unless the agent cooperates.",
  },
  {
    name: "opencode",
    kind: "agent-cli",
    detect: () => commandPresent("opencode"),
    managed: true,
    route: "Same as codex: heavy steps go through resources:run.",
    bypass: "Bash tool calls run outside the broker unless the agent cooperates.",
  },
  {
    name: "npm/npx",
    kind: "direct",
    detect: () => commandPresent("npm"),
    managed: true,
    route: "resources:run admits exactly one heavy job; direct npm calls queue behind it.",
    bypass: "A bare npm run build started by hand bypasses admission entirely.",
  },
  {
    name: "browser-qa",
    kind: "browser",
    detect: () => commandPresent("npx"),
    managed: true,
    route: "Playwright journeys run under resources:run like any other heavy job.",
    bypass: "A manually launched headed browser is visible only as an unmanaged process.",
  },
  {
    name: "workshelter",
    kind: "repository",
    detect: () => false,
    managed: false,
    route: "Enroll the Workshelter checkout path so its sessions register; rollout starts here.",
    bypass: "Unenrolled until the operator enrolls it.",
  },
  {
    name: "superdebate",
    kind: "repository",
    detect: () => false,
    managed: false,
    route: "Enroll after Workshelter proves the rollout.",
    bypass: "Unenrolled until the operator enrolls it.",
  },
];

export function coverageReport() {
  const adapters = ADAPTERS.map((adapter) => {
    let present = false;
    try {
      present = adapter.detect();
    } catch {
      present = false;
    }
    return { name: adapter.name, kind: adapter.kind, present, managed: adapter.managed };
  });
  return {
    adapters,
    managed: adapters.filter((a) => a.present && a.managed).map((a) => a.name),
    unmanaged: adapters.filter((a) => !a.present || !a.managed).map((a) => ({
      name: a.name,
      reason:
        a.kind === "repository"
          ? ADAPTERS.find((d) => d.name === a.name).bypass
          : !a.present
            ? "not installed"
            : ADAPTERS.find((d) => d.name === a.name).bypass,
    })),
    enforcement:
      "cooperative: agents with unrestricted shell access can bypass the broker; hard enforcement needs a launcher shim, MAC profile, or contained runner",
  };
}
