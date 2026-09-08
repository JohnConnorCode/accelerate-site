#!/usr/bin/env node
/** Read-only first-run diagnostics. No migrations, claims, token issuance or file writes. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadAgentConfiguration } from "./lib/agent-profile.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  git,
  repositoryContext,
  boardEndpoint,
  requestBoard,
  requireBoardProtocol,
} from "./lib/developer-workspace.mjs";
import { migrationCatalog } from "./lib/migration-ledger.mjs";

import { maintainerPreflight } from "./lib/maintainer-workflow.mjs";

const flags = new Set(process.argv.slice(2));
const checks = [];
function check(id, status, detail) {
  checks.push({ id, status, detail });
}
try {
  if ([...flags].some((flag) => !["--board", "--maintainer", "--json"].includes(flag)))
    throw new Error("Usage: npm run dev:doctor -- [--board | --maintainer] [--json]");
  if (flags.has("--board") && flags.has("--maintainer"))
    throw new Error("Check board and maintainer readiness separately.");
  const major = Number(process.versions.node.split(".")[0]);
  check(
    "node",
    major >= 22 ? "pass" : "blocked",
    major >= 22 ? `Node ${major}` : "Install Node 22 or newer.",
  );
  const { root } = repositoryContext(process.cwd());
  check(
    "repository",
    "pass",
    `Current branch: ${git(root, ["branch", "--show-current"]) || "detached HEAD"}.`,
  );
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  check(
    "dependencies",
    existsSync(resolve(root, "node_modules/next/package.json")) ? "pass" : "blocked",
    "Run npm ci in this checkout when dependencies are missing; no provider credentials are required for the fictional demo.",
  );
  check(
    "hooks",
    git(root, ["config", "--get", "core.hooksPath"], true) === ".githooks" ? "pass" : "warning",
    "Run npm run hooks:install to select this checkout's versioned offline hooks.",
  );
  const catalog = migrationCatalog(root);
  check(
    "migration-catalog",
    catalog.some((m) => m.file === "migrations/20260907-work-packet-quality.sql")
      ? "pass"
      : "blocked",
    `${catalog.length} classified migrations; this checks files only, not a connected database.`,
  );
  check(
    "application-mode",
    "pass",
    "npm run dev opens the site and fictional demo without production keys. Real service tests require a maintainer-approved isolated test project.",
  );
  check(
    "verification",
    "pass",
    `Use ${pkg.scripts["verify:review"] ? "npm run verify:review" : "the repository verification contract"} and the ticket's scoped checks; local verification is separate from deployment.`,
  );
  if (flags.has("--maintainer")) checks.push(...maintainerPreflight(root));
  if (flags.has("--board")) {
    const profile = loadAgentConfiguration(repositoryContext(root));
    let result;
    if (profile?.transport === "local-operator") {
      const probe = spawnSync(
        process.execPath,
        [
          "--conditions=react-server",
          "--import",
          "tsx",
          fileURLToPath(new URL("./check-local-board.ts", import.meta.url)),
          profile.project,
        ],
        { cwd: root, env: process.env, encoding: "utf8", timeout: 30_000, maxBuffer: 1024 * 1024 },
      );
      if (probe.status !== 0)
        throw new Error(
          "The configured local board did not pass its read-only connection check; no card was claimed.",
        );
      result = JSON.parse(probe.stdout);
    } else {
      result = await requestBoard(
        boardEndpoint(process.env),
        process.env.WORK_BOARD_TOKEN,
        "?connection=1",
      );
    }
    requireBoardProtocol(result);
    check(
      "board-protocol",
      "pass",
      "Authenticated packet-v2 service and schema responded; no card was claimed.",
    );
    const needed = ["read", "claim", "heartbeat", "progress", "release", "block", "submit"];
    const scopes = result.access?.scopes ?? [];
    const missing = scopes.includes("*") ? [] : needed.filter((s) => !scopes.includes(s));
    check(
      "worker-scopes",
      missing.length ? "blocked" : "pass",
      missing.length
        ? `Maintainer must grant these scoped operations: ${missing.join(", ")}.`
        : "Credential supports pickup, lease renewal and evidence submission; card capabilities are checked separately.",
    );
    check(
      "shared-write-enforcement",
      result.canonicalWrites === true || result.strictWrites === true ? "pass" : "blocked",
      result.canonicalWrites === true
        ? "Configured local transport calls the canonical lifecycle directly; this read-only probe does not certify a remote HTTP deployment."
        : result.strictWrites === true
          ? "Strict canonical writes are enabled."
          : "The shared board rollout is incomplete. Maintainer must finish the authorized adapter release and verify strict writes before unattended team dispatch.",
    );
  } else
    check(
      "shared-board",
      "not-checked",
      "Run npm run dev:doctor -- --board to verify the existing private board profile. It uses the same configuration as agent:go and lifecycle commands; offline success does not prove shared dispatch readiness.",
    );
} catch (error) {
  check("preflight", "blocked", error instanceof Error ? error.message : "Readiness check failed");
}
const result = {
  mode: flags.has("--maintainer")
    ? "maintainer-preflight"
    : flags.has("--board")
      ? "assigned-work"
      : "local-demo",
  ready: !checks.some((c) => c.status === "blocked"),
  checks,
};
if (flags.has("--json")) console.log(JSON.stringify(result, null, 2));
else {
  for (const c of checks) console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}`);
  console.log(
    result.ready
      ? `Ready for ${result.mode}.`
      : "Resolve the blocked checks before starting this mode.",
  );
}
process.exitCode = result.ready ? 0 : 1;
