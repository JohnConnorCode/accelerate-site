#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

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

let posts = 0;
let readiness: string[] = [];
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "GET") {
    posts++;
    response.statusCode = 500;
    return response.end(JSON.stringify({ error: "Unexpected claim" }));
  }
  response.end(
    JSON.stringify({
      protocolVersion: 2,
      schemaReady: true,
      nextOffset: null,
      features: [
        {
          id: randomUUID(),
          seed_key: "invalid-repository-fixture",
          title: "Controlled repository fixture",
          status: "planned",
          revision: 1,
          labels: ["milestone:now"],
          readiness,
          work_spec: {
            repository: {
              url: "https://user:fixture-secret@example.test/repo",
              baseBranch: "main",
              baseCommit: "a".repeat(40),
            },
          },
        },
      ],
    }),
  );
});
await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
try {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing controlled server");
  const run = promisify(execFile);
  for (const canonical of [false, true]) {
    readiness = canonical ? ["invalid_repository_url"] : [];
    let output = "";
    try {
      await run(resolve(root, "node_modules/.bin/tsx"), ["scripts/agent-go.ts", "--json"], {
        cwd: root,
        timeout: 60_000,
        env: {
          ...process.env,
          ACCELERATE_AGENT_NO_PROFILE: "1",
          WORK_BOARD_URL: `http://127.0.0.1:${address.port}`,
          WORK_BOARD_TOKEN: "fixture-worker-token",
        },
      });
      assert.fail("Unusable repository must refuse pickup");
    } catch (error) {
      const refusal = error as { code?: number; stdout?: string; stderr?: string };
      assert.equal(refusal.code, 1);
      output = refusal.stdout!;
      assert.ok(!`${output}${refusal.stderr}`.includes("fixture-secret"));
      assert.ok(!`${output}${refusal.stderr}`.includes("fixture-worker-token"));
    }
    const result = JSON.parse(output);
    assert.equal(result.status, canonical ? "NO_READY_WORK" : "PREFLIGHT_BLOCKED");
    assert.match(result.message, /invalid-repository-fixture/);
    assert.match(result.next, /revision-checked edit/);
    assert.ok(
      !result.next.includes("agent:setup"),
      "repository repair must not be mistaken for missing credentials",
    );
    assert.equal(posts, 0);
  }
  console.log(
    "Repository diagnosis identifies legacy and canonical blocked cards safely; no claims or credential setup prompts.",
  );
} finally {
  await new Promise<void>((accept, reject) =>
    server.close((error) => (error ? reject(error) : accept())),
  );
}
