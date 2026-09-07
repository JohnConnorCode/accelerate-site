#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const entrypoints = spawnSync("npx", ["tsx", "scripts/agent-go.ts", "--json"], {
  cwd: root,
  env: {
    ...process.env,
    ACCELERATE_AGENT_NO_PROFILE: "1",
    WORK_BOARD_URL: "",
    WORK_BOARD_TOKEN: "",
  },
  encoding: "utf8",
  timeout: 60_000,
});
assert.notEqual(entrypoints.status, 0);
const diagnostic = JSON.parse(entrypoints.stdout);
assert.equal(diagnostic.status, "SETUP_REQUIRED");
assert.match(diagnostic.message, /no card was claimed/i);
assert(!entrypoints.stdout.includes("secret"));
assert(!entrypoints.stdout.includes("?"));
assert(!entrypoints.stdout.match(/paste credentials|work unclaimed|prepare only/i));
assert.match(readFileSync(resolve(root, "AGENTS.md"), "utf8"), /agent:go/);
assert.match(readFileSync(resolve(root, "AGENTS.md"), "utf8"), /Never ask the user to paste/i);
assert.match(
  readFileSync(resolve(root, "docs/contributing/NATURAL-LANGUAGE-AGENT.md"), "utf8"),
  /Never ask the user to paste/i,
);
assert(existsSync(resolve(root, "scripts/verify-agent-entrypoints.mjs")));
console.log("Natural-language runner setup diagnostics and entrypoint contract passed");
