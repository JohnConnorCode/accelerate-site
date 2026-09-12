#!/usr/bin/env tsx
/**
 * Provider-neutral backlog execution entrypoint.
 *
 * Natural-language agent instructions point here indirectly through AGENTS.md;
 * the user does not need to know this command. It performs setup/preflight,
 * delegates the canonical claim to agent-dispatch, repairs only deterministic
 * generated report drift in a fresh worker checkout, then emits a bounded
 * continuation packet. It never reviews, merges, deploys, or prints secrets.
 */
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import { repositoryContext } from "./lib/developer-workspace.mjs";
import { taskPacket } from "./lib/task-context";

import { loadAgentConfiguration, type AgentProfile as Profile } from "./lib/agent-profile.mjs";

type RunnerStatus = "SETUP_REQUIRED" | "PREFLIGHT_BLOCKED" | "NO_READY_WORK" | "READY_FOR_WORK";

const appRoot = repositoryContext(process.cwd()).root!;
const context = repositoryContext(appRoot);
const profilePath = resolve(
  context.common,
  process.env.ACCELERATE_AGENT_PROFILE_PATH ?? "work-board-agent.json",
);
const localOperatorProfilePath = resolve(context.common, "work-board-operator.json");
const args = process.argv.slice(2);
const json = args.includes("--json");
const full = args.includes("--full");
const setup = args.includes("--setup");
const cardIndex = args.indexOf("--card");
const card = cardIndex >= 0 ? args[cardIndex + 1] : undefined;

function fail(message: string, status: RunnerStatus = "PREFLIGHT_BLOCKED"): never {
  const result = { status, message, next: setupInstructions() };
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.error(`${status}: ${message}\n${result.next}`);
  process.exit(1);
}

function setupInstructions() {
  return "Use the already configured private board profile when present. For a remote board, run `npm run agent:setup -- --env-file /absolute/path/to/.env.agent.local`; for an owner-authorized local board, run `npm run agent:setup -- --local-operator --project <project-key> --env-file /absolute/path/to/.env.local`. Credentials remain in the private env file and are never stored in the profile.";
}

function loadConfiguration() {
  const profile = loadAgentConfiguration(context);
  if (profile?.transport === "local-operator") {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      fail(
        "The configured local operator profile cannot find the existing Supabase configuration.",
        "SETUP_REQUIRED",
      );
    return profile;
  }
  if (!process.env.WORK_BOARD_URL || !process.env.WORK_BOARD_TOKEN)
    fail("Board credentials are not configured; no card was claimed.", "SETUP_REQUIRED");
  return profile;
}

function runPickupPreflight() {
  const check = spawnSync("npm", ["run", "verify:agent-contract", "--", "--pickup"], {
    cwd: appRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (check.stdout) process.stderr.write(check.stdout);
  if (check.stderr) process.stderr.write(check.stderr);
  if (check.status !== 0)
    fail(
      "Repository preflight found a contract or card defect. Resolve the named failure before claiming work.",
    );
}

function runDispatch(profile: Profile | null) {
  const dispatchArgs = ["tsx", "scripts/agent-dispatch.ts", "next"];
  if (card) dispatchArgs.push("--card", card);
  const attemptIndex = args.indexOf("--attempt");
  if (attemptIndex >= 0) dispatchArgs.push("--attempt", args[attemptIndex + 1]!);
  // Fetch the raw card once; the runner applies the compact task-context
  // projection locally and keeps --full as an explicit diagnostic escape hatch.
  dispatchArgs.push("--full");
  dispatchArgs.push("--json");
  if (profile?.transport === "local-operator")
    dispatchArgs.push("--local-operator", "--project", profile.project);
  const child = spawnSync("npx", dispatchArgs, {
    cwd: appRoot,
    env: process.env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.status !== 0) {
    const message = (child.stderr || child.stdout || "Work-board pickup failed").trim();
    const noReady = /No ready Now\/Next ticket/i.test(message);
    fail(message, noReady ? "NO_READY_WORK" : "PREFLIGHT_BLOCKED");
  }
  try {
    return JSON.parse(child.stdout);
  } catch {
    fail(
      "The canonical dispatcher returned an invalid packet; preserve its request key and ask the maintainer to inspect the claim.",
    );
  }
}

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function repairGeneratedReport(worktree: string | null | undefined) {
  if (!worktree || !existsSync(resolve(worktree, "docs/NORTHSTAR-BUILD-PLAN.md")))
    return { status: "not_applicable" as const };
  const before = git(worktree, ["status", "--porcelain"]);
  if (before.status !== 0)
    return { status: "blocked", message: "Cannot inspect worker checkout status." };
  if (before.stdout)
    return {
      status: "preserved" as const,
      message: "Worker checkout already contains changes; generated files were not touched.",
    };
  const generated = spawnSync(process.execPath, ["scripts/generate-northstar-build-plan.mjs"], {
    cwd: worktree,
    encoding: "utf8",
  });
  if (generated.status !== 0)
    return {
      status: "blocked" as const,
      message:
        "Generated build-plan repair failed; preserve the claim and inspect the worker checkout.",
    };
  const changed = git(worktree, ["status", "--porcelain", "--", "docs/NORTHSTAR-BUILD-PLAN.md"]);
  if (!changed.stdout) return { status: "clean" as const };
  const staged = git(worktree, ["add", "docs/NORTHSTAR-BUILD-PLAN.md"]);
  if (staged.status !== 0)
    return { status: "blocked" as const, message: "Could not stage generated build-plan repair." };
  const committed = git(worktree, [
    "commit",
    "-m",
    "chore: refresh generated northstar build plan",
  ]);
  if (committed.status !== 0)
    return {
      status: "blocked" as const,
      message:
        "Could not commit generated build-plan repair; preserve the claim and inspect the worker checkout.",
    };
  return { status: "repaired" as const, commit: git(worktree, ["rev-parse", "HEAD"]).stdout };
}

function main() {
  if (
    args.some(
      (arg) =>
        arg.startsWith("--") &&
        ![
          "--json",
          "--full",
          "--setup",
          "--card",
          "--env-file",
          "--local-operator",
          "--project",
          "--capabilities",
          "--attempt",
        ].includes(arg),
    )
  )
    fail("Use only --json, --full, or --card <key> with the natural-language runner.");
  if (setup) {
    const envIndex = args.indexOf("--env-file");
    const envFile = envIndex >= 0 ? args[envIndex + 1] : undefined;
    const localOperator = args.includes("--local-operator");
    const projectIndex = args.indexOf("--project");
    const project = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
    if (!envFile || !isAbsolute(envFile) || !existsSync(envFile))
      fail("Setup requires an existing absolute --env-file path.", "SETUP_REQUIRED");
    const localProject = project ?? "";
    const capabilityIndex = args.indexOf("--capabilities");
    const capabilities = capabilityIndex < 0 ? [] : (args[capabilityIndex + 1] ?? "").split(",");
    if (capabilities.length > 50 || capabilities.some((c) => !/^[a-z0-9-]{1,80}$/.test(c)))
      fail("Capabilities must be comma-separated named skills, never wildcards.");
    if (localOperator && !/^[a-z0-9-]{1,80}$/.test(localProject))
      fail("Local operator setup requires --project <project-key>.", "SETUP_REQUIRED");
    mkdirSync(context.common, { recursive: true });
    const profile: Profile = localOperator
      ? { version: 1, transport: "local-operator", project: localProject, envFile, capabilities }
      : { version: 1, transport: "https", envFile };
    const destination = localOperator ? localOperatorProfilePath : profilePath;
    writeFileSync(destination, JSON.stringify(profile, null, 2) + "\n", { mode: 0o600 });
    chmodSync(destination, 0o600);
    const result = { status: "CONFIGURED", profile: destination, transport: profile.transport };
    console.log(
      json
        ? JSON.stringify(result, null, 2)
        : `CONFIGURED: ${destination} (credentials remain in the env file)`,
    );
    return;
  }
  const profile = loadConfiguration();
  runPickupPreflight();
  const rawPacket = runDispatch(profile);
  const compactPacket = {
    ...taskPacket(rawPacket),
    worktree: rawPacket.worktree ?? null,
    controlCheckout: rawPacket.controlCheckout ?? appRoot,
    attemptId: rawPacket.attemptId ?? rawPacket.work_attempt_id,
    ...(rawPacket.checkpointWarning ? { checkpointWarning: rawPacket.checkpointWarning } : {}),
  };
  const packet = full ? rawPacket : compactPacket;
  const repair = repairGeneratedReport(rawPacket.worktree);
  if (repair.status === "blocked") fail(repair.message);
  const result = {
    status: "READY_FOR_WORK" as const,
    packet,
    repair,
    lifecycle: {
      cwd: appRoot,
      card: rawPacket.seed_key ?? rawPacket.id,
      attemptId: rawPacket.attemptId ?? rawPacket.work_attempt_id,
      heartbeat: [
        "npm",
        "run",
        "agent:heartbeat",
        "--",
        "--card",
        rawPacket.seed_key ?? rawPacket.id,
        ...(rawPacket.attemptId || rawPacket.work_attempt_id
          ? ["--attempt", rawPacket.attemptId ?? rawPacket.work_attempt_id]
          : []),
      ],
      ...(rawPacket.attemptId || rawPacket.work_attempt_id
        ? {
            run: [
              "npm",
              "run",
              "agent:run",
              "--",
              "--card",
              rawPacket.seed_key ?? rawPacket.id,
              "--attempt",
              rawPacket.attemptId ?? rawPacket.work_attempt_id,
              "--",
              "<verification command>",
              "<arguments>",
            ],
            progress: [
              "npm",
              "run",
              "agent:progress",
              "--",
              "--card",
              rawPacket.seed_key ?? rawPacket.id,
              "--attempt",
              rawPacket.attemptId ?? rawPacket.work_attempt_id,
              "--message",
              "<what changed and what remains>",
            ],
            checkpoint: [
              "npm",
              "run",
              "agent:checkpoint",
              "--",
              "--card",
              rawPacket.seed_key ?? rawPacket.id,
              "--attempt",
              rawPacket.attemptId ?? rawPacket.work_attempt_id,
              "--checkpoint-file",
              "<absolute JSON path including explicit new source files>",
            ],
          }
        : {}),
      submit: [
        "npm",
        "run",
        "agent:complete",
        "--",
        "--card",
        rawPacket.seed_key ?? rawPacket.id,
        ...(rawPacket.attemptId || rawPacket.work_attempt_id
          ? ["--attempt", rawPacket.attemptId ?? rawPacket.work_attempt_id]
          : []),
        "--evidence-file",
        "<absolute evidence file path>",
      ],
      instruction:
        "Run board lifecycle commands from this control checkout, including for worker bases that predate profile support. Edit source only in the worker checkout. agent:run resolves that workspace automatically and checkpoints tracked changes before starting verification there; use checkpoint to include explicit new source files.",
    },
    instruction:
      "Continue in the printed worktree. Implement every acceptance item, run the packet checks, repair failures, commit the exact result, create evidence, and submit it using the printed control-checkout lifecycle commands. Stop only after HANDOFF_SUBMITTED or an explicit operator-required block. Review, merge, and deployment are separate.",
  };
  if (json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("READY_FOR_WORK");
    console.log(`Worktree: ${packet.worktree ?? packet.controlCheckout ?? appRoot}`);
    console.log(`Card: ${packet.key ?? packet.id} — ${packet.title}`);
    console.log(result.instruction);
    if (repair.status === "repaired") console.log(`Generated report repaired in ${repair.commit}.`);
  }
}

main();
